import { API_ENDPOINTS } from '@/src/constants/app';
import type { components } from '@/src/generated/openapi';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { httpAuth } from '@/src/lib/http/http_auth';
import { AppError } from '@/src/lib/errors/app_error';
import type { Post, PostCreateInput, PostCreateResult } from '@/src/models/Post';
import { toPagination, toPost } from '@/src/repositories/api_mappers';

type PostLikeResult = { is_liked: boolean; like_count: number };
type PostFavoriteResult = { is_favorited: boolean; favorite_count: number };

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
  like(postId: number): Promise<PostLikeResult>;
  unlike(postId: number): Promise<PostLikeResult>;
  favorite(postId: number): Promise<PostFavoriteResult>;
  unfavorite(postId: number): Promise<PostFavoriteResult>;
}

export type SortBy = 'latest' | 'hot' | 'trending';

export type PostListFilters = {
  sortBy?: SortBy;
  page?: number;
  limit?: number;
};

export type PostsListResponse = {
  posts: Post[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
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
      if (value != null) qs.set(key, String(value));
    }
    const path = `${API_ENDPOINTS.POSTS.GETPOSTPRE}${qs.size ? `?${qs.toString()}` : ''}`;
    const resp = await httpAuth.get<ApiResponse<components['schemas']['PostList']>>(path);
    const data = unwrapApiResponse(resp);
    return {
      posts: (data.posts ?? []).map(toPost),
      pagination: toPagination(data.pagination),
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
