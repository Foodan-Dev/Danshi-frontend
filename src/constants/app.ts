import type { User } from '@/src/models/User';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';
import type { paths } from '@/src/generated/openapi';

type BackendPath = Extract<keyof paths, `/api/v2${string}`>;
type RelativeBackendPath<Path extends BackendPath> = Path extends `/api/v2${infer Relative}`
  ? Relative
  : never;
type EndpointTemplate<Path extends string> = Path extends `${infer Prefix}{${string}}${infer Suffix}`
  ? `${Prefix}:${string}${EndpointTemplate<Suffix>}`
  : Path;
type ApiEndpoint = EndpointTemplate<RelativeBackendPath<BackendPath>>;
type ApiEndpointMap = { readonly [key: string]: ApiEndpoint | ApiEndpointMap };

// Storage keys used across the app
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

// Runtime config (can be overridden via EXPO_PUBLIC_* envs)
const rawApiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

if (__DEV__ && !rawApiBaseUrl) {
  console.warn('[config] EXPO_PUBLIC_API_URL is not set. Falling back to https://example.invalid');
}

function resolveApiBaseUrl(value?: string) {
  const fallback = 'https://example.invalid';
  if (!value) return fallback;
  if (!isHttpOrHttpsUrl(value)) {
    throw new Error(
      'EXPO_PUBLIC_API_URL must use http(s).'
    );
  }
  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl(rawApiBaseUrl);
export const REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS ?? 10000);

// API endpoints (path only, without /api/v2 prefix).
// EXPO_PUBLIC_API_URL supplies the base URL including /api/v2.
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',             // POST
    REGISTER: '/auth/register',       // POST
    EMAIL_VERIFICATION_CODES: '/auth/email-verification-codes',
    ME: '/auth/me',                   // GET
    LOGOUT: '/auth/logout',           // POST
    LOGOUT_ALL: '/auth/logout-all',
    REFRESH: '/auth/refresh',         // POST 
    SESSIONS: '/auth/sessions',
    SESSION: '/auth/sessions/:sessionId',
  },
  USERS: {
    ROOT: '/users/:userId',
    POSTS: '/users/:userId/posts',
    FAVORITES: '/users/:userId/favorites',
    FOLLOWING: '/users/:userId/following',
    FOLLOWERS: '/users/:userId/followers',
    FOLLOW: '/users/:userId/follow',
  },
  ADMIN: {
    POSTS_PENDING: '/admin/posts/pending',
    POST_REVIEW: '/admin/posts/:postId/review',
    POSTS: '/admin/posts',
    POST_DELETE: '/admin/posts/:postId',
    USERS: '/admin/users',
    USER_ROLE: '/admin/users/:userId/role',
    USER_STATUS: '/admin/users/:userId/status',
    ADMINS: '/admin/admins',
    SUPER_ADMINS: '/admin/super-admins',
    COMMENTS: '/admin/comments',
    COMMENT_DELETE: '/admin/comments/:commentId',
  },
  POSTS: {
    GETPOSTPRE: '/posts',  // GET
    GETPOSTALL: '/posts/:postId',  // GET
    CREATEPOST: '/posts',  // POST
    UPDATEPOST: '/posts/:postId',  // PUT
    DELETEPOST: '/posts/:postId',  // DELETE
    LIKEPOST: '/posts/:postId/like',  // POST
    UNLIKEPOST: '/posts/:postId/like',  // DELETE
    FAVORITEPOST: '/posts/:postId/favorite',  // POST
    UNFAVORITEPOST: '/posts/:postId/favorite',  // DELETE
  },
  COMMENTS: {
    LIST_FOR_POST: '/posts/:postId/comments',
    LIST_REPLIES: '/comments/:commentId/replies',
    CREATE: '/posts/:postId/comments',
    LIKE: '/comments/:commentId/like',
    UNLIKE: '/comments/:commentId/like',
    DELETE: '/comments/:commentId',
    UPDATE: '/comments/:commentId',
  },
  SEARCH: {
    POSTS: '/search/posts',
    USERS: '/search/users',
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_READ: '/notifications/:notificationId/read',
    MARK_ALL_READ: '/notifications/read-all',
  },
  UPLOAD: {
    PRESIGN: '/uploads/presign',
    COMPLETE: '/uploads/:uploadId/complete',
  },
  CONFIG: '/config',
  DICTIONARY_SUGGESTIONS: {
    CREATE: '/dictionary-suggestions',
    MINE: '/dictionary-suggestions/mine',
  },
} as const satisfies ApiEndpointMap;

// Role literals and their order (low -> high privilege)
export const ROLES = {
  USER: 'user',
  DICT_REVIEWER: 'dict_reviewer',
  MODERATOR: 'moderator',
  // 兼容旧界面命名；API v2 的内容管理员角色名为 moderator。
  ADMIN: 'moderator',
  SUPER_ADMIN: 'super_admin',
} as const;

export type RoleLiteral = typeof ROLES[keyof typeof ROLES];
export const ROLE_ORDER: RoleLiteral[] = [
  ROLES.USER,
  ROLES.DICT_REVIEWER,
  ROLES.MODERATOR,
  ROLES.SUPER_ADMIN,
];

// Common regex patterns
export const REGEX = {
  EMAIL: /.+@.+\..+/,
} as const;

// Convenience type to align with domain type if needed
export type Role = User['role'];
