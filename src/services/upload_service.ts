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

/** 读取本地图片的原始字节（Web 用 Blob，原生用 file:// fetch）。 */
async function readBytes(source: Blob | { uri: string }): Promise<ArrayBuffer> {
  if (isBlob(source)) {
    return source.arrayBuffer();
  }
  const res = await fetch(source.uri);
  if (!res.ok) {
    throw new AppError('无法读取本地图片，请重试');
  }
  return res.arrayBuffer();
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
    name = isFile(source) ? source.name || fallbackName : fallbackName;
    type = source.type || inferMimeFromName(name);
    bytes = await source.arrayBuffer();
  } else if (isUriSource(source)) {
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
   * 批量上传图片到后端 COS 图床，最多 9 张。
   */
  async uploadImages(
    sources: UploadSource[],
    purpose: UploadPurpose,
  ): Promise<UploadImageResult[]> {
    if (!sources.length) throw new AppError('请至少选择 1 张图片');
    if (sources.length > MAX_BATCH_COUNT) {
      throw new AppError('单次最多上传 9 张图片');
    }
    const payloads = await Promise.all(
      sources.map((src, index) => normalizeSource(src, index)),
    );
    return uploadsRepository.uploadImages(payloads, purpose);
  },
};
