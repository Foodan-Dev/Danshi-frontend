import { createHttpClient, type HttpClient, type HttpMethod } from '@/src/lib/http/client';
import { AuthStorage } from '@/src/lib/auth/auth_storage';
import { AppError } from '@/src/lib/errors/app_error';
import { API_ENDPOINTS } from '@/src/constants/app';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { components } from '@/src/generated/openapi';

const baseHttpAuth = createHttpClient({ getAuthToken: AuthStorage.getToken });
const httpForRefresh = createHttpClient();

let refreshPromise: Promise<boolean> | null = null;

const clearStoredCredentials = async () => {
  await Promise.all([
    AuthStorage.clearToken(),
    AuthStorage.clearRefreshToken(),
  ]);
};

const isRefreshableUnauthorized = (error: unknown): boolean => {
  const appError = AppError.from(error);
  return appError.status === 401 && appError.errorCode === 'unauthorized';
};

const isRevokedSession = (error: unknown): boolean => {
  const appError = AppError.from(error);
  return appError.status === 401 && appError.errorCode === 'session_revoked';
};

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await AuthStorage.getRefreshToken();
      if (!refreshToken) return false;

      const res = await httpForRefresh.post<ApiResponse<components['schemas']['TokenResult']>>(
        API_ENDPOINTS.AUTH.REFRESH,
        { refresh_token: refreshToken } satisfies components['schemas']['refreshRequest'],
      );
      const payload = unwrapApiResponse(res);
      if (!payload.token) return false;

      await AuthStorage.setToken(payload.token);
      if (payload.refresh_token) await AuthStorage.setRefreshToken(payload.refresh_token);
      return true;
    } catch (error) {
      if (__DEV__) {
        console.warn(
          '[httpAuth] Refresh failed:',
          error instanceof Error ? error.message : error,
        );
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  const refreshed = await refreshPromise;
  if (!refreshed) await clearStoredCredentials();
  return refreshed;
}

function createAuthHttpClient(): HttpClient {
  const makeRequest = async <T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    init?: RequestInit,
    isRetry = false,
  ): Promise<T> => {
    try {
      return await baseHttpAuth.request<T>(method, path, body, init);
    } catch (error) {
      if (isRevokedSession(error)) {
        await clearStoredCredentials();
        throw new AppError('登录已失效，请重新登录', {
          clientCode: 'AUTH_EXPIRED',
          errorCode: 'session_revoked',
          status: 401,
          cause: error,
        });
      }

      if (isRefreshableUnauthorized(error) && !isRetry) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return makeRequest<T>(method, path, body, init, true);

        throw new AppError('登录已失效，请重新登录', {
          clientCode: 'AUTH_EXPIRED',
          errorCode: 'unauthorized',
          status: 401,
          cause: error,
        });
      }

      throw error;
    }
  };

  return {
    request: <T>(method: HttpMethod, path: string, body?: unknown, init?: RequestInit) =>
      makeRequest<T>(method, path, body, init),
    get: <T>(path: string, init?: RequestInit) =>
      makeRequest<T>('GET', path, undefined, init),
    post: <T>(path: string, body?: unknown, init?: RequestInit) =>
      makeRequest<T>('POST', path, body, init),
    put: <T>(path: string, body?: unknown, init?: RequestInit) =>
      makeRequest<T>('PUT', path, body, init),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
      makeRequest<T>('PATCH', path, body, init),
    delete: <T>(path: string, init?: RequestInit) =>
      makeRequest<T>('DELETE', path, undefined, init),
  };
}

export const httpAuth = createAuthHttpClient();
