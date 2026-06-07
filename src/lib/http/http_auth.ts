import { createHttpClient, type HttpClient, type HttpMethod } from '@/src/lib/http/client';
import { AuthStorage } from '@/src/lib/auth/auth_storage';
import { AppError } from '@/src/lib/errors/app_error';
import { API_ENDPOINTS } from '@/src/constants/app';

/*
双 token 机制
请求 API
   ↓
收到 401 错误？
   ↓ 是
isTokenExpiredError() 检查
   ↓ 是
使用 refresh_token 刷新
   ↓
刷新成功？─── 是 ──→ 保存新 token，重试原请求
   ↓ 否
清除所有 token，抛出 AUTH_EXPIRED 错误
   ↓
前端显示"登录已过期，请重新登录"
*/

// 基础 HTTP 客户端（带 token）
const baseHttpAuth = createHttpClient({ getAuthToken: AuthStorage.getToken });

// 用于刷新 token 的 HTTP 客户端（不带自动刷新，避免循环）
const httpForRefresh = createHttpClient();

// 刷新锁，防止并发刷新
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * 判断错误是否为 token 过期错误
 * 根据 API 文档建议：检查错误信息是否为"token已过期"
 */
function isTokenExpiredError(error: any): boolean {
  const status = error?.status ?? error?.cause?.status;
  if (status !== 401) return false;
  
  // 检查错误信息是否包含 token 过期相关的关键字
  const message = (error?.message ?? error?.cause?.message ?? '').toLowerCase();
  const expiredKeywords = ['expired', '过期', 'invalid token', 'token invalid', 'unauthorized'];
  
  // 如果是 401 且没有具体信息，默认视为 token 过期
  if (!message) return true;
  
  return expiredKeywords.some(keyword => message.includes(keyword));
}

/**
 * 刷新 access token
 * @returns true 如果刷新成功，false 如果需要重新登录
 */
async function refreshAccessToken(): Promise<boolean> {
  // 如果已经在刷新中，等待刷新完成
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await AuthStorage.getRefreshToken();
      if (!refreshToken) {
        if (__DEV__) console.warn('[httpAuth] No refresh token available');
        return false;
      }
      
      type RefreshResponse = {
        code?: number;
        data?: { token: string; refresh_token?: string };
        message?: string;
        token?: string;
        refresh_token?: string;
      };
      
      const res = await httpForRefresh.post<RefreshResponse>(
        API_ENDPOINTS.AUTH.REFRESH, 
        { refresh_token: refreshToken }
      );

      // 处理 API 响应格式
      const token = res.data?.token ?? res.token;
      const newRefreshToken = res.data?.refresh_token ?? res.refresh_token;
      
      if (!token) {
        if (__DEV__) console.warn('[httpAuth] Refresh response missing token');
        return false;
      }

      // 保存新的 token
      await AuthStorage.setToken(token);
      if (newRefreshToken) {
        await AuthStorage.setRefreshToken(newRefreshToken);
      }

      if (__DEV__) console.log('[httpAuth] Token refreshed successfully');
      return true;
    } catch (error: any) {
      if (__DEV__) console.error('[httpAuth] Token refresh failed:', error?.message);
      // refresh_token 也过期了，清除所有 token（需要重新登录）
      await AuthStorage.clearToken();
      await AuthStorage.clearRefreshToken();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * 创建带有自动刷新 token 功能的 HTTP 客户端
 */
function createAuthHttpClient(): HttpClient {
  const makeRequest = async <T>(
    method: HttpMethod,
    path: string,
    body?: any,
    init?: RequestInit,
    isRetry = false
  ): Promise<T> => {
    try {
      return await baseHttpAuth.request<T>(method, path, body, init);
    } catch (error: any) {
      // 检查是否是 token 过期错误（401 + 相关错误信息）
      if (isTokenExpiredError(error) && !isRetry) {
        // 尝试刷新 token
        const refreshed = await refreshAccessToken();
        
        if (refreshed) {
          return makeRequest<T>(method, path, body, init, true);
        } else {
          // refresh_token 也过期了，抛出需要重新登录的错误
          throw new AppError('登录已过期，请重新登录', { 
            code: 'AUTH_EXPIRED', 
            status: 401,
            cause: error 
          });
        }
      }
      
      // 其他错误直接抛出
      throw error;
    }
  };

  return {
    request: <T>(method: HttpMethod, path: string, body?: any, init?: RequestInit) => 
      makeRequest<T>(method, path, body, init),
    get: <T>(path: string, init?: RequestInit) => 
      makeRequest<T>('GET', path, undefined, init),
    post: <T>(path: string, body?: any, init?: RequestInit) => 
      makeRequest<T>('POST', path, body, init),
    put: <T>(path: string, body?: any, init?: RequestInit) => 
      makeRequest<T>('PUT', path, body, init),
    patch: <T>(path: string, body?: any, init?: RequestInit) => 
      makeRequest<T>('PATCH', path, body, init),
    delete: <T>(path: string, init?: RequestInit) => 
      makeRequest<T>('DELETE', path, undefined, init),
  };
}

export const httpAuth = createAuthHttpClient();
