import type { Post } from '@/src/models/Post';
import type { UserPostListItem } from '@/src/repositories/users_repository';

export type PostAuthorInfo = {
  id: number;
  name: string;
  avatar_url?: string | null;
};

export function mapUserPostListItemToPost(
  item: UserPostListItem,
  options?: { forceFavorite?: boolean; author?: PostAuthorInfo },
): Post {
  return {
    ...item,
    author: options?.author ?? item.author,
    is_favorited: options?.forceFavorite ? true : item.is_favorited,
  };
}
