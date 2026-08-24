import { API_ENDPOINTS } from '@/src/constants/app';
import { AppError } from '@/src/lib/errors/app_error';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { md5Base64 } from '@/src/lib/security/md5';
import { getSafeRemoteUrl } from '@/src/lib/security/url';
import type { components } from '@/src/generated/openapi';
import { requireNumber, requireString } from '@/src/repositories/api_mappers';

/** 上传用途，对应后端 presign 的 purpose（post / avatar）。 */
export type UploadPurpose = 'post' | 'avatar';

/** 归一化后的上传载荷：bytes 为图片原始字节。 */
export type UploadFilePayload = {
  name: string;
  type: string;
  bytes: ArrayBuffer;
};

export type UploadImageResult = {
  url: string;
  filename: string;
  size: number;
};

/** 单张图片直传 COS 的超时（毫秒）；超时只影响当前这一张。 */
const COS_PUT_TIMEOUT_MS = 60 * 1000;

export interface UploadsRepository {
  uploadImage(
    file: UploadFilePayload,
    purpose: UploadPurpose,
  ): Promise<UploadImageResult>;
}

/**
 * 后端 COS 直传实现：presign → 直传 COS → complete。
 * 只有 complete 成功后返回的 public_url 才能用于帖子 images / 资料 avatar_url。
 */
class ApiUploadsRepository implements UploadsRepository {
  async uploadImage(
    file: UploadFilePayload,
    purpose: UploadPurpose,
  ): Promise<UploadImageResult> {
    const size = file.bytes.byteLength;
    const contentMd5 = md5Base64(file.bytes);

    // 1. 申请上传凭证（含 Content-MD5 与大小，签入预签名 URL）
    const presignRequest: components['schemas']['uploadPresignRequest'] = {
      purpose,
      content_type: file.type,
      size,
      content_md5: contentMd5,
    };
    const presignRes = await httpAuth.post<ApiResponse<components['schemas']['UploadPresignResult']>>(
      API_ENDPOINTS.UPLOAD.PRESIGN,
      presignRequest,
    );
    const presign = unwrapApiResponse(presignRes);
    const uploadId = requireNumber(presign.upload_id, '上传 ID');
    const uploadUrl = requireString(presign.upload_url, '上传地址');

    // 2. 直传 COS（裸 fetch：非 API 域名、不带 Authorization，带独立超时）
    const putRes = await (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), COS_PUT_TIMEOUT_MS);
      try {
        return await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
            'Content-MD5': contentMd5,
          },
          body: file.bytes,
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new AppError('上传超时，请重试', { code: 'UPLOAD_TIMEOUT' });
        }
        throw new AppError('网络连接失败，请检查网络后重试', { code: 'NETWORK_ERROR', cause: error });
      } finally {
        clearTimeout(timeoutId);
      }
    })();
    if (!putRes.ok) {
      if (__DEV__) {
        console.error('[uploads] COS PUT failed:', putRes.status);
      }
      throw new AppError('上传失败，请稍后重试', { status: putRes.status });
    }

    // 3. 确认上传完成，取得公开 URL
    const completeRes = await httpAuth.post<ApiResponse<components['schemas']['UploadCompleteResult']>>(
      API_ENDPOINTS.UPLOAD.COMPLETE.replace(
        ':uploadId',
        encodeURIComponent(String(uploadId)),
      ),
      {},
    );
    const complete = unwrapApiResponse(completeRes);

    const safeUrl = getSafeRemoteUrl(requireString(complete.public_url, '图片地址'));
    if (!safeUrl) {
      throw new AppError('上传返回的图片地址无效');
    }
    return {
      url: safeUrl,
      filename: requireString(complete.object_key, '对象键').split('/').pop() || file.name,
      size,
    };
  }
}

export const uploadsRepository: UploadsRepository = new ApiUploadsRepository();
