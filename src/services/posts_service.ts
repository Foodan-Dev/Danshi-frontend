import { postsRepository } from '@/src/repositories/posts_repository';
import type { PostCreateInput, PostCreateResult } from '@/src/models/Post';
import type { PostListFilters, PostsListResponse } from '@/src/repositories/posts_repository';
import { AppError } from '@/src/lib/errors/app_error';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';

function ensureHttpUrls(arr?: string[], label?: string) {
  if (!arr) return;
  for (const u of arr) {
    const s = (u ?? '').trim();
    if (!s) throw new AppError(`${label ?? '链接'} 不能为空`);
    if (!isHttpOrHttpsUrl(s)) throw new AppError(`${label ?? '链接'} 需为 http(s) URL`);
  }
}

function normalizePostInput(input: PostCreateInput): PostCreateInput {
  if (input.post_type === 'share') {
    return {
      ...input,
      title: input.title.trim(),
      content: input.content.trim(),
      canteen_code: input.canteen_code?.trim() || input.canteen_code,
      tags: input.tags?.map((tag) => tag.trim()).filter(Boolean),
      cuisine: input.cuisine?.trim() || input.cuisine,
      images: input.images.map((url) => url.trim()).filter(Boolean),
    };
  }
  return {
    ...input,
    title: input.title.trim(),
    content: input.content.trim(),
    canteen_code: input.canteen_code?.trim() || input.canteen_code,
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean),
    images: input.images?.map((url) => url.trim()).filter(Boolean),
  };
}

function validate(input: PostCreateInput) {
  const title = input.title?.trim() ?? '';
  const content = input.content?.trim() ?? '';
  if (!title) throw new AppError('请输入标题');
  if (title.length < 2) throw new AppError('标题至少 2 个字');
  if (!content) throw new AppError('请输入正文内容');
  if (content.length < 5) throw new AppError('正文至少 5 个字');

  const category = input.category;
  if (!['food', 'recipe'].includes(category)) throw new AppError('分区类型错误（需为 food/recipe）');

  if (input.tags && input.tags.length > 10) throw new AppError('标签最多 10 个');

  switch (input.post_type) {
    case 'share': {
      if (!input.share_type || !['recommend', 'warning'].includes(input.share_type)) {
        throw new AppError('分享类型缺失或不合法（recommend/warning）');
      }
      if (!input.images || input.images.length < 1) throw new AppError('请至少上传 1 张图片');
      if (input.images.length > 9) throw new AppError('最多上传 9 张图片');
      ensureHttpUrls(input.images, '图片 URL');
      if (input.price !== undefined && !/^(?:0|[0-9]+)(?:\.[0-9]{1,2})?$/.test(input.price)) {
        throw new AppError('价格格式不正确，最多保留两位小数');
      }
      break;
    }
    case 'seeking': {
      // images 可为空
      if (input.images && input.images.length > 9) throw new AppError('最多上传 9 张图片');
      ensureHttpUrls(input.images, '图片 URL');
      if (input.budget_range) {
        const { min, max } = input.budget_range;
        if (min < 0 || max < 0) throw new AppError('预算不能为负数');
        if (max < min) throw new AppError('预算上限需大于等于下限');
      }
      break;
    }
    default:
      throw new AppError('帖子类型不合法');
  }
}

export const postsService = {
  async list(filters: PostListFilters = {}): Promise<PostsListResponse> {
    const sortBy = filters.sortBy && ['latest', 'hot', 'trending'].includes(filters.sortBy)
      ? filters.sortBy
      : undefined;
    const cleaned: PostListFilters = {
      sortBy,
      limit: filters.limit && filters.limit > 0 ? Math.floor(filters.limit) : 20,
    };
    if (!sortBy || sortBy === 'latest') {
      if (filters.cursor?.trim()) cleaned.cursor = filters.cursor.trim();
    } else {
      cleaned.page = filters.page && filters.page > 0 ? Math.floor(filters.page) : 1;
    }
    return postsRepository.list(cleaned);
  },

  async get(postId: number) {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子 ID');
    return postsRepository.get(postId);
  },

  async create(input: PostCreateInput): Promise<PostCreateResult> {
    // 规范化可选字段：去除多余空白
    const normalized = normalizePostInput(input);

    validate(normalized);
    return postsRepository.create(normalized);
  },

  async update(postId: number, input: PostCreateInput): Promise<PostCreateResult> {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子 ID');
    const normalized = normalizePostInput(input);
    validate(normalized);
    return postsRepository.update(postId, normalized);
  },

  async remove(postId: number): Promise<void> {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子 ID');
    return postsRepository.delete(postId);
  },

  async like(postId: number) {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子 ID');
    return postsRepository.like(postId);
  },

  async unlike(postId: number) {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子 ID');
    return postsRepository.unlike(postId);
  },

  async favorite(postId: number) {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子 ID');
    return postsRepository.favorite(postId);
  },

  async unfavorite(postId: number) {
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new AppError('缺少有效的帖子 ID');
    return postsRepository.unfavorite(postId);
  },

};
