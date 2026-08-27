import { API_ENDPOINTS } from '@/src/constants/app';
import type { components } from '@/src/generated/openapi';
import { AppError } from '@/src/lib/errors/app_error';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { requireNumber, requireString, toPagination } from '@/src/repositories/api_mappers';

export type SearchPostsParams = {
  q: string;
  category?: string;
  canteen?: string;
  tags?: string[];
  page?: number;
  limit?: number;
};
export type SearchUsersParams = { q: string; page?: number; limit?: number };
export type SearchHighlight = { title?: string; content?: string };
export type SearchPost = {
  id: number;
  title: string;
  content: string;
  category: 'food' | 'recipe';
  images: string[];
  image_thumbs: string[];
  author?: { id: number; name: string; avatar_url: string | null };
  stats: { like_count: number; comment_count: number; view_count: number };
  highlight?: SearchHighlight;
  created_at: string;
};
export type SearchPostsResponse = {
  posts: SearchPost[];
  pagination: ReturnType<typeof toPagination>;
};
export type SearchUser = {
  id: number;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  stats: { post_count: number; follower_count: number };
  is_following: boolean;
};
export type SearchUsersResponse = {
  users: SearchUser[];
  pagination: ReturnType<typeof toPagination>;
};

const toSearchPost = (post: components['schemas']['SearchPostItem']): SearchPost => {
  if (post.category !== 'food' && post.category !== 'recipe') {
    throw new AppError('服务端返回了无效的搜索结果分类');
  }
  return {
    id: requireNumber(post.id, '帖子 ID'),
    title: requireString(post.title, '帖子标题'),
    content: requireString(post.content, '帖子正文'),
    category: post.category,
    images: post.images ?? [],
    image_thumbs: post.image_thumbs ?? [],
    author: post.author ? {
      id: requireNumber(post.author.id, '作者 ID'),
      name: requireString(post.author.name, '作者名称'),
      avatar_url: post.author.avatar_url ?? null,
    } : undefined,
    stats: {
      like_count: post.stats?.like_count ?? 0,
      comment_count: post.stats?.comment_count ?? 0,
      view_count: post.stats?.view_count ?? 0,
    },
    highlight: post.highlight,
    created_at: requireString(post.created_at, '帖子创建时间'),
  };
};

const toSearchUser = (user: components['schemas']['SearchUserItem']): SearchUser => ({
  id: requireNumber(user.id, '用户 ID'),
  name: requireString(user.name, '用户名称'),
  avatar_url: user.avatar_url ?? null,
  bio: user.bio ?? null,
  stats: {
    post_count: user.stats?.post_count ?? 0,
    follower_count: user.stats?.follower_count ?? 0,
  },
  is_following: user.is_following ?? false,
});

const toQuery = (params: SearchPostsParams | SearchUsersParams) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(','));
      return;
    }
    query.set(key, String(value));
  });
  return query.toString();
};

export const searchRepository = {
  async searchPosts(params: SearchPostsParams): Promise<SearchPostsResponse> {
    const query = toQuery(params);
    const response = await httpAuth.get<ApiResponse<components['schemas']['SearchPostList']>>(
      `${API_ENDPOINTS.SEARCH.POSTS}${query ? `?${query}` : ''}`,
    );
    const payload = unwrapApiResponse(response);
    return {
      posts: (payload.posts ?? []).map(toSearchPost),
      pagination: toPagination(payload.pagination),
    };
  },

  async searchUsers(params: SearchUsersParams): Promise<SearchUsersResponse> {
    const query = toQuery(params);
    const response = await httpAuth.get<ApiResponse<components['schemas']['SearchUserList']>>(
      `${API_ENDPOINTS.SEARCH.USERS}${query ? `?${query}` : ''}`,
    );
    const payload = unwrapApiResponse(response);
    return {
      users: (payload.users ?? []).map(toSearchUser),
      pagination: toPagination(payload.pagination),
    };
  },
};
