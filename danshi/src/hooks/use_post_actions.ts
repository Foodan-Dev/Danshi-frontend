/**
 * usePostActions — 帖子交互操作 Hook
 *
 * 封装帖子详情页中的点赞、收藏、关注、分享等交互逻辑，
 * 从 post_detail_screen 中提取以降低单文件复杂度。
 */
import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { postsService } from '@/src/services/posts_service';
import { usersService } from '@/src/services/users_service';
import type { Post } from '@/src/models/Post';
import { showAlert } from '@/src/utils/alert';

type PostSetter = React.Dispatch<React.SetStateAction<Post | null>>;

type UsePostActionsParams = {
  post: Post | null;
  setPost: PostSetter;
  currentUserId?: string;
};

export function usePostActions({ post, setPost, currentUserId }: UsePostActionsParams) {
  const [actionLoading, setActionLoading] = useState({ like: false, favorite: false, follow: false });
  const [isFollowed, setIsFollowed] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  const requireAuth = useCallback((actionLabel: string) => {
    if (currentUserId) return true;
    showAlert('请先登录', `登录后才能${actionLabel}`);
    return false;
  }, [currentUserId]);

  /** 同步关注状态（通常在 fetchPost 后调用） */
  const syncFollowState = useCallback((following: boolean) => {
    setIsFollowed(following);
  }, []);

  // ==================== 点赞 ====================
  const handleToggleLike = useCallback(async () => {
    if (!post) return;
    if (!requireAuth('点赞帖子')) return;
    const currentlyLiked = post.is_liked;
    const currentLikeCount = post.stats?.like_count ?? 0;

    setActionLoading((prev) => ({ ...prev, like: true }));
    // 乐观更新
    setPost((prev) =>
      prev ? {
        ...prev,
        is_liked: !currentlyLiked,
        stats: { ...(prev.stats ?? {}), like_count: currentLikeCount + (currentlyLiked ? -1 : 1) },
      } : prev
    );

    try {
      const result = currentlyLiked
        ? await postsService.unlike(post.id)
        : await postsService.like(post.id);
      setPost((prev) =>
        prev ? {
          ...prev,
          is_liked: result?.is_liked ?? !currentlyLiked,
          stats: { ...(prev.stats ?? {}), like_count: result?.like_count ?? currentLikeCount + (currentlyLiked ? -1 : 1) },
        } : prev
      );
    } catch {
      // 回滚
      setPost((prev) =>
        prev ? {
          ...prev,
          is_liked: currentlyLiked,
          stats: { ...(prev.stats ?? {}), like_count: currentLikeCount },
        } : prev
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, like: false }));
    }
  }, [post, setPost, requireAuth]);

  // ==================== 收藏 ====================
  const handleToggleFavorite = useCallback(async () => {
    if (!post) return;
    if (!requireAuth('收藏帖子')) return;
    const currentlyFavorited = post.is_favorited;
    const currentFavoriteCount = post.stats?.favorite_count ?? 0;

    setActionLoading((prev) => ({ ...prev, favorite: true }));
    setPost((prev) =>
      prev ? {
        ...prev,
        is_favorited: !currentlyFavorited,
        stats: { ...(prev.stats ?? {}), favorite_count: currentFavoriteCount + (currentlyFavorited ? -1 : 1) },
      } : prev
    );

    try {
      const result = currentlyFavorited
        ? await postsService.unfavorite(post.id)
        : await postsService.favorite(post.id);
      setPost((prev) =>
        prev ? {
          ...prev,
          is_favorited: result?.is_favorited ?? !currentlyFavorited,
          stats: { ...(prev.stats ?? {}), favorite_count: result?.favorite_count ?? currentFavoriteCount + (currentlyFavorited ? -1 : 1) },
        } : prev
      );
    } catch {
      setPost((prev) =>
        prev ? {
          ...prev,
          is_favorited: currentlyFavorited,
          stats: { ...(prev.stats ?? {}), favorite_count: currentFavoriteCount },
        } : prev
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, favorite: false }));
    }
  }, [post, setPost, requireAuth]);

  // ==================== 关注 ====================
  const handleToggleFollow = useCallback(async () => {
    if (!post?.author?.id) return;
    if (!requireAuth('关注作者')) return;
    if (currentUserId === post.author.id) {
      showAlert('提示', '不能关注自己');
      return;
    }
    setActionLoading((prev) => ({ ...prev, follow: true }));
    try {
      const { is_following } = isFollowed
        ? await usersService.unfollowUser(post.author.id)
        : await usersService.followUser(post.author.id);
      setIsFollowed(is_following);
    } catch (e) {
      showAlert('操作失败', (e as Error)?.message ?? '请稍后重试');
    } finally {
      setActionLoading((prev) => ({ ...prev, follow: false }));
    }
  }, [post?.author?.id, isFollowed, currentUserId, requireAuth]);

  // ==================== 分享 ====================
  const handleShareToPlatform = useCallback(async () => {
    if (!post) return;
    setShareSheetVisible(false);
    try {
      await Share.share({ message: `${post.title}\n来自旦食社区，快来看看！` });
    } catch (error) {
      if (__DEV__) console.warn('[post_detail] share failed', error);
    }
  }, [post]);

  const handleCopyPostId = useCallback(async () => {
    if (!post) return;
    setShareSheetVisible(false);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(post.id);
        showAlert('已复制', '帖子 ID 已复制到剪贴板');
      } else {
        await Share.share({ message: `帖子 ID：${post.id}` });
      }
    } catch {
      showAlert('复制失败', `请手动复制帖子 ID：${post.id}`);
    }
  }, [post]);

  return {
    // State
    actionLoading,
    isFollowed,
    shareSheetVisible,
    setShareSheetVisible,
    // Sync
    syncFollowState,
    // Handlers
    handleToggleLike,
    handleToggleFavorite,
    handleToggleFollow,
    handleShareToPlatform,
    handleCopyPostId,
  };
}
