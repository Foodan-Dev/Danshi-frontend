import type { Post, PostType, ShareType } from '@/src/models/Post';
import type { UserPostListItem } from '@/src/repositories/users_repository';

export type PostAuthorInfo = {
  id: string;
  name: string;
  avatar_url?: string;
};

const normalizeImages = (item: UserPostListItem) => {
  if (item.images?.length) return item.images;
  if (item.cover_image) return [item.cover_image];
  return [];
};

const normalizeCategory = (category?: string): 'food' | 'recipe' => {
  return category === 'recipe' ? 'recipe' : 'food';
};

const normalizeShareType = (value?: string): ShareType => {
  return value === 'warning' ? 'warning' : 'recommend';
};

const buildStats = (item: UserPostListItem) => ({
  like_count: item.stats?.like_count ?? item.like_count ?? 0,
  view_count: item.stats?.view_count ?? item.view_count ?? 0,
  comment_count: item.stats?.comment_count ?? item.comment_count ?? 0,
  favorite_count: item.stats?.favorite_count ?? item.favorite_count ?? 0,
});

export function mapUserPostListItemToPost(
  item: UserPostListItem,
  options?: { forceFavorite?: boolean; author?: PostAuthorInfo }
): Post {
  const images = normalizeImages(item);
  const stats = buildStats(item);
  const postType: PostType = item.post_type === 'seeking' ? 'seeking' : 'share';
  // 优先使用 options.author，其次使用 item.author
  const author = options?.author || item.author;
  const base = {
    id: item.id,
    title: item.title,
    content: item.content || '',
    category: normalizeCategory(item.category),
    canteen: item.canteen,
    tags: item.tags,
    images,
    author,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || item.created_at || new Date().toISOString(),
    stats,
    is_liked: item.is_liked || false,
    is_favorited: options?.forceFavorite ? true : item.is_favorited || false,
  };

  if (postType === 'seeking') {
    return {
      ...base,
      post_type: 'seeking',
    };
  }

  return {
    ...base,
    post_type: 'share',
    share_type: normalizeShareType(item.share_type),
    price: typeof item.price === 'number' ? item.price : undefined,
  };
}
