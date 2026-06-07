import { AppError } from '@/src/lib/errors/app_error';
import {
  uploadsRepository,
  type UploadFilePayload,
  type UploadImageResult,
} from '@/src/repositories/uploads_repository';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
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
};

const isFile = (value: any): value is File => typeof File !== 'undefined' && value instanceof File;
const isBlob = (value: any): value is Blob => typeof Blob !== 'undefined' && value instanceof Blob;
const isUriSource = (value: any): value is { uri: string; name?: string; type?: string; size?: number } =>
  value && typeof value === 'object' && typeof value.uri === 'string';

function ensureSizeWithinLimit(size?: number) {
  if (typeof size === 'number' && size > MAX_FILE_SIZE) {
    throw new AppError('单个文件不能超过 5MB');
  }
}

function inferMimeFromName(name?: string) {
  if (!name) return FALLBACK_MIME;
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return FALLBACK_MIME;
  return EXT_MIME[ext] ?? FALLBACK_MIME;
}

function normalizeSource(source: UploadSource, index: number): UploadFilePayload {
  const fallbackName = `upload-${Date.now()}-${index + 1}.jpg`;
  if (isFile(source)) {
    ensureSizeWithinLimit(source.size);
    const name = source.name || fallbackName;
    const type = source.type || inferMimeFromName(name);
    return { name, type, blob: source };
  }
  if (isBlob(source)) {
    ensureSizeWithinLimit(source.size);
    return { name: fallbackName, type: source.type || FALLBACK_MIME, blob: source };
  }
  if (isUriSource(source)) {
    ensureSizeWithinLimit(source.size);
    const name = source.name || fallbackName;
    const type = source.type || inferMimeFromName(name);
    return { name, type, uri: source.uri };
  }
  throw new AppError('不支持的文件来源');
}

export const uploadService = {
  /**
   * 上传单张图片到 FDUHole 图片托管服务
   * 注意: 需要在校园网环境下使用
   */
  async uploadImage(source: UploadSource): Promise<UploadImageResult> {
    const payload = normalizeSource(source, 0);
    return uploadsRepository.uploadImage(payload);
  },

  /**
   * 批量上传图片到 FDUHole 图片托管服务
   * 注意: 需要在校园网环境下使用
   * @param sources 图片源数组，最多 9 张
   */
  async uploadImages(sources: UploadSource[]): Promise<UploadImageResult[]> {
    if (!sources.length) throw new AppError('请至少选择 1 张图片');
    if (sources.length > MAX_BATCH_COUNT) throw new AppError('单次最多上传 9 张图片');
    const payloads = sources.map((src, index) => normalizeSource(src, index));
    return uploadsRepository.uploadImages(payloads);
  },
};
