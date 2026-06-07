import { AppError } from '@/src/lib/errors/app_error';

export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T | null;
};

export function isApiResponse<T = unknown>(v: any): v is ApiResponse<T> {
  return v && typeof v === 'object' && 'code' in v && 'message' in v && 'data' in v;
}

export function unwrapApiResponse<T>(payload: unknown, okCode: number | number[] = 200): T {
  if (!isApiResponse<T>(payload)) return payload as T; 
  const ok = Array.isArray(okCode) ? okCode.includes(payload.code) : payload.code === okCode;
  if (!ok) {
    const numeric = Number(payload.code);
    const status = Number.isFinite(numeric) && numeric >= 100 && numeric <= 599 ? numeric : undefined;
    throw new AppError(payload.message || '请求失败', { code: String(payload.code), status });
  }
  return (payload.data as T);
}
