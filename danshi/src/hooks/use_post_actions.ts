/**
 * usePostActions — 帖子交互操作 Hook
 *
 * 封装帖子详情页中的点赞、收藏、关注、分享等交互逻辑，
 * 从 post_detail_screen 中提取以降低单文件复杂度。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const actionLoadingRef = useRef({ like: false, favorite: false, follow: false });
  const postRef = useRef(post);

  const requireAuth = useCallback((actionLabel: string) => {
    if (currentUserId) return true;
    showAlert('请先登录', `登录后才能${actionLabel}`);
    return false;
  }, [currentUserId]);

  const beginAction = useCallback((key: keyof typeof actionLoadingRef.current) => {
    if (actionLoadingRef.current[key]) return false;
    actionLoadingRef.current[key] = true;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    return true;
  }, []);

  const endAction = useCallback((key: keyof typeof actionLoadingRef.current) => {
    actionLoadingRef.current[key] = false;
    setActionLoading((prev) => ({ ...prev, [key]: false }));
  }, []);

  useEffect(() => {
    postRef.current = post;
  }, [post]);

  useEffect(() => {
    const author = post?.author as ({ is_following?: boolean } & NonNullable<Post['author']>) | undefined;
    setIsFollowed(author?.is_following ?? false);
  }, [post]);

  /** 同步关注状态（通常在 fetchPost 后调用） */
  const syncFollowState = useCallback((following: boolean) => {
    setIsFollowed(following);
  }, []);

  // ==================== 点赞 ====================
  const handleToggleLike = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost) return;
    if (!requireAuth('点赞帖子')) return;
    if (!beginAction('like')) return;
    const currentlyLiked = currentPost.is_liked;
    const currentLikeCount = currentPost.stats?.like_count ?? 0;

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
        ? await postsService.unlike(currentPost.id)
        : await postsService.like(currentPost.id);
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
      endAction('like');
    }
  }, [setPost, requireAuth, beginAction, endAction]);

  // ==================== 收藏 ====================
  const handleToggleFavorite = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost) return;
    if (!requireAuth('收藏帖子')) return;
    if (!beginAction('favorite')) return;
    const currentlyFavorited = currentPost.is_favorited;
    const currentFavoriteCount = currentPost.stats?.favorite_count ?? 0;

    setPost((prev) =>
      prev ? {
        ...prev,
        is_favorited: !currentlyFavorited,
        stats: { ...(prev.stats ?? {}), favorite_count: currentFavoriteCount + (currentlyFavorited ? -1 : 1) },
      } : prev
    );

    try {
      const result = currentlyFavorited
        ? await postsService.unfavorite(currentPost.id)
        : await postsService.favorite(currentPost.id);
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
      endAction('favorite');
    }
  }, [setPost, requireAuth, beginAction, endAction]);

  // ==================== 关注 ====================
  const handleToggleFollow = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost?.author?.id) return;
    if (!requireAuth('关注作者')) return;
    if (currentUserId === currentPost.author.id) {
      showAlert('提示', '不能关注自己');
      return;
    }
    if (!beginAction('follow')) return;
    try {
      const { is_following } = isFollowed
        ? await usersService.unfollowUser(currentPost.author.id)
        : await usersService.followUser(currentPost.author.id);
      setIsFollowed(is_following);
    } catch (e) {
      showAlert('操作失败', (e as Error)?.message ?? '请稍后重试');
    } finally {
      endAction('follow');
    }
  }, [isFollowed, currentUserId, requireAuth, beginAction, endAction]);

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
