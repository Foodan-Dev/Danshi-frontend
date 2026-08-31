import type { components } from '@/src/generated/openapi';

export type BizCode = components['schemas']['BizCode'];
export type FieldCode = components['schemas']['FieldCode'];
export type FieldError = components['schemas']['FieldError'];
export type ClientErrorCode = 'AUTH_EXPIRED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'UPLOAD_TIMEOUT';

type AppErrorOptions = {
  clientCode?: ClientErrorCode;
  errorCode?: BizCode;
  status?: number;
  retryAfterSeconds?: number;
  fieldErrors?: FieldError[];
  errorId?: string;
  cause?: unknown;
};

const BACKEND_BIZ_CODES = {
  internal_error: true,
  not_found: true,
  method_not_allowed: true,
  validation_failed: true,
  rate_limited: true,
  unauthorized: true,
  service_unavailable: true,
  email_taken: true,
  email_domain_not_allow: true,
  credentials_invalid: true,
  verify_code_invalid: true,
  verify_code_too_many: true,
  verify_code_busy: true,
  account_banned: true,
  account_deleted: true,
  session_revoked: true,
  session_not_found: true,
  permission_denied: true,
  not_owner: true,
  post_not_found: true,
  post_not_published: true,
  post_deleted: true,
  comment_not_found: true,
  comment_deleted: true,
  notification_not_found: true,
  content_under_audit: true,
  content_rejected: true,
  content_not_restorable: true,
  moderation_not_pending: true,
  dict_item_not_found: true,
  dict_item_in_use: true,
  window_not_in_canteen: true,
  suggestion_not_found: true,
  suggestion_closed: true,
  suggestion_parent_pending: true,
  tag_limit_exceeded: true,
  tag_not_found: true,
  tag_name_conflict: true,
  tag_merge_target_invalid: true,
  image_not_found: true,
  image_not_owned: true,
  image_purpose_wrong: true,
  image_not_approved: true,
  upload_not_found: true,
  upload_closed: true,
  upload_incomplete: true,
  upload_size_mismatch: true,
  moderation_callback_invalid: true,
  cannot_follow_self: true,
  already_exists: true,
  conflict: true,
} satisfies Record<BizCode, true>;

const BACKEND_FIELD_CODES = {
  required: true,
  too_long: true,
  too_short: true,
  out_of_range: true,
  invalid_format: true,
  invalid_enum: true,
  invalid_domain: true,
  conflict: true,
} satisfies Record<FieldCode, true>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readString = (value: unknown) => typeof value === 'string' ? value : undefined;
const isBizCode = (value: unknown): value is BizCode => (
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(BACKEND_BIZ_CODES, value)
);
const isFieldCode = (value: unknown): value is FieldCode => (
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(BACKEND_FIELD_CODES, value)
);

const toFieldError = (value: unknown): FieldError | null => {
  if (!isRecord(value)) return null;
  return {
    field: readString(value.field),
    code: isFieldCode(value.code) ? value.code : undefined,
    message: readString(value.message),
  };
};

export class AppError extends Error {
  clientCode?: ClientErrorCode;
  errorCode?: BizCode;
  status?: number;
  retryAfterSeconds?: number;
  fieldErrors?: FieldError[];
  errorId?: string;
  cause?: unknown;

  constructor(message: string, opts?: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    if (opts) {
      this.clientCode = opts.clientCode;
      this.errorCode = opts.errorCode;
      this.status = opts.status;
      this.retryAfterSeconds = opts.retryAfterSeconds;
      this.fieldErrors = opts.fieldErrors;
      this.errorId = opts.errorId;
      this.cause = opts.cause;
    }
  }

  static fromApiResponse(
    payload: unknown,
    status: number,
    retryAfterSeconds?: number,
  ): AppError {
    if (!isRecord(payload)) {
      return new AppError(`请求失败(${status})`, { status, retryAfterSeconds, cause: payload });
    }

    const data = isRecord(payload.data) ? payload.data : undefined;
    const fieldErrors = Array.isArray(data?.errors)
      ? data.errors.map(toFieldError).filter((item): item is FieldError => item !== null)
      : undefined;

    return new AppError(readString(payload.message) ?? `请求失败(${status})`, {
      status,
      retryAfterSeconds,
      errorCode: isBizCode(payload.error_code) ? payload.error_code : undefined,
      fieldErrors,
      errorId: readString(data?.error_id),
      cause: payload,
    });
  }

  static from(error: unknown, fallbackMessage = '发生未知错误') {
    if (error instanceof AppError) return error;
    const err = isRecord(error) ? error : undefined;
    const response = isRecord(err?.response) ? err.response : undefined;
    const status = typeof err?.status === 'number'
      ? err.status
      : typeof response?.status === 'number'
        ? response.status
        : undefined;
    const message = readString(err?.message) ?? fallbackMessage;
    const retryAfterSeconds = typeof err?.retryAfterSeconds === 'number'
      ? err.retryAfterSeconds
      : undefined;
    return new AppError(message, { status, retryAfterSeconds, cause: error });
  }
}

export function ensureAppError(error: unknown, fallbackMessage?: string) {
  return AppError.from(error, fallbackMessage);
}
