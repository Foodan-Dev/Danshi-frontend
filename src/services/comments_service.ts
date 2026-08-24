import { AppError } from '@/src/lib/errors/app_error';
import {
  commentsRepository,
  type CommentListParams,
  type CommentRepliesParams,
  type UpdateCommentInput,
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
  const parent_id = input.parent_id;
  const reply_to_user_id = input.reply_to_user_id;
  const mentioned_user_ids = Array.from(
    new Set((input.mentioned_user_ids ?? []).filter((id) => Number.isSafeInteger(id) && id > 0)),
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
  async listByPost(postId: number, params: CommentListParams = {}) {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子ID');
    return commentsRepository.listByPost(postId, sanitizePagination(params));
  },

  async listReplies(commentId: number, params: CommentRepliesParams = {}) {
    if (!Number.isSafeInteger(commentId) || commentId <= 0) throw new AppError('缺少有效的评论ID');
    return commentsRepository.listReplies(commentId, sanitizePagination(params));
  },

  async create(postId: number, input: CreateCommentInput) {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子ID');
    const payload = sanitizeCreateInput(input);
    return commentsRepository.create(postId, payload);
  },

  async update(commentId: number, input: UpdateCommentInput) {
    if (!Number.isSafeInteger(commentId) || commentId <= 0) throw new AppError('缺少有效的评论ID');
    const content = input.content?.trim() ?? '';
    if (!content) throw new AppError('请输入评论内容');
    if (content.length > MAX_COMMENT_LENGTH) throw new AppError(`评论内容请勿超过 ${MAX_COMMENT_LENGTH} 字`);
    const mentioned_user_ids = Array.from(
      new Set((input.mentioned_user_ids ?? []).filter((id) => Number.isSafeInteger(id) && id > 0)),
    );
    return commentsRepository.update(commentId, { content, mentioned_user_ids });
  },

  async like(commentId: number) {
    if (!Number.isSafeInteger(commentId) || commentId <= 0) throw new AppError('缺少有效的评论ID');
    return commentsRepository.like(commentId);
  },

  async unlike(commentId: number) {
    if (!Number.isSafeInteger(commentId) || commentId <= 0) throw new AppError('缺少有效的评论ID');
    return commentsRepository.unlike(commentId);
  },

  async remove(commentId: number) {
    if (!Number.isSafeInteger(commentId) || commentId <= 0) throw new AppError('缺少有效的评论ID');
    return commentsRepository.delete(commentId);
  },
};
