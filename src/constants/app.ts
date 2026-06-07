import type { User } from '@/src/models/User';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';

// Storage keys used across the app
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  POSTS: 'posts:v1',
} as const;

// Runtime config & feature switches (can be overridden via EXPO_PUBLIC_* envs)
// 生产环境默认关闭 Mock
export const USE_MOCK = (process.env.EXPO_PUBLIC_USE_MOCK ?? 'false').toLowerCase() === 'true';
const rawApiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

if (__DEV__ && !USE_MOCK && !rawApiBaseUrl) {
  console.warn('[config] USE_MOCK is false but EXPO_PUBLIC_API_URL is not set. Falling back to https://example.invalid');
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

// API endpoints (path only, without /api/v1 prefix). 
// Base URL with /api/v1 prefix comes from src/config
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',             // POST
    REGISTER: '/auth/register',       // POST
    ME: '/auth/me',                   // GET
    LOGOUT: '/auth/logout',           // POST
    REFRESH: '/auth/refresh',         // POST 
  },
  USERS: {
    ROOT: '/users', // GET /:userId, PUT /:userId
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
    COMPANION_STATUS: '/posts/:postId/companion-status', // PUT
  },
  COMMENTS: {
    LIST_FOR_POST: '/posts/:postId/comments',
    LIST_REPLIES: '/comments/:commentId/replies',
    CREATE: '/posts/:postId/comments',
    LIKE: '/comments/:commentId/like',
    UNLIKE: '/comments/:commentId/like',
    DELETE: '/comments/:commentId',
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
  /*
  CONFIG: {
    CANTEENS: '/config/canteens',
    CUISINES: '/config/cuisines',
    FLAVORS: '/config/flavors',
    POST_TYPES: '/config/post-types',
  },
  UPLOAD: {
    IMAGE: '/upload/image',
    IMAGES: '/upload/images',
  },
  STATS: {
    PLATFORM: '/stats/platform',
    USER: '/stats/user/:userId',
  },
  */
} as const;

// Role literals and their order (low -> high privilege)
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type RoleLiteral = typeof ROLES[keyof typeof ROLES];
export const ROLE_ORDER: RoleLiteral[] = [ROLES.USER, ROLES.ADMIN, ROLES.SUPER_ADMIN];

// Common regex patterns
export const REGEX = {
  // email: simple email validation
  EMAIL: /.+@.+\..+/,
  // username: 3-30 chars, letters, numbers, underscore, dot, hyphen
  USERNAME: /^[a-zA-Z0-9_.-]{3,30}$/,
} as const;

// Convenience type to align with domain type if needed
export type Role = User['role'];
