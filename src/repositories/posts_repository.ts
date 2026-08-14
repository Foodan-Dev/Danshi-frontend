import { API_ENDPOINTS } from '@/src/constants/app';
import { unwrapApiResponse } from '@/src/lib/http/response';
import { httpAuth } from '@/src/lib/http/http_auth';
import type {
  Post,
  PostCreateInput,
  PostCreateResult,
  PostStats,
} from '@/src/models/Post';

type PostApiShape = Post & Partial<PostStats>;
type PostLikeApiResult = {
  is_liked?: boolean;
  isLiked?: boolean;
  like_count?: number;
  likeCount?: number;
};

type PostLikeResult = { is_liked: boolean; like_count: number };

const normalizePostLikeResult = (result: PostLikeApiResult): PostLikeResult => {
  const isLiked = result.is_liked ?? result.isLiked ?? false;
  const likeCount = result.like_count ?? result.likeCount ?? 0;
  return { is_liked: isLiked, like_count: Math.max(0, likeCount) };
};

const normalizePost = (post: PostApiShape): Post => {
  const isLiked = post.is_liked ?? false;
  const likeCount = post.stats?.like_count ?? post.like_count ?? 0;
  return {
    ...post,
    stats: {
      ...(post.stats ?? {}),
      like_count: isLiked ? Math.max(1, likeCount) : Math.max(0, likeCount),
      favorite_count: post.stats?.favorite_count ?? post.favorite_count ?? 0,
      comment_count: post.stats?.comment_count ?? post.comment_count ?? 0,
      view_count: post.stats?.view_count ?? post.view_count ?? 0,
    },
    is_liked: isLiked,
    is_favorited: post.is_favorited ?? false,
  };
};

export interface PostsRepository {
  create(input: PostCreateInput): Promise<PostCreateResult>;
  list(filters?: PostListFilters): Promise<PostsListResponse>;
  get(postId: string): Promise<Post>;
  update(postId: string, input: PostCreateInput): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' }>;
  delete(postId: string): Promise<void>;
  like(postId: string): Promise<PostLikeResult>;
  unlike(postId: string): Promise<PostLikeResult>;
  favorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }>;
  unfavorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }>;
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
    const resp = await httpAuth.post(API_ENDPOINTS.POSTS.CREATEPOST, input);
    return unwrapApiResponse<PostCreateResult>(resp, 200);
  }

  async list(filters: PostListFilters = {}): Promise<PostsListResponse> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v == null) continue;
      if (!['page', 'limit', 'sortBy'].includes(k)) continue;

      if (Array.isArray(v)) {
        if (v.length) qs.set(k, v.join(','));
      } else {
        qs.set(k, String(v));
      }
    }
    const path = `${API_ENDPOINTS.POSTS.GETPOSTPRE}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const resp = await httpAuth.get(path);
    const data = unwrapApiResponse<PostsListResponse>(resp, 200);
    return { ...data, posts: data.posts.map(normalizePost) };
  }

  async get(postId: string): Promise<Post> {
    const path = API_ENDPOINTS.POSTS.GETPOSTALL.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.get(path);
    const data = unwrapApiResponse<PostApiShape>(resp, 200);
    return normalizePost(data);
  }

  async update(postId: string, input: PostCreateInput): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' }> {
    const path = API_ENDPOINTS.POSTS.UPDATEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.put(path, input);
    return unwrapApiResponse<{ id: string; status: 'pending' | 'approved' | 'rejected' }>(resp, 200);
  }

  async delete(postId: string): Promise<void> {
    const path = API_ENDPOINTS.POSTS.DELETEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.delete(path);
    unwrapApiResponse<null>(resp, 200);
  }

  async like(postId: string): Promise<PostLikeResult> {
    const path = API_ENDPOINTS.POSTS.LIKEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.post(path, {});
    const data = unwrapApiResponse<PostLikeApiResult>(resp, 200);
    return normalizePostLikeResult(data);
  }

  async unlike(postId: string): Promise<PostLikeResult> {
    const path = API_ENDPOINTS.POSTS.UNLIKEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.delete(path);
    const data = unwrapApiResponse<PostLikeApiResult>(resp, 200);
    return normalizePostLikeResult(data);
  }

  async favorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }> {
    const path = API_ENDPOINTS.POSTS.FAVORITEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.post(path, {});
    return unwrapApiResponse<{ is_favorited: boolean; favorite_count: number }>(resp, 200);
  }

  async unfavorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }> {
    const path = API_ENDPOINTS.POSTS.UNFAVORITEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.delete(path);
    return unwrapApiResponse<{ is_favorited: boolean; favorite_count: number }>(resp, 200);
  }

}

export const postsRepository: PostsRepository = new ApiPostsRepository();
