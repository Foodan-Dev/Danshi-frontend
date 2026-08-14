import { API_ENDPOINTS } from '@/src/constants/app';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse } from '@/src/lib/http/response';
import type {
  CommentEntity,
  CommentRepliesResponse,
  CommentsListResponse,
  CommentSort,
  CreateCommentInput,
} from '@/src/models/Comment';

export type CommentListParams = {
  page?: number;
  limit?: number;
  sortBy?: CommentSort;
};

export type CommentRepliesParams = {
  page?: number;
  limit?: number;
};

export type CommentLikeResult = { is_liked: boolean; like_count: number };

export interface CommentsRepository {
  listByPost(postId: string, params?: CommentListParams): Promise<CommentsListResponse>;
  listReplies(commentId: string, params?: CommentRepliesParams): Promise<CommentRepliesResponse>;
  create(postId: string, payload: CreateCommentInput): Promise<CommentEntity>;
  like(commentId: string): Promise<CommentLikeResult>;
  unlike(commentId: string): Promise<CommentLikeResult>;
  delete(commentId: string): Promise<void>;
}

class ApiCommentsRepository implements CommentsRepository {
  private buildQuery(params?: Record<string, unknown>) {
    const qs = new URLSearchParams();
    if (!params) return '';
    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;
      if (!['page', 'limit', 'sortBy'].includes(key)) return;
      qs.append(key, String(value));
    });
    const str = qs.toString();
    return str ? `?${str}` : '';
  }

  async listByPost(postId: string, params: CommentListParams = {}): Promise<CommentsListResponse> {
    const path = API_ENDPOINTS.COMMENTS.LIST_FOR_POST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.get(`${path}${this.buildQuery(params)}`);
    return unwrapApiResponse<CommentsListResponse>(resp, 200);
  }

  async listReplies(commentId: string, params: CommentRepliesParams = {}): Promise<CommentRepliesResponse> {
    const path = API_ENDPOINTS.COMMENTS.LIST_REPLIES.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.get(`${path}${this.buildQuery(params)}`);
    return unwrapApiResponse<CommentRepliesResponse>(resp, 200);
  }

  async create(postId: string, payload: CreateCommentInput): Promise<CommentEntity> {
    const path = API_ENDPOINTS.COMMENTS.CREATE.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.post(path, payload);
    return unwrapApiResponse<CommentEntity>(resp, 200);
  }

  async like(commentId: string): Promise<CommentLikeResult> {
    const path = API_ENDPOINTS.COMMENTS.LIKE.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.post(path, {});
    return unwrapApiResponse<CommentLikeResult>(resp, 200);
  }

  async unlike(commentId: string): Promise<CommentLikeResult> {
    const path = API_ENDPOINTS.COMMENTS.UNLIKE.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.delete(path);
    return unwrapApiResponse<CommentLikeResult>(resp, 200);
  }

  async delete(commentId: string): Promise<void> {
    const path = API_ENDPOINTS.COMMENTS.DELETE.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.delete(path);
    unwrapApiResponse<null>(resp, 200);
  }
}

export const commentsRepository: CommentsRepository = new ApiCommentsRepository();
