import { Platform } from 'react-native';
import { USE_MOCK } from '@/src/constants/app';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

// FDUHole 图片托管服务 Base URL
const FDUHOLE_IMAGE_HOST = 'https://image.fduhole.com';

export type UploadFilePayload =
  | { name: string; type: string; uri: string; blob?: never }
  | { name: string; type: string; uri?: never; blob: Blob };

export type UploadImageResult = {
  url: string;
  filename: string;
  size: number;
};

// FDUHole 图片上传响应类型
type FDUHoleUploadResponse = {
  // 标准格式
  success?: boolean;
  url?: string;
  error?: string;
  // 可能的嵌套格式
  data?: {
    url?: string;
    link?: string;
    image?: string;
  };
  // 其他可能的字段名
  image?: {
    url?: string;
  };
  link?: string;
};

export interface UploadsRepository {
  uploadImage(file: UploadFilePayload): Promise<UploadImageResult>;
  uploadImages(files: UploadFilePayload[]): Promise<UploadImageResult[]>;
}

function appendFile(form: FormData, field: string, payload: UploadFilePayload) {
  if ('uri' in payload) {
    form.append(field, {
      uri: payload.uri,
      name: payload.name,
      type: payload.type,
    } as any);
    return;
  }
  form.append(field, payload.blob, payload.name);
}

function buildFormData(field: string, payloads: UploadFilePayload[]): FormData {
  if (!payloads.length) throw new Error('缺少文件');
  const form = new FormData();
  payloads.forEach((p) => appendFile(form, field, p));
  return form;
}

/**
 * FDUHole 图片托管服务实现
 * API 文档: https://github.com/OpenTreeHole/backend/tree/main/image_hosting
 * 
 * 上传接口: POST {hostname}/api/uploadImage
 * - 使用 form-data，字段名为 "source"
 * 
 * 获取图片: GET {hostname}/api/i/:year/:month/:day/:identifier
 * - 例如: https://image.fduhole.com/i/2025/09/06/68bc0d8121d7d1.jpg
 * 
 * 注意: 需要在校园网环境下访问
 */
class FDUHoleUploadsRepository implements UploadsRepository {
  private readonly uploadUrl = `${FDUHOLE_IMAGE_HOST}/api/uploadImage`;

  async uploadImage(file: UploadFilePayload): Promise<UploadImageResult> {
    const form = new FormData();
    
    // FDUHole API 使用 "source" 作为字段名
    if ('uri' in file && file.uri) {
      // React Native 环境 - 使用 uri 格式
      form.append('source', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    } else if ('blob' in file && file.blob) {
      // Web 环境 - 使用 Blob
      form.append('source', file.blob, file.name);
    } else {
      throw new Error('无效的文件格式');
    }

    try {
      const response = await fetch(this.uploadUrl, {
        method: 'POST',
        body: form,
        // 不设置 Content-Type，让浏览器/RN 自动设置 multipart/form-data boundary
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (__DEV__) {
          console.error('[FDUHole Upload] Upload failed:', response.status, errorText);
        }
        if (response.status === 413) {
          throw new Error('图片过大，请重新选择后再试');
        }
        if (response.status === 415) {
          throw new Error('图片格式不受支持，请重新选择后再试');
        }
        if (response.status >= 500) {
          throw new Error('上传服务暂时不可用，请稍后重试');
        }
        throw new Error('上传失败，请稍后重试');
      }

      const data: FDUHoleUploadResponse = await response.json();
      
      // 尝试从多种可能的格式中提取 URL
      const imageUrl = 
        data.url || 
        data.link ||
        data.data?.url || 
        data.data?.link || 
        data.data?.image ||
        data.image?.url ||
        (typeof data === 'string' ? data : null);
      
      if (!imageUrl) {
        // 如果有 success: false 或 error 字段
        if (data.success === false || data.error) {
          if (__DEV__) console.error('[FDUHole Upload] Upload rejected:', data.error || data);
          throw new Error('上传失败，请稍后重试');
        }
        if (__DEV__) console.error('[FDUHole Upload] Unexpected response format:', data);
        throw new Error(`上传失败，服务器返回格式异常`);
      }

      const safeImageUrl = getSafeRemoteUrl(imageUrl);
      if (!safeImageUrl) {
        if (__DEV__) console.error('[FDUHole Upload] Invalid image url returned:', imageUrl);
        throw new Error('上传失败，返回的图片地址无效');
      }

      // 从返回的 URL 中提取文件名
      const urlParts = safeImageUrl.split('/');
      const filename = urlParts[urlParts.length - 1] || file.name;

      return {
        url: safeImageUrl,
        filename,
        size: 'blob' in file && file.blob ? file.blob.size : 0,
      };
    } catch (error) {
      if (error instanceof Error) {
        // 网络错误提示用户可能需要校园网
        if (error.message.includes('Network') || error.message.includes('fetch')) {
          throw new Error('网络连接失败，请确保处于校园网环境');
        }
        throw error;
      }
      throw new Error('上传失败，请稍后重试');
    }
  }

  async uploadImages(files: UploadFilePayload[]): Promise<UploadImageResult[]> {
    // 串行上传，避免同时请求过多
    const results: UploadImageResult[] = [];
    for (const file of files) {
      const result = await this.uploadImage(file);
      results.push(result);
    }
    return results;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class MockUploadsRepository implements UploadsRepository {
  private seq = 0;

  private nextUrl(name: string) {
    this.seq += 1;
    return `https://mock-storage.dawn-eat.com/${Date.now()}-${this.seq}-${encodeURIComponent(name)}`;
  }

  async uploadImage(file: UploadFilePayload): Promise<UploadImageResult> {
    await delay(120);
    const filename = file.name || `mock-${Date.now()}.jpg`;
    const blobSize = 'blob' in file && file.blob ? file.blob.size : 0;
    return {
      url: this.nextUrl(filename),
      filename,
      size: blobSize,
    };
  }

  async uploadImages(files: UploadFilePayload[]): Promise<UploadImageResult[]> {
    const results: UploadImageResult[] = [];
    for (const file of files) {
      results.push(await this.uploadImage(file));
    }
    return results;
  }
}

export const uploadsRepository: UploadsRepository = USE_MOCK 
  ? new MockUploadsRepository() 
  : new FDUHoleUploadsRepository();
