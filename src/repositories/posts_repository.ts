import { API_ENDPOINTS } from '@/src/constants/app';
import type { components } from '@/src/generated/openapi';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { httpAuth } from '@/src/lib/http/http_auth';
import { AppError } from '@/src/lib/errors/app_error';
import type { Category, Post, PostCreateInput, PostCreateResult } from '@/src/models/Post';
import {
  requireNumber,
  requireString,
  toCursorPagination,
  toPagination,
  toPost,
  type CursorPagination,
} from '@/src/repositories/api_mappers';

type PostLikeResult = { is_liked: boolean; like_count: number };
type PostFavoriteResult = { is_favorited: boolean; favorite_count: number };
type PostHistoryContract = components['schemas']['PostHistoryView'];

export type PostHistorySnapshot = Record<string, unknown> & {
  title: string;
  content: string;
  category: Category;
  tags?: string[];
  flavors?: string[];
  images?: string[];
};

export type PostHistoryView = {
  id: number;
  revision: number;
  edited_by: number;
  edited_at: string;
  edit_reason: string | null;
  is_current: boolean;
  snapshot: PostHistorySnapshot;
};

export type PostHistoryRestoreInput = { edit_reason?: string };

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
};

const toPostHistorySnapshot = (value: unknown): PostHistorySnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('服务端返回了无效的帖子历史快照');
  }
  const snapshot = value as Record<string, unknown>;
  if (snapshot.category !== 'food' && snapshot.category !== 'recipe') {
    throw new AppError('服务端返回了无效的历史帖子分类');
  }
  return {
    ...snapshot,
    title: requireString(
      typeof snapshot.title === 'string' ? snapshot.title : undefined,
      '历史帖子标题',
    ),
    content: requireString(
      typeof snapshot.content === 'string' ? snapshot.content : undefined,
      '历史帖子正文',
    ),
    category: snapshot.category,
    tags: toStringArray(snapshot.tags),
    flavors: toStringArray(snapshot.flavors),
    images: toStringArray(snapshot.images),
  };
};

const toPostHistory = (history: PostHistoryContract): PostHistoryView => ({
  id: requireNumber(history.id, '历史记录 ID'),
  revision: requireNumber(history.revision, '历史版本号'),
  is_current: history.is_current === true,
  edited_by: requireNumber(history.edited_by, '历史编辑者 ID'),
  edited_at: requireString(history.edited_at, '历史修改时间'),
  edit_reason: history.edit_reason?.trim() || null,
  snapshot: toPostHistorySnapshot(history.snapshot),
});

const toPostCreateResult = (
  result: components['schemas']['PostCreateResult'],
): PostCreateResult => {
  if (
    typeof result.id !== 'number' ||
    (result.post_type !== 'share' && result.post_type !== 'seeking') ||
    !result.status
  ) {
    throw new AppError('服务端返回了无效的帖子操作结果');
  }
  return { id: result.id, post_type: result.post_type, status: result.status };
};

const toPostLikeResult = (
  result: components['schemas']['PostLikeResult'],
): PostLikeResult => ({
  is_liked: result.is_liked ?? false,
  like_count: Math.max(0, result.like_count ?? 0),
});

const toPostFavoriteResult = (
  result: components['schemas']['PostFavoriteResult'],
): PostFavoriteResult => ({
  is_favorited: result.is_favorited ?? false,
  favorite_count: Math.max(0, result.favorite_count ?? 0),
});

export interface PostsRepository {
  create(input: PostCreateInput): Promise<PostCreateResult>;
  list(filters?: PostListFilters): Promise<PostsListResponse>;
  get(postId: number): Promise<Post>;
  update(postId: number, input: PostCreateInput): Promise<PostCreateResult>;
  delete(postId: number): Promise<void>;
  history(postId: number): Promise<PostHistoryView[]>;
  restoreHistory(
    postId: number,
    revision: number,
    input?: PostHistoryRestoreInput,
  ): Promise<PostCreateResult>;
  like(postId: number): Promise<PostLikeResult>;
  unlike(postId: number): Promise<PostLikeResult>;
  favorite(postId: number): Promise<PostFavoriteResult>;
  unfavorite(postId: number): Promise<PostFavoriteResult>;
}

export type SortBy = 'latest' | 'hot' | 'trending';

export type PostListFilters = {
  sortBy?: SortBy;
  cursor?: string;
  page?: number;
  limit?: number;
};

