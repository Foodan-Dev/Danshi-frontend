import { AppError } from '@/src/lib/errors/app_error';
import type { components } from '@/src/generated/openapi';

type ApiEnvelope = components['schemas']['ApiEnvelope_NoneType_'];

export type ApiResponse<T> = Omit<ApiEnvelope, 'data'> & { data: T };

export function unwrapApiResponse<T>(payload: ApiResponse<T>, okCode: number | number[] = 200): T {
  const ok = Array.isArray(okCode) ? okCode.includes(payload.code) : payload.code === okCode;
  if (!ok) {
    const numeric = Number(payload.code);
    const status = Number.isFinite(numeric) && numeric >= 100 && numeric <= 599 ? numeric : undefined;
    throw new AppError(payload.message || '请求失败', { code: String(payload.code), status });
  }
  return payload.data;
}
