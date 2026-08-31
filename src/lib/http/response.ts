import { AppError, type BizCode } from '@/src/lib/errors/app_error';

export type { BizCode, FieldError } from '@/src/lib/errors/app_error';

export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
  error_code?: BizCode;
};

export function unwrapApiResponse<T>(payload: ApiResponse<T>, okCode: number | number[] = 200): T {
  const ok = Array.isArray(okCode) ? okCode.includes(payload.code) : payload.code === okCode;
  if (!ok) {
    const numeric = Number(payload.code);
    const status = Number.isFinite(numeric) && numeric >= 100 && numeric <= 599 ? numeric : undefined;
    throw new AppError(payload.message || '请求失败', {
      errorCode: payload.error_code,
      status,
      cause: payload,
    });
  }
  return payload.data;
}