export type PostsListResponse = {
  posts: Post[];
  pagination: CursorPagination | { page: number; limit: number; total: number; total_pages: number };
};

class ApiPostsRepository implements PostsRepository {
  async create(input: PostCreateInput): Promise<PostCreateResult> {
    const resp = await httpAuth.post<ApiResponse<components['schemas']['PostCreateResult']>>(
      API_ENDPOINTS.POSTS.CREATEPOST,
      input satisfies components['schemas']['createPostRequest'],
    );
    return toPostCreateResult(unwrapApiResponse(resp));
  }

  async list(filters: PostListFilters = {}): Promise<PostsListResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value != null) qs.set(key === 'sortBy' ? 'sort_by' : key, String(value));
    }
    const path = `${API_ENDPOINTS.POSTS.GETPOSTPRE}${qs.size ? `?${qs.toString()}` : ''}`;
    const resp = await httpAuth.get<ApiResponse<components['schemas']['PostFeedList']>>(path);
    const data = unwrapApiResponse(resp);
    return {
      posts: (data.posts ?? []).map(toPost),
      pagination: data.pagination && 'has_more' in data.pagination
        ? toCursorPagination(data.pagination)
        : toPagination(data.pagination),
    };
  }

  async get(postId: number): Promise<Post> {
    const path = API_ENDPOINTS.POSTS.GETPOSTALL.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.get<ApiResponse<components['schemas']['PostDetail']>>(path);
    return toPost(unwrapApiResponse(resp));
  }

  async update(postId: number, input: PostCreateInput): Promise<PostCreateResult> {
    const path = API_ENDPOINTS.POSTS.UPDATEPOST.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.put<ApiResponse<components['schemas']['PostCreateResult']>>(
      path,
      input satisfies components['schemas']['updatePostRequest'],
    );
    return toPostCreateResult(unwrapApiResponse(resp));
  }

  async delete(postId: number): Promise<void> {
    const path = API_ENDPOINTS.POSTS.DELETEPOST.replace(':postId', encodeURIComponent(String(postId)));
    unwrapApiResponse(await httpAuth.delete<ApiResponse<null>>(path));
  }

  async history(postId: number): Promise<PostHistoryView[]> {
    const path = API_ENDPOINTS.POSTS.HISTORY.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.get<ApiResponse<components['schemas']['PostHistoryList']>>(path);
    return (unwrapApiResponse(resp).histories ?? []).map(toPostHistory);
  }

  async restoreHistory(
    postId: number,
    revision: number,
    input: PostHistoryRestoreInput = {},
  ): Promise<PostCreateResult> {
    const historyPath = API_ENDPOINTS.POSTS.HISTORY.replace(
      ':postId',
      encodeURIComponent(String(postId)),
    );
    const path = `${historyPath}/${encodeURIComponent(String(revision))}/restore`;
    const resp = await httpAuth.post<ApiResponse<components['schemas']['PostCreateResult']>>(
      path,
      input,
    );
    return toPostCreateResult(unwrapApiResponse(resp));
  }

  async like(postId: number): Promise<PostLikeResult> {
    const path = API_ENDPOINTS.POSTS.LIKEPOST.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.post<ApiResponse<components['schemas']['PostLikeResult']>>(path, {});
    return toPostLikeResult(unwrapApiResponse(resp));
  }

  async unlike(postId: number): Promise<PostLikeResult> {
    const path = API_ENDPOINTS.POSTS.UNLIKEPOST.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.delete<ApiResponse<components['schemas']['PostLikeResult']>>(path);
    return toPostLikeResult(unwrapApiResponse(resp));
  }

  async favorite(postId: number): Promise<PostFavoriteResult> {
    const path = API_ENDPOINTS.POSTS.FAVORITEPOST.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.post<ApiResponse<components['schemas']['PostFavoriteResult']>>(path, {});
    return toPostFavoriteResult(unwrapApiResponse(resp));
  }

  async unfavorite(postId: number): Promise<PostFavoriteResult> {
    const path = API_ENDPOINTS.POSTS.UNFAVORITEPOST.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.delete<ApiResponse<components['schemas']['PostFavoriteResult']>>(path);
    return toPostFavoriteResult(unwrapApiResponse(resp));
  }
}

export const postsRepository: PostsRepository = new ApiPostsRepository();
