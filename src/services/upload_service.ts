import { File as ExpoFile } from 'expo-file-system';

import { AppError } from '@/src/lib/errors/app_error';
import {
  uploadsRepository,
  type UploadFilePayload,
  type UploadImageResult,
  type UploadPurpose,
} from '@/src/repositories/uploads_repository';

// 对齐后端 COS_MAX_IMAGE_BYTES 默认值（10 MiB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_COUNT = 9;
const FALLBACK_MIME = 'application/octet-stream';

export type UploadSource =
  | Blob
  | {
      uri: string;
      name?: string;
      type?: string;
      size?: number;
    };

/** 批量上传中单张失败的记录。 */
export type UploadFailure = {
  name: string;
  reason: string;
};

/** 批量上传结果：保留全部成功项，失败项单独列出，不再整体抛错。 */
export type BatchUploadResult = {
  results: UploadImageResult[];
  failures: UploadFailure[];
  /** 因致命错误中止后，未尝试上传的剩余图片数量。 */
  skipped: number;
};

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
};

const isFile = (value: unknown): value is File =>
  typeof File !== 'undefined' && value instanceof File;
const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;
const isUriSource = (
  value: unknown,
): value is { uri: string; name?: string; type?: string; size?: number } =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as { uri?: unknown }).uri === 'string';

function inferMimeFromName(name?: string) {
  if (!name) return FALLBACK_MIME;
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return FALLBACK_MIME;
  return EXT_MIME[ext] ?? FALLBACK_MIME;
}

/** 读取本地图片的原始字节（Web 用 Blob，原生用 expo-file-system 读 file://）。 */
async function readBytes(source: Blob | { uri: string }): Promise<ArrayBuffer> {
  if (isBlob(source)) {
    return source.arrayBuffer();
  }
  try {
    return await new ExpoFile(source.uri).arrayBuffer();
  } catch (error) {
    throw new AppError('无法读取本地图片，请重试', { cause: error });
  }
}

/** 把 UploadSource 归一化为 { name, type, bytes }，并在读字节后校验大小。 */
async function normalizeSource(
  source: UploadSource,
  index: number,
): Promise<UploadFilePayload> {
  const fallbackName = `upload-${Date.now()}-${index + 1}.jpg`;

  let name: string;
  let type: string;
  let bytes: ArrayBuffer;

  if (isFile(source) || isBlob(source)) {
    if (source.size > MAX_FILE_SIZE) {
      throw new AppError('单个文件不能超过 10MB');
    }
    name = isFile(source) ? source.name || fallbackName : fallbackName;
    type = source.type || inferMimeFromName(name);
    bytes = await source.arrayBuffer();
  } else if (isUriSource(source)) {
    if (typeof source.size === 'number' && source.size > MAX_FILE_SIZE) {
      throw new AppError('单个文件不能超过 10MB');
    }
    name = source.name || fallbackName;
    type = source.type || inferMimeFromName(name);
    bytes = await readBytes(source);
  } else {
    throw new AppError('不支持的文件来源');
  }

  if (bytes.byteLength > MAX_FILE_SIZE) {
    throw new AppError('单个文件不能超过 10MB');
  }
  return { name, type, bytes };
}

/** 从 UploadSource 提取一个可用于失败提示的文件名。 */
function sourceDisplayName(source: UploadSource, index: number): string {
  if (isFile(source)) {
    return source.name || `图片 ${index + 1}`;
  }
  if (isUriSource(source)) {
    if (source.name) return source.name;
    const seg = source.uri.split('/').pop();
    return seg || `图片 ${index + 1}`;
  }
  return `图片 ${index + 1}`;
}

/** 会导致批量上传整体中止的错误码（网络/鉴权/超时）。 */
const FATAL_UPLOAD_ERROR_CODES = new Set([
  'AUTH_EXPIRED',
  'NETWORK_ERROR',
  'TIMEOUT',
  'UPLOAD_TIMEOUT',
]);

/** 判断错误是否应中止后续上传（致命），而非仅跳过当前这一张。 */
function isFatalUploadError(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  if (error.code && FATAL_UPLOAD_ERROR_CODES.has(error.code)) return true;
  return error.status === 503;
}

/** 把批量结果整理成用户可见的摘要（失败时列出具体原因）。 */
export function formatBatchSummary(result: BatchUploadResult): string {
  const { results, failures, skipped } = result;
  const reasons = [...new Set(failures.map((f) => f.reason).filter(Boolean))];
  let summary = `成功 ${results.length} 张`;
  if (failures.length > 0) {
    summary += `，失败 ${failures.length} 张`;
    if (reasons.length > 0) {
      summary += `（${reasons.join('、')}）`;
    }
  }
  if (skipped > 0) {
    summary += `；已停止，剩余 ${skipped} 张未上传`;
  }
  return summary;
}

export const uploadService = {
  /**
   * 上传单张图片到后端 COS 图床（presign → 直传 → complete）。
   * @param source 图片源（Web 为 Blob/File，原生为 { uri, name, type }）
   * @param purpose post（帖子图片）或 avatar（头像）
   */
  async uploadImage(
    source: UploadSource,
    purpose: UploadPurpose,
  ): Promise<UploadImageResult> {
    const payload = await normalizeSource(source, 0);
    return uploadsRepository.uploadImage(payload, purpose);
  },

  /**
   * 批量上传图片：逐张「读取 + 上传」，单张失败不中断，保留全部成功结果。
   * 峰值内存只保留一张图片的字节；最后返回 { results, failures }。
   */
  async uploadImages(
    sources: UploadSource[],
    purpose: UploadPurpose,
  ): Promise<BatchUploadResult> {
    if (!sources.length) throw new AppError('请至少选择 1 张图片');
    if (sources.length > MAX_BATCH_COUNT) {
      throw new AppError('单次最多上传 9 张图片');
    }

    const results: UploadImageResult[] = [];
    const failures: UploadFailure[] = [];
    let skipped = 0;
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      try {
        const payload = await normalizeSource(source, index);
        const result = await uploadsRepository.uploadImage(payload, purpose);
        results.push(result);
      } catch (error) {
        failures.push({
          name: sourceDisplayName(source, index),
          reason: error instanceof Error ? error.message : '上传失败',
        });
        if (isFatalUploadError(error)) {
          skipped = sources.length - index - 1;
          break;
        }
      }
    }
    return { results, failures, skipped };
  },
};