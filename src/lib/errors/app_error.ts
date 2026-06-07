export class AppError extends Error {
  code?: string;
  status?: number;
  cause?: unknown;

  constructor(message: string, opts?: { code?: string; status?: number; cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    if (opts) {
      this.code = opts.code;
      this.status = opts.status;
      this.cause = opts.cause;
    }
  }

  static from(error: unknown, fallbackMessage = '发生未知错误') {
    if (error instanceof AppError) return error;
    const err = error as Record<string, unknown> | null | undefined;
    const status = (err?.status as number | undefined) ?? (err?.response as Record<string, unknown> | undefined)?.status as number | undefined;
    const message = (err?.message as string | undefined) ?? fallbackMessage;
    return new AppError(message, { status, cause: error });
  }
}

export function ensureAppError(error: unknown, fallbackMessage?: string) {
  return AppError.from(error, fallbackMessage);
}
