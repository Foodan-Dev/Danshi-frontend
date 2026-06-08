import type { Post } from '@/src/models/Post';
import type { UserPostListItem } from '@/src/repositories/users_repository';

export type PostLikePatch = {
  is_liked: boolean;
  like_count: number;
};

export function applyPostLikePatch(post: Post, patch: PostLikePatch): Post {
  return {
    ...post,
    is_liked: patch.is_liked,
    stats: {
      ...(post.stats ?? {}),
      like_count: patch.like_count,
    },
  };
}

export function patchPostListLike(posts: Post[], postId: string, patch: PostLikePatch): Post[] {
  return posts.map((post) => (post.id === postId ? applyPostLikePatch(post, patch) : post));
}

export function patchUserPostListItemLike(item: UserPostListItem, patch: PostLikePatch): UserPostListItem {
  return {
    ...item,
    is_liked: patch.is_liked,
    like_count: patch.like_count,
    stats: {
      ...(item.stats ?? {}),
      like_count: patch.like_count,
    },
  };
}
