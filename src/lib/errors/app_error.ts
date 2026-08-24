import type { components } from '@/src/generated/openapi';

type BizCode = components['schemas']['BizCode'];
type FieldCode = components['schemas']['FieldCode'];
type FieldError = components['schemas']['FieldError'];

type AppErrorOptions = {
  code?: string;
  errorCode?: BizCode;
  status?: number;
  retryAfterSeconds?: number;
  fieldErrors?: FieldError[];
  errorId?: string;
  cause?: unknown;
};

const BIZ_CODES: ReadonlySet<string> = new Set([
  'internal_error', 'not_found', 'method_not_allowed', 'validation_failed', 'rate_limited',
  'unauthorized', 'service_unavailable', 'email_taken', 'email_domain_not_allow',
  'credentials_invalid', 'verify_code_invalid', 'verify_code_too_many', 'verify_code_busy',
  'account_banned', 'account_deleted', 'session_revoked', 'session_not_found',
  'permission_denied', 'not_owner', 'post_not_found', 'post_not_published', 'post_deleted',
  'comment_not_found', 'comment_deleted', 'notification_not_found', 'content_under_audit',
  'content_rejected', 'content_not_restorable', 'moderation_not_pending', 'dict_item_not_found',
  'dict_item_in_use', 'window_not_in_canteen', 'suggestion_not_found', 'suggestion_closed',
  'suggestion_parent_pending', 'tag_limit_exceeded', 'image_not_found', 'image_not_owned',
  'image_purpose_wrong', 'image_not_approved', 'upload_not_found', 'upload_closed',
  'upload_incomplete', 'upload_size_mismatch', 'moderation_callback_invalid',
  'cannot_follow_self', 'already_exists', 'conflict',
]);

const FIELD_CODES: ReadonlySet<string> = new Set([
  'required', 'too_long', 'too_short', 'out_of_range', 'invalid_format', 'invalid_enum',
  'invalid_domain', 'conflict',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readString = (value: unknown) => typeof value === 'string' ? value : undefined;
const isBizCode = (value: unknown): value is BizCode => (
  typeof value === 'string' && BIZ_CODES.has(value)
);
const isFieldCode = (value: unknown): value is FieldCode => (
  typeof value === 'string' && FIELD_CODES.has(value)
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
  code?: string;
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
      this.code = opts.code;
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
