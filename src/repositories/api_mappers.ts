import type { components } from '@/src/generated/openapi';
import { AppError } from '@/src/lib/errors/app_error';
import type { Comment } from '@/src/models/Comment';
import type { Post, PostAuthor, PostCanteen, PostCanteenWindow } from '@/src/models/Post';

type PostContract = components['schemas']['PostListItem'] | components['schemas']['PostDetail'];
type CommentContract = components['schemas']['CommentItem'];
type MetaContract = components['schemas']['Meta'];
type CursorMetaContract = components['schemas']['CursorMeta'];

export const requireString = (value: string | null | undefined, field: string): string => {
  if (typeof value !== 'string' || !value) throw new AppError(`服务端响应缺少 ${field}`);
  return value;
};

export const requireNumber = (value: number | null | undefined, field: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new AppError(`服务端响应缺少有效的 ${field}`);
  }
  return value;
};

export const toPagination = (meta: MetaContract | undefined) => ({
  page: meta?.page ?? 1,
  limit: meta?.limit ?? 20,
  total: meta?.total ?? 0,
  total_pages: meta?.total_pages ?? 1,
});

export type CursorPagination = {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
};

export const toCursorPagination = (meta: CursorMetaContract | undefined): CursorPagination => ({
  limit: meta?.limit ?? 20,
  next_cursor: meta?.next_cursor ?? null,
  has_more: meta?.has_more ?? false,
});

const toPostAuthor = (
  author: components['schemas']['PostAuthorView'] | undefined,
): PostAuthor | undefined => {
  if (!author?.id || !author.name) return undefined;
  return {
    id: author.id,
    name: author.name,
    avatar_url: author.avatar_url ?? null,
    is_following: author.is_following ?? null,
  };
};

const toCanteen = (
  canteen: components['schemas']['CanteenView'] | undefined,
): PostCanteen | null => {
  if (!canteen?.code || !canteen.name || !canteen.campus) return null;
  return { code: canteen.code, name: canteen.name, campus: canteen.campus };
};

const toCanteenWindow = (
  window: components['schemas']['CanteenWindowView'] | undefined,
): PostCanteenWindow | null => {
  if (!window?.id || !window.name) return null;
  return { id: window.id, name: window.name, floor: window.floor ?? null };
};

export function toPost(post: PostContract): Post {
  const id = requireNumber(post.id, '帖子 ID');
  const title = requireString(post.title, '帖子标题');
  const content = requireString(post.content, '帖子正文');
  if (post.category !== 'food' && post.category !== 'recipe') {
    throw new AppError('服务端返回了无效的帖子分类');
  }
  if (post.post_type !== 'share' && post.post_type !== 'seeking') {
    throw new AppError('服务端返回了无效的帖子类型');
  }

  const base = {
    id,
    post_type: post.post_type,
    title,
    content,
    category: post.category,
    canteen: toCanteen(post.canteen),
    canteen_window: toCanteenWindow(post.canteen_window),
    cuisine: post.cuisine ?? undefined,
    flavors: post.flavors ?? [],
    tags: post.tags ?? [],
    images: post.images ?? [],
    author: toPostAuthor(post.author),
    stats: {
      like_count: post.stats?.like_count ?? 0,
      favorite_count: post.stats?.favorite_count ?? 0,
      comment_count: post.stats?.comment_count ?? 0,
      view_count: post.stats?.view_count ?? 0,
    },
    is_liked: post.is_liked ?? false,
    is_favorited: post.is_favorited ?? false,
    created_at: post.created_at,
    updated_at: post.updated_at,
    status: post.status,
    is_edited: post.is_edited ?? false,
  };

  if (post.post_type === 'seeking') {
    const budgetRange = 'budget_range' in post ? post.budget_range : undefined;
    const preferences = 'preferences' in post ? post.preferences : undefined;
    return {
      ...base,
      post_type: 'seeking',
      budget_range: budgetRange?.min !== undefined && budgetRange.max !== undefined
        ? { min: budgetRange.min, max: budgetRange.max }
        : undefined,
      preferences: preferences
        ? {
            prefer_flavors: preferences.prefer_flavors ?? [],
            avoid_flavors: preferences.avoid_flavors ?? [],
          }
        : undefined,
    };
  }

  return {
    ...base,
    post_type: 'share',
    share_type: post.share_type === 'warning' ? 'warning' : 'recommend',
    price: post.price ?? undefined,
    images: post.images ?? [],
  };
}

const toCommentAuthor = (
  author: components['schemas']['CommentAuthorView'] | undefined,
) => {
  if (!author) return undefined;
  return {
    id: requireNumber(author.id, '评论作者 ID'),
    name: requireString(author.name, '评论作者名称'),
    avatar_url: author.avatar_url ?? null,
  };
};

export function toComment(comment: CommentContract): Comment {
  return {
    id: requireNumber(comment.id, '评论 ID'),
    content: comment.content ?? '',
    author: toCommentAuthor(comment.author),
    mentioned_users: (comment.mentioned_users ?? []).map((user) => ({
      id: requireNumber(user.id, '被提及用户 ID'),
      name: requireString(user.name, '被提及用户名称'),
    })),
    like_count: comment.like_count ?? 0,
    is_liked: comment.is_liked ?? false,
    is_author: comment.is_author ?? false,
    reply_to: comment.reply_to?.id && comment.reply_to.name
      ? { id: comment.reply_to.id, name: comment.reply_to.name }
      : null,
    created_at: requireString(comment.created_at, '评论创建时间'),
    is_edited: comment.is_edited ?? false,
    reply_count: comment.reply_count ?? 0,
    replies: (comment.replies ?? []).map(toComment),
  };
}
