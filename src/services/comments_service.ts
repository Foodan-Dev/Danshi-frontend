import { AppError } from '@/src/lib/errors/app_error';
import {
  commentsRepository,
  type CommentListParams,
  type CommentRepliesParams,
} from '@/src/repositories/comments_repository';
import type { CreateCommentInput, CommentSort } from '@/src/models/Comment';

const MAX_COMMENT_LENGTH = 500;

function sanitizePagination<T extends { page?: number; limit?: number; sortBy?: CommentSort }>(params: T): T {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : undefined;
  const limit = params.limit && params.limit > 0 ? Math.floor(params.limit) : undefined;
  const sortBy = params.sortBy && ['latest', 'hot'].includes(params.sortBy) ? params.sortBy : undefined;
  return {
    ...params,
    ...(page ? { page } : {}),
    ...(limit ? { limit } : {}),
    ...(sortBy ? { sortBy: sortBy as CommentSort } : {}),
  } as T;
}

function sanitizeCreateInput(input: CreateCommentInput): CreateCommentInput {
  const content = input.content?.trim() ?? '';
  const parent_id = input.parent_id?.trim() || undefined;
  const reply_to_user_id = input.reply_to_user_id?.trim() || undefined;
  const mentioned_user_ids = Array.from(
    new Set((input.mentioned_user_ids ?? []).map((id) => id.trim()).filter(Boolean))
  );

  if (!content) throw new AppError('请输入评论内容');
  if (content.length > MAX_COMMENT_LENGTH) throw new AppError(`评论内容请勿超过 ${MAX_COMMENT_LENGTH} 字`);
  if (parent_id && !reply_to_user_id) throw new AppError('回复评论时需要指定回复对象');
  if (reply_to_user_id && !parent_id) throw new AppError('缺少父评论ID');

  return {
    content,
    parent_id,
    reply_to_user_id,
    mentioned_user_ids,
  };
}

export const commentsService = {
  async listByPost(postId: string, params: CommentListParams = {}) {
    if (!postId?.trim()) throw new AppError('缺少帖子ID');
    return commentsRepository.listByPost(postId.trim(), sanitizePagination(params));
  },

  async listReplies(commentId: string, params: CommentRepliesParams = {}) {
    if (!commentId?.trim()) throw new AppError('缺少评论ID');
    return commentsRepository.listReplies(commentId.trim(), sanitizePagination(params));
  },

  async create(postId: string, input: CreateCommentInput) {
    if (!postId?.trim()) throw new AppError('缺少帖子ID');
    const payload = sanitizeCreateInput(input);
    return commentsRepository.create(postId.trim(), payload);
  },

  async like(commentId: string) {
    if (!commentId?.trim()) throw new AppError('缺少评论ID');
    return commentsRepository.like(commentId.trim());
  },

  async unlike(commentId: string) {
    if (!commentId?.trim()) throw new AppError('缺少评论ID');
    return commentsRepository.unlike(commentId.trim());
  },

  async remove(commentId: string) {
    if (!commentId?.trim()) throw new AppError('缺少评论ID');
    return commentsRepository.delete(commentId.trim());
  },
};
