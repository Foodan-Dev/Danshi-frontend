import { API_ENDPOINTS } from '@/src/constants/app';
import type { components } from '@/src/generated/openapi';
import { AppError } from '@/src/lib/errors/app_error';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type {
  CommentEntity,
  CommentRepliesResponse,
  CommentsListResponse,
  CommentSort,
  CreateCommentInput,
} from '@/src/models/Comment';
import { toComment, toCursorPagination } from '@/src/repositories/api_mappers';

export type CommentListParams = {
  cursor?: string;
  limit?: number;
  sortBy?: CommentSort;
};

export type CommentRepliesParams = {
  cursor?: string;
  limit?: number;
};

export type CommentLikeResult = { is_liked: boolean; like_count: number };
export type UpdateCommentInput = Pick<CreateCommentInput, 'content' | 'mentioned_user_ids'>;

export interface CommentsRepository {
  listByPost(postId: number, params?: CommentListParams): Promise<CommentsListResponse>;
  listReplies(commentId: number, params?: CommentRepliesParams): Promise<CommentRepliesResponse>;
  create(postId: number, payload: CreateCommentInput): Promise<CommentEntity>;
  update(commentId: number, payload: UpdateCommentInput): Promise<CommentEntity>;
  like(commentId: number): Promise<CommentLikeResult>;
  unlike(commentId: number): Promise<CommentLikeResult>;
  delete(commentId: number): Promise<void>;
}

class ApiCommentsRepository implements CommentsRepository {
  private buildQuery(params?: Record<string, unknown>) {
    const qs = new URLSearchParams();
    if (!params) return '';
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || !['cursor', 'limit', 'sortBy'].includes(key)) return;
      qs.append(key === 'sortBy' ? 'sort_by' : key, String(value));
    });
    return qs.size ? `?${qs.toString()}` : '';
  }

  async listByPost(postId: number, params: CommentListParams = {}): Promise<CommentsListResponse> {
    const path = API_ENDPOINTS.COMMENTS.LIST_FOR_POST.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.get<ApiResponse<components['schemas']['CommentList']>>(
      `${path}${this.buildQuery(params)}`,
    );
    const data = unwrapApiResponse(resp);
    return {
      comments: (data.comments ?? []).map(toComment),
      pagination: toCursorPagination(data.pagination),
    };
  }

  async listReplies(commentId: number, params: CommentRepliesParams = {}): Promise<CommentRepliesResponse> {
    const path = API_ENDPOINTS.COMMENTS.LIST_REPLIES.replace(':commentId', encodeURIComponent(String(commentId)));
    const resp = await httpAuth.get<ApiResponse<components['schemas']['CommentReplies']>>(
      `${path}${this.buildQuery(params)}`,
    );
    const data = unwrapApiResponse(resp);
    return {
      replies: (data.replies ?? []).map(toComment),
      pagination: toCursorPagination(data.pagination),
    };
  }

  async create(postId: number, payload: CreateCommentInput): Promise<CommentEntity> {
    const path = API_ENDPOINTS.COMMENTS.CREATE.replace(':postId', encodeURIComponent(String(postId)));
    const resp = await httpAuth.post<ApiResponse<components['schemas']['CommentMutationResult']>>(
      path,
      payload satisfies components['schemas']['createCommentRequest'],
    );
    const comment = unwrapApiResponse(resp).comment;
    if (!comment) throw new AppError('服务端响应缺少评论信息');
    return toComment(comment);
  }

  async update(commentId: number, payload: UpdateCommentInput): Promise<CommentEntity> {
    const path = API_ENDPOINTS.COMMENTS.UPDATE.replace(':commentId', encodeURIComponent(String(commentId)));
    const resp = await httpAuth.put<ApiResponse<components['schemas']['CommentMutationResult']>>(
      path,
      payload satisfies components['schemas']['updateCommentRequest'],
    );
    const comment = unwrapApiResponse(resp).comment;
    if (!comment) throw new AppError('服务端响应缺少评论信息');
    return toComment(comment);
  }

  async like(commentId: number): Promise<CommentLikeResult> {
    const path = API_ENDPOINTS.COMMENTS.LIKE.replace(':commentId', encodeURIComponent(String(commentId)));
    const resp = await httpAuth.post<ApiResponse<components['schemas']['CommentLikeResult']>>(path, {});
    const result = unwrapApiResponse(resp);
    return { is_liked: result.is_liked ?? false, like_count: Math.max(0, result.like_count ?? 0) };
  }

  async unlike(commentId: number): Promise<CommentLikeResult> {
    const path = API_ENDPOINTS.COMMENTS.UNLIKE.replace(':commentId', encodeURIComponent(String(commentId)));
    const resp = await httpAuth.delete<ApiResponse<components['schemas']['CommentLikeResult']>>(path);
    const result = unwrapApiResponse(resp);
    return { is_liked: result.is_liked ?? false, like_count: Math.max(0, result.like_count ?? 0) };
  }

  async delete(commentId: number): Promise<void> {
    const path = API_ENDPOINTS.COMMENTS.DELETE.replace(':commentId', encodeURIComponent(String(commentId)));
    unwrapApiResponse(await httpAuth.delete<ApiResponse<null>>(path));
  }
}

export const commentsRepository: CommentsRepository = new ApiCommentsRepository();
