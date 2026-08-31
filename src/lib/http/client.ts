import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '@/src/constants/app';
import { AppError } from '@/src/lib/errors/app_error';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpOptions = {
  baseUrl?: string;
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
};

export interface HttpClient {
  request<T = unknown>(method: HttpMethod, path: string, body?: unknown, init?: RequestInit): Promise<T>;
  get<T = unknown>(path: string, init?: RequestInit): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T = unknown>(path: string, init?: RequestInit): Promise<T>;
}

export function createHttpClient(opts: HttpOptions = {}): HttpClient {
  const baseUrl = opts.baseUrl ?? API_BASE_URL;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const defaultHeaders = {
    ...(opts.defaultHeaders ?? {}),
  } as Record<string, string>;

  const isBodyInit = (value: unknown): value is BodyInit => {
    if (value == null) return false;
    if (typeof value === 'string') return true;
    if (typeof FormData !== 'undefined' && value instanceof FormData) return true;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
    if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) return true;
    if (typeof ArrayBuffer !== 'undefined' && (value instanceof ArrayBuffer || ArrayBuffer.isView(value))) return true;
    return false;
  };

  async function request<T>(method: HttpMethod, path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = await opts.getAuthToken?.();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...defaultHeaders,
        ...(init?.headers as Record<string, string> | undefined),
      };
      const bodyIsBodyInit = isBodyInit(body);
      const payload: BodyInit | undefined = body == null ? undefined : bodyIsBodyInit ? (body as BodyInit) : JSON.stringify(body);

      if (bodyIsBodyInit) {
        const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
        if (isMultipart) delete headers['Content-Type'];
      } else if (body != null) {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      }

      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { headers: _ignoredHeaders, ...restInit } = init ?? {};

      const fullUrl = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

      if (__DEV__) {
        console.log(`[HttpClient] ${method} ${fullUrl}`);
      }

      const res = await fetch(fullUrl, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
        ...restInit,
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

      if (!res.ok) {
        const retryAfterHeader = res.headers.get('retry-after');
        const parsedRetryAfter = retryAfterHeader === null
          ? Number.NaN
          : Number.parseInt(retryAfterHeader, 10);
        const retryAfterSeconds = Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
          ? parsedRetryAfter
          : undefined;
        throw AppError.fromApiResponse(data, res.status, retryAfterSeconds);
      }

      return (data as unknown) as T;
    } catch (e: unknown) {
      if (__DEV__) console.error(
        '[HttpClient] Request failed:',
        method,
        path,
        e instanceof Error ? e.message : e,
      );
      const name = (e instanceof Error) ? e.name : undefined;
      if (name === 'AbortError') {
        throw new AppError('请求超时', { clientCode: 'TIMEOUT', cause: e });
      }

      // 原生 App 中 TypeError 通常表示网络不可达
      if (typeof e === 'object' && e instanceof TypeError) {
        throw new AppError(
          '网络连接失败，请检查网络后重试',
          { clientCode: 'NETWORK_ERROR', cause: e }
        );
      }

      throw AppError.from(e);
    } finally {
      clearTimeout(id);
    }
  }

  return {
    request,
    get: (path, init) => request('GET', path, undefined, init),
    post: (path, body, init) => request('POST', path, body, init),
    put: (path, body, init) => request('PUT', path, body, init),
    patch: (path, body, init) => request('PATCH', path, body, init),
    delete: (path, init) => request('DELETE', path, undefined, init),
  };
}

export const http = createHttpClient();
