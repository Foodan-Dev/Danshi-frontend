import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Image,
  RefreshControl,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  FlatList,
  LayoutChangeEvent,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { postsService } from '@/src/services/posts_service';
import type { Post, SeekingPost, SharePost } from '@/src/models/Post';

import { CommentItem } from '@/src/components/comments/comment_item';
import { CommentComposer } from '@/src/components/comments/comment_composer';
import ImageViewer from '@/src/components/image_viewer';
import { formatRelativeOrDate } from '@/src/utils/time_format';
import { TYPE_LABEL, SHARE_LABEL, type LoaderState } from '@/src/constants/post_labels';
import { BottomSheet } from '@/src/components/overlays/bottom_sheet';
import { useAuth } from '@/src/context/auth_context';
import { isAdmin } from '@/src/lib/auth/roles';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePostActions } from '@/src/hooks/use_post_actions';
import { usePostComments, flattenReplies, REPLY_PREVIEW_COUNT } from '@/src/hooks/use_post_comments';
import { breakpoints } from '@/src/constants/breakpoints';
import { useExtendedTheme } from '@/src/constants/md3_theme';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

// 图片展示配置
const IMAGE_CONFIG = {
  aspectRatio: 4 / 3,
  maxHeightRatio: 0.5,
  desktopLeftRatio: 0.55,
};

type Props = {
  postId: string;
};

const PostDetailScreen: React.FC<Props> = ({ postId }) => {
  const router = useRouter();
  const localParams = useLocalSearchParams();
  const normalizeParam = useCallback((value: unknown): string | null => {
    if (Array.isArray(value)) return value[0] ?? null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    return null;
  }, []);
  // 检查是否需要自动滚动到评论区（如通知跳转）
  const [autoScrollToComments, setAutoScrollToComments] = useState(false);
  const [pendingScrollCommentId, setPendingScrollCommentId] = useState<string | null>(null);
  const handledScrollParamsRef = useRef<string | null>(null);
  useEffect(() => {
    // 仅消费一次同一组路由定位参数，避免手动滑动时被重复拉回
    const params = (localParams as Record<string, unknown>) || {};
    const scrollTo = normalizeParam(params.scrollTo);
    const commentId = normalizeParam(
      params.commentId ??
      params.comment_id ??
      params.targetCommentId ??
      params.relatedId ??
      params.related_id
    );
    const handledKey = `${postId}:${scrollTo ?? ''}:${commentId ?? ''}`;
    if (handledScrollParamsRef.current === handledKey) return;
    if ((scrollTo === 'comment' || commentId) && commentId) {
      setAutoScrollToComments(true);
      setPendingScrollCommentId(commentId);
      handledScrollParamsRef.current = handledKey;
      return;
    }
    if (scrollTo === 'comments') {
      setAutoScrollToComments(true);
      handledScrollParamsRef.current = handledKey;
    }
  }, [postId, localParams, normalizeParam]);
  const insets = useSafeAreaInsets();
  const theme = useExtendedTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user: currentUser } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loader, setLoader] = useState<LoaderState>('initial');
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageViewer, setImageViewer] = useState<{ visible: boolean; index: number }>({ visible: false, index: 0 });

  const isCurrentUserAdmin = !!currentUser?.role && isAdmin(currentUser.role);

  // ==================== 评论 Hook ====================
  const onCommentCountChange = useCallback((delta: number) => {
    setPost((prev) =>
      prev ? {
        ...prev,
        stats: {
          ...(prev.stats ?? {}),
          comment_count: Math.max(0, (prev.stats?.comment_count ?? 0) + delta),
        },
      } : prev
    );
  }, []);

  const commentsHook = usePostComments({
    postId,
    currentUser: currentUser ? { id: currentUser.id, role: currentUser.role } : null,
    isAdmin: isCurrentUserAdmin,
    onCommentCountChange,
  });

  const {
    comments, commentSort, commentPagination, commentLoading, commentError,
    commentReplies, commentRepliesLoading, commentRepliesPagination, commentRepliesExpanded,
    commentSheetVisible, threadVisible, threadRootComment,
    commentInput, setCommentInput, commentReplyTarget, commentSubmitting,
    threadRepliesList, threadReplyTotal, threadLoading, threadHasMore,
    fetchComments,
    handleToggleCommentLike, handleReplyToComment, getCommentMoreActions,
    handleCancelReply, handleOpenCommentSheet, handleCloseCommentSheet,
    handleSubmitComment, handleCycleCommentSort,
    handleShowRepliesPanel, handleCloseThreadSheet,
    handleLoadMoreThreadReplies, handleReloadThreadReplies,
    handleDesktopToggleReplies,
    findCommentTarget, fetchRepliesForCommentRef,
  } = commentsHook;

  // ==================== 交互操作 Hook ====================
  const {
    actionLoading, isFollowed, shareSheetVisible, setShareSheetVisible,
    syncFollowState,
    handleToggleLike, handleToggleFavorite, handleToggleFollow,
    handleShareToPlatform, handleCopyPostId,
  } = usePostActions({ post, setPost, currentUserId: currentUser?.id });

  const scrollRef = useRef<ScrollView | null>(null);
  const commentsOffsetRef = useRef(0);
  const commentsListOffsetRef = useRef(0);
  const commentPositionsRef = useRef<Record<string, number>>({});

  const isDesktop = windowWidth >= breakpoints.md;
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/explore');
  }, [router]);

  // 图片布局计算
  const imageLayout = useMemo(() => {
    if (isDesktop) {
      const leftWidth = windowWidth * IMAGE_CONFIG.desktopLeftRatio;
      return {
        width: leftWidth,
        height: windowHeight - insets.top,
        containerWidth: leftWidth,
      };
    }
    const imageHeight = Math.min(windowWidth / IMAGE_CONFIG.aspectRatio, windowHeight * IMAGE_CONFIG.maxHeightRatio);
    return {
      width: windowWidth,
      height: imageHeight,
      containerWidth: windowWidth,
    };
  }, [windowWidth, windowHeight, isDesktop, insets.top]);

  const safePostImages = useMemo(
    () => (post?.images ?? []).map((item) => getSafeRemoteUrl(item)).filter((item): item is string => !!item),
    [post?.images]
  );

  const safeAuthorAvatarUrl = getSafeRemoteUrl(post?.author?.avatar_url);
  const shouldShowFollowButton = !!currentUser?.id && !!post?.author?.id && currentUser.id !== post.author.id;
  const shouldShowBottomBar = !!post && !error;

  // ==================== 数据获取 ====================
  const fetchPost = useCallback(async (mode: LoaderState = 'initial') => {
    setLoader(mode);
    setError(null);
    try {
      const data = await postsService.get(postId);
      setPost({
        ...data,
        is_liked: data.is_liked ?? false,
        is_favorited: data.is_favorited ?? false,
        stats: { ...(data.stats ?? {}), comment_count: data.stats?.comment_count ?? 0 },
      });
      const author = data.author as (typeof data.author & { is_following?: boolean }) | undefined;
      if (author && typeof author.is_following === 'boolean') {
        syncFollowState(author.is_following);
      }
    } catch (e) {
      setPost(null);
      setError((e as Error)?.message ?? '加载帖子失败');
    } finally {
      setLoader('idle');
    }
  }, [postId, syncFollowState]);

  useEffect(() => {
    fetchPost('initial');
  }, [fetchPost]);

  useEffect(() => {
    if (post?.id) fetchComments(post.id, commentSort);
  }, [post?.id, commentSort, fetchComments]);

  // 自动滚动到评论区
  useEffect(() => {
    if (autoScrollToComments && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current && commentsOffsetRef.current) {
          scrollRef.current.scrollTo({ y: commentsOffsetRef.current - 16, animated: true });
        }
        setAutoScrollToComments(false);
      }, 400); // 延迟以确保渲染完成
    }
  }, [autoScrollToComments, comments]);

  const scrollToCommentId = useCallback((commentId: string) => {
    const y = commentPositionsRef.current[commentId];
    if (typeof y !== 'number' || !scrollRef.current) return false;
    scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
    return true;
  }, []);

  const handleCommentLayout = useCallback(
    (commentId: string) => (e: LayoutChangeEvent) => {
      const baseOffset = commentsOffsetRef.current + commentsListOffsetRef.current;
      const y = baseOffset + e.nativeEvent.layout.y;
      commentPositionsRef.current[commentId] = y;
      if (pendingScrollCommentId === commentId && scrollToCommentId(commentId)) {
        setPendingScrollCommentId(null);
      }
    },
    [pendingScrollCommentId, scrollToCommentId]
  );

  useEffect(() => {
    if (!pendingScrollCommentId) return;
    const targetInfo = findCommentTarget(pendingScrollCommentId);
    const replyParent = targetInfo?.parent ?? null;
    const targetId = commentPositionsRef.current[pendingScrollCommentId]
      ? pendingScrollCommentId
      : replyParent?.id;

    if (targetInfo?.entity && replyParent && targetInfo.entity.id !== replyParent.id) {
      // 通过 hook 的 handleShowRepliesPanel 打开回复面板并加载数据
      if (!threadRootComment || threadRootComment.id !== replyParent.id) {
        handleShowRepliesPanel(replyParent);
      }
      if (!commentReplies[replyParent.id] && (replyParent.reply_count ?? 0) > 0) {
        fetchRepliesForCommentRef.current(replyParent.id).catch(() => {});
      }
    }

    if (targetId && scrollToCommentId(targetId)) {
      setPendingScrollCommentId(null);
    }
  }, [
    pendingScrollCommentId,
    findCommentTarget,
    scrollToCommentId,
    commentReplies,
    threadRootComment,
    handleShowRepliesPanel,
    fetchRepliesForCommentRef,
  ]);

  const refreshing = loader === 'refresh';
  const isInitialLoading = loader === 'initial';

  // ==================== 交互处理 ====================
  const handleRefresh = useCallback(() => {
    const refreshTasks = [fetchPost('refresh')];
    if (postId) {
      refreshTasks.push(fetchComments(postId, commentSort));
    }
    return Promise.all(refreshTasks).then(() => undefined);
  }, [postId, fetchComments, commentSort, fetchPost]);

  const handleOpenImageViewer = useCallback((index: number) => {
    setImageViewer({ visible: true, index });
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setImageViewer((prev) => ({ ...prev, visible: false }));
  }, []);

  // ==================== 数据派生 ====================
  const hasImages = safePostImages.length > 0;
  const tags = post?.tags ?? [];
  const sharePostData = post?.post_type === 'share' ? (post as SharePost) : null;
  const seekingPostData = post?.post_type === 'seeking' ? (post as SeekingPost) : null;
  const likeCount = post?.stats?.like_count ?? 0;
  const favoriteCount = post?.stats?.favorite_count ?? 0;
  const viewCount = post?.stats?.view_count ?? 0;
  const commentCount = post?.stats?.comment_count ?? commentPagination.total;

  const threadSheet = (
    <BottomSheet
      visible={threadVisible}
      onClose={handleCloseThreadSheet}
      height={Math.min(windowHeight * 0.9, 640)}
    >
      {threadRootComment ? (
        <View style={styles.threadSheet}>
          <View style={styles.threadSheetHeader}>
            <Pressable style={styles.threadSheetClose} onPress={handleCloseThreadSheet}>
              <Ionicons name="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
            </Pressable>
            <Text style={styles.threadSheetTitle}>共 {threadReplyTotal} 条回复</Text>
            <View style={styles.threadSheetHeaderSpacer} />
          </View>
          <ScrollView
            style={styles.threadSheetScroll}
            contentContainerStyle={styles.threadSheetContent}
            showsVerticalScrollIndicator={false}
          >
            <CommentItem
              comment={threadRootComment}
              showReplySummary={false}
              onLike={handleToggleCommentLike}
              onReply={handleReplyToComment}
              getMoreActions={getCommentMoreActions}
            />
            <View style={[styles.threadDividerLine, { backgroundColor: theme.colors.surfaceVariant }]} />
            {threadRepliesList.length ? (
              threadRepliesList.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  showReplySummary={false}
                  onLike={handleToggleCommentLike}
                  onReply={handleReplyToComment}
                  getMoreActions={getCommentMoreActions}
                />
              ))
            ) : threadReplyTotal > 0 ? (
              <View style={styles.threadLoading}>
                {threadLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Button
                    mode="text"
                    onPress={handleReloadThreadReplies}
                    textColor={theme.colors.primary}
                  >
                    重新加载回复
                  </Button>
                )}
              </View>
            ) : (
              <View style={styles.threadEmpty}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.threadEmptyText, { color: theme.colors.onSurfaceVariant }]}>还没有回复</Text>
              </View>
            )}
            {threadHasMore ? (
              <Button
                mode="outlined"
                onPress={handleLoadMoreThreadReplies}
                loading={threadLoading}
                disabled={threadLoading}
                style={styles.threadLoadMore}
                textColor={theme.colors.primary}
              >
                查看更多回复
              </Button>
            ) : null}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.threadEmptyState}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>请选择要查看的评论</Text>
        </View>
      )}
    </BottomSheet>
  );


  // 根据帖子类型生成渐变色（使用主题语义颜色）
  const gradientColors = useMemo(() => {
    const colors = theme.colors;
    if (post?.post_type === 'seeking') {
      // 求助类型：紫色系
      return { 
        primary: colors.seeking, 
        secondary: colors.seekingContainer, 
        accent: colors.onSeekingContainer 
      };
    } else if (sharePostData?.share_type === 'warning') {
      // 避雷类型：红色系
      return { 
        primary: colors.warning, 
        secondary: colors.warningContainer, 
        accent: colors.onWarningContainer 
      };
    } else {
      // 推荐/分享类型：使用品牌主色（橙色系）
      return { 
        primary: theme.colors.primary, 
        secondary: theme.colors.primaryContainer, 
        accent: theme.colors.onPrimaryContainer 
      };
    }
  }, [post?.post_type, sharePostData?.share_type, theme.colors]);

  // ==================== 统一顶部媒体区（Fallback Cover）====================
  const renderUnifiedHeroSection = () => {
    // 有图模式：渲染图片轮播
    if (hasImages) {
      const images = safePostImages;
      return (
        <View style={[styles.carouselContainer, { height: imageLayout.height }]}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item}-${index}`}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / imageLayout.width);
              setCurrentImageIndex(index);
            }}
            renderItem={({ item, index }) => (
              <Pressable onPress={() => handleOpenImageViewer(index)}>
                <Image
                  source={{ uri: item }}
                  style={[styles.carouselImage, { width: imageLayout.width, height: imageLayout.height }]}
                  resizeMode="cover"
                />
              </Pressable>
            )}
          />
          {images.length > 1 && (
            <View style={styles.imageIndicator}>
              <Text style={styles.imageIndicatorText}>
                {currentImageIndex + 1}/{images.length}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // 无图模式：渲染 Mesh Gradient Fallback Cover
    const typeLabel = sharePostData?.share_type 
      ? SHARE_LABEL[sharePostData.share_type] 
      : TYPE_LABEL[post?.post_type ?? 'share'];

    const typeIcon: React.ComponentProps<typeof Ionicons>['name'] = post?.post_type === 'seeking' ? 'help-circle' : 
      sharePostData?.share_type === 'warning' ? 'alert-circle' : 'heart';

    return (
      <View style={[styles.fallbackCover, { paddingTop: insets.top + 56 }]}>
        {/* Mesh Gradient 背景 */}
        <View style={[styles.fallbackGradientBase, { backgroundColor: gradientColors.primary }]} />
        <View style={[styles.fallbackMeshLayer1, { backgroundColor: gradientColors.secondary }]} />
        <View style={[styles.fallbackMeshLayer2, { backgroundColor: gradientColors.accent }]} />
        <View style={[styles.fallbackMeshLayer3, { backgroundColor: gradientColors.primary }]} />
        
        {/* 装饰性 Blur 圆圈 */}
        <View style={styles.fallbackDecorations}>
          <View style={[styles.fallbackCircle1, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
          <View style={[styles.fallbackCircle2, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <View style={[styles.fallbackCircle3, { backgroundColor: gradientColors.accent, opacity: 0.2 }]} />
        </View>

        {/* 中央内容 - 大类型图标 */}
        <View style={styles.fallbackContent}>
          <View style={styles.fallbackIconContainer}>
            <Ionicons name={typeIcon} size={64} color="rgba(255,255,255,0.85)" />
          </View>
          <View style={styles.fallbackTypeBadge}>
            <Text style={styles.fallbackTypeBadgeText}>{typeLabel}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ==================== 作者栏渲染 ====================
  const renderAuthorBar = () => (
    <View style={styles.authorBar}>
      <Pressable style={styles.authorInfo} onPress={() => post?.author?.id && router.push(`/user/${post.author.id}`)}>
        {safeAuthorAvatarUrl ? (
          <Avatar.Image size={44} source={{ uri: safeAuthorAvatarUrl }} />
        ) : (
          <Avatar.Text
            size={44}
            label={(post?.author?.name ?? '访').slice(0, 1)}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            labelStyle={{ color: theme.colors.onPrimaryContainer }}
          />
        )}
        <View style={styles.authorTextWrap}>
          <Text style={styles.authorName} numberOfLines={1}>{post?.author?.name ?? '匿名用户'}</Text>
          <Text style={[styles.authorMeta, { color: theme.colors.onSurfaceVariant }]}>
            {formatRelativeOrDate(post?.created_at)}
          </Text>
        </View>
      </Pressable>
      {shouldShowFollowButton ? (
        <Pressable
          style={[
            styles.followBtn,
            isFollowed
              ? { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }
              : { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleToggleFollow}
          disabled={actionLoading.follow}
        >
          {actionLoading.follow ? (
            <ActivityIndicator size={14} color={isFollowed ? theme.colors.onSurfaceVariant : theme.colors.onPrimary} />
          ) : (
            <Text
              style={[
                styles.followBtnText,
                { color: isFollowed ? theme.colors.onSurfaceVariant : theme.colors.onPrimary },
              ]}
            >
              {isFollowed ? '已关注' : '+ 关注'}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );

  // ==================== 内容区域渲染 ====================
  const renderContentSection = () => (
    <View style={styles.contentSection}>
      {/* 标题 */}
      <Text style={styles.title}>{post?.title}</Text>

      {/* 正文 */}
      <Text style={styles.contentText}>{post?.content}</Text>

      {/* 结构化信息卡片 */}
      {sharePostData && (sharePostData.cuisine || typeof sharePostData.price === 'number' || (sharePostData.flavors && sharePostData.flavors.length > 0)) ? (
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          {sharePostData.cuisine ? (
            <View style={styles.infoCardLine}>
              <Ionicons name="restaurant-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.infoCardLabel, { color: theme.colors.onSurfaceVariant }]}>菜系</Text>
              <Text style={[styles.infoCardValue, { color: theme.colors.onSurface }]}>{sharePostData.cuisine}</Text>
            </View>
          ) : null}
          {typeof sharePostData.price === 'number' ? (
            <View style={styles.infoCardLine}>
              <Ionicons name="cash-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.infoCardLabel, { color: theme.colors.onSurfaceVariant }]}>价格</Text>
              <Text style={[styles.infoCardValue, { color: theme.colors.onSurface }]}>¥{sharePostData.price}</Text>
            </View>
          ) : null}
          {sharePostData.flavors && sharePostData.flavors.length > 0 ? (
            <View style={styles.infoCardLine}>
              <Ionicons name="heart-outline" size={16} color={theme.colors.tertiary} />
              <Text style={[styles.infoCardLabel, { color: theme.colors.onSurfaceVariant }]}>口味</Text>
              <View style={styles.infoCardTags}>
                {sharePostData.flavors.map((flavor, idx) => (
                  <View key={idx} style={[styles.flavorBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
                    <Text style={[styles.flavorBadgeText, { color: theme.colors.onSecondaryContainer }]}>{flavor}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* SeekingPost 信息 */}
      {seekingPostData && (seekingPostData.budget_range || seekingPostData.preferences) ? (
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          {seekingPostData.budget_range ? (
            <View style={styles.infoCardLine}>
              <Ionicons name="wallet-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.infoCardLabel, { color: theme.colors.onSurfaceVariant }]}>预算</Text>
              <Text style={[styles.infoCardValue, { color: theme.colors.onSurface }]}>
                ¥{seekingPostData.budget_range.min}-{seekingPostData.budget_range.max}
              </Text>
            </View>
          ) : null}
          {seekingPostData.preferences?.prefer_flavors && seekingPostData.preferences.prefer_flavors.length > 0 ? (
            <View style={styles.infoCardLine}>
              <Ionicons name="heart-outline" size={16} color={theme.colors.tertiary} />
              <Text style={[styles.infoCardLabel, { color: theme.colors.onSurfaceVariant }]}>喜欢</Text>
              <View style={styles.infoCardTags}>
                {seekingPostData.preferences.prefer_flavors.map((f, idx) => (
                  <View key={idx} style={[styles.flavorBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
                    <Text style={[styles.flavorBadgeText, { color: theme.colors.onTertiaryContainer }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {seekingPostData.preferences?.avoid_flavors && seekingPostData.preferences.avoid_flavors.length > 0 ? (
            <View style={styles.infoCardLine}>
              <Ionicons name="close-circle-outline" size={16} color={theme.colors.error} />
              <Text style={[styles.infoCardLabel, { color: theme.colors.onSurfaceVariant }]}>忌口</Text>
              <View style={styles.infoCardTags}>
                {seekingPostData.preferences.avoid_flavors.map((f, idx) => (
                  <View key={idx} style={[styles.flavorBadge, { backgroundColor: theme.colors.errorContainer }]}>
                    <Text style={[styles.flavorBadgeText, { color: theme.colors.onErrorContainer }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 标签栏 */}
      <View style={styles.tagsRow}>
        {/* 位置 */}
        {post?.canteen ? (
          <View style={[styles.tagBadge, styles.locationBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Ionicons name="location" size={12} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.tagBadgeText, { color: theme.colors.onSurfaceVariant }]}>{post.canteen}</Text>
          </View>
        ) : null}
        {/* 类型标签 */}
        {post && (
          <View style={[
            styles.tagBadge,
            { 
              backgroundColor: post.post_type === 'seeking' 
                ? theme.colors.seekingContainer 
                : (sharePostData?.share_type === 'warning' 
                    ? theme.colors.warningContainer 
                    : theme.colors.recommendContainer)
            }
          ]}>
            <Text style={[
              styles.tagBadgeText,
              { 
                color: post.post_type === 'seeking'
                  ? theme.colors.seeking
                  : (sharePostData?.share_type === 'warning' 
                      ? theme.colors.warning 
                      : theme.colors.recommend)
              }
            ]}>
              {sharePostData && sharePostData.share_type ? SHARE_LABEL[sharePostData.share_type] : TYPE_LABEL[post.post_type]}
            </Text>
          </View>
        )}
        {/* 话题标签 */}
        {tags.filter(tag => tag && tag.trim()).map((tag, index) => (
          <Text key={index} style={[styles.topicTag, { color: theme.colors.primary }]}>
            #{tag}
          </Text>
        ))}
      </View>

      {/* 浏览量和时间 */}
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: theme.colors.outline }]}>
          {viewCount} 浏览
        </Text>
        <Text style={[styles.metaText, { color: theme.colors.outline }]}>
          发布于 {formatRelativeOrDate(post?.created_at)}
        </Text>
      </View>
    </View>
  );

  // ==================== 评论区渲染 ====================
  const renderCommentsSection = () => {
    const commentsBottomPadding = Math.max(insets.bottom, 12) + 72;
    return (
      <View
        style={styles.commentsSection}
        onLayout={(e) => { commentsOffsetRef.current = e.nativeEvent.layout.y; }}
      >
      {/* 评论头部 */}
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>共 {commentCount} 条评论</Text>
        <Pressable style={styles.sortBtn} onPress={handleCycleCommentSort}>
          <Ionicons name="swap-vertical" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.sortBtnText, { color: theme.colors.onSurfaceVariant }]}>
            {commentSort === 'latest' ? '最新' : '最热'}
          </Text>
        </Pressable>
      </View>

      {/* 评论列表 */}
      {commentLoading ? (
        <View style={styles.commentsLoading}>
          <ActivityIndicator size="small" />
          <Text style={[styles.commentsLoadingText, { color: theme.colors.onSurfaceVariant }]}>
            加载评论中...
          </Text>
        </View>
      ) : commentError ? (
        <View style={styles.emptyComments}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.error} />
          <Text style={[styles.emptyCommentsText, { color: theme.colors.error }]}>
            {commentError}
          </Text>
          <Button mode="contained-tonal" onPress={() => fetchComments(postId, commentSort)}>
            重新加载评论
          </Button>
        </View>
      ) : comments.length ? (
        <View
          style={[styles.commentsList, { paddingBottom: commentsBottomPadding }]}
          onLayout={(e) => { commentsListOffsetRef.current = e.nativeEvent.layout.y; }}
        >
          {comments.map((item, index) => {
            const cachedReplies = commentReplies[item.id];
            const previewReplies = flattenReplies(item.replies ?? []);
            const availableReplies = cachedReplies?.length ? cachedReplies : previewReplies;
            const collapsedReplies = availableReplies.slice(0, REPLY_PREVIEW_COUNT);
            const expanded = !!commentRepliesExpanded[item.id];
            const repliesPreview = expanded ? availableReplies : collapsedReplies;
            const backendReplyTotal = commentRepliesPagination[item.id]?.total ?? item.reply_count ?? 0;
            const totalReplyCount = Math.max(backendReplyTotal, availableReplies.length, previewReplies.length);
            const showReplySummary = !isDesktop && totalReplyCount > REPLY_PREVIEW_COUNT;
            const shouldInlineReplies = totalReplyCount > 0 && totalReplyCount <= REPLY_PREVIEW_COUNT;
            const remainingReplies = Math.max(totalReplyCount - repliesPreview.length, 0);
            const commentKey = item.id ?? `comment-${index}`;
            return (
              <View key={commentKey} style={styles.commentItem} onLayout={handleCommentLayout(item.id)}>
                <CommentItem
                  comment={item}
                  depth={0}
                  replyCount={showReplySummary ? totalReplyCount : undefined}
                  onLike={handleToggleCommentLike}
                  onReply={handleReplyToComment}
                  getMoreActions={getCommentMoreActions}
                  onShowReplies={showReplySummary ? handleShowRepliesPanel : undefined}
                  showReplySummary={showReplySummary}
                />
                {shouldInlineReplies ? (
                  <View style={styles.repliesBlock}>
                    {repliesPreview.map((reply) => (
                      <View key={reply.id} onLayout={handleCommentLayout(reply.id)}>
                        <CommentItem
                          comment={reply}
                          isReply
                          depth={1}
                          showReplySummary={false}
                          onLike={handleToggleCommentLike}
                          onReply={handleReplyToComment}
                          getMoreActions={getCommentMoreActions}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
                {isDesktop && totalReplyCount > REPLY_PREVIEW_COUNT ? (
                  <View style={styles.repliesBlock}>
                    {repliesPreview.map((reply) => (
                      <View key={reply.id} onLayout={handleCommentLayout(reply.id)}>
                        <CommentItem
                          comment={reply}
                          isReply
                          depth={1}
                          showReplySummary={false}
                          onLike={handleToggleCommentLike}
                          onReply={handleReplyToComment}
                          getMoreActions={getCommentMoreActions}
                        />
                      </View>
                    ))}
                    <Button
                      mode="text"
                      icon={expanded ? 'chevron-up' : 'chevron-down'}
                      onPress={() => handleDesktopToggleReplies(item)}
                      loading={commentRepliesLoading[item.id] && expanded}
                      textColor={theme.colors.primary}
                      uppercase={false}
                    >
                      {expanded
                        ? '收起回复'
                        : remainingReplies > 0
                          ? `展开更多回复 (${remainingReplies})`
                          : `共${totalReplyCount}条回复 >`}
                    </Button>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyComments}>
          <Ionicons name="chatbubble-outline" size={48} color={theme.colors.outlineVariant} />
          <Text style={[styles.emptyCommentsText, { color: theme.colors.onSurfaceVariant }]}>
            还没有评论，快来抢沙发吧～
          </Text>
        </View>
      )}
      </View>
    );
  };

  // ==================== 底部操作栏渲染 ====================
  const bottomBarPadding = Math.max(insets.bottom, 12);
  const renderBottomBar = () => (
    <View style={[styles.bottomBar, { paddingBottom: bottomBarPadding, backgroundColor: theme.colors.surface }]}>
      {/* 输入框 */}
      <Pressable
        style={[
          styles.commentInput,
          { backgroundColor: theme.colors.surfaceVariant, opacity: currentUser?.id ? 1 : 0.72 },
        ]}
        onPress={handleOpenCommentSheet}
        disabled={!post}
      >
        <Ionicons name="chatbubble-outline" size={18} color={theme.colors.outline} />
        <Text style={[styles.commentInputText, { color: theme.colors.outline }]}>
          {currentUser?.id ? '说点什么...' : '登录后参与讨论'}
        </Text>
      </Pressable>

      {/* 操作按钮 */}
      <View style={styles.bottomActions}>
        <Pressable
          style={[styles.actionBtn, !currentUser?.id && { opacity: 0.6 }]}
          onPress={handleToggleLike}
          disabled={actionLoading.like || !post}
        >
          <Ionicons
            name={post?.is_liked ? 'heart' : 'heart-outline'}
            size={22}
            color={post?.is_liked ? theme.colors.error : theme.colors.onSurfaceVariant}
          />
          <Text style={[styles.actionCount, { color: post?.is_liked ? theme.colors.error : theme.colors.onSurfaceVariant }]}>
            {likeCount}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, !currentUser?.id && { opacity: 0.6 }]}
          onPress={handleToggleFavorite}
          disabled={actionLoading.favorite || !post}
        >
          <Ionicons
            name={post?.is_favorited ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={post?.is_favorited ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
          <Text style={[styles.actionCount, { color: post?.is_favorited ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
            {favoriteCount}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, !currentUser?.id && { opacity: 0.6 }]}
          onPress={handleOpenCommentSheet}
          disabled={!post}
        >
          <Ionicons name="chatbubble-outline" size={22} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.actionCount, { color: theme.colors.onSurfaceVariant }]}>{commentCount}</Text>
        </Pressable>
      </View>
    </View>
  );

  // ==================== 桌面端布局 ====================
  if (isDesktop) {
    const leftPanelWidth = windowWidth * IMAGE_CONFIG.desktopLeftRatio;

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* 返回按钮 */}
        <Pressable
          style={[styles.desktopBackBtn, { top: insets.top + 12 }]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.onPrimary} />
        </Pressable>

        {/* 分享按钮 */}
        <Pressable
          style={[styles.desktopShareBtn, { top: insets.top + 12 }]}
          onPress={() => setShareSheetVisible(true)}
        >
          <Ionicons name="share-outline" size={22} color={theme.colors.onPrimary} />
        </Pressable>

        <View style={[styles.desktopContainer, { paddingTop: insets.top }]}>
          {/* 左侧图片区 */}
          <View style={[styles.desktopLeft, { width: leftPanelWidth, height: windowHeight - insets.top }]}>
            {isInitialLoading ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : hasImages ? (
              <>
                <FlatList
                  data={safePostImages}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => `${item}-${index}`}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / leftPanelWidth);
                    setCurrentImageIndex(index);
                  }}
                  renderItem={({ item, index }) => (
                    <Pressable onPress={() => handleOpenImageViewer(index)}>
                        <Image
                          source={{ uri: item }}
                          style={{ width: leftPanelWidth, height: windowHeight - insets.top }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  )}
                />
                {safePostImages.length > 1 && (
                  <View style={styles.desktopImageIndicator}>
                    <Text style={styles.imageIndicatorText}>
                      {currentImageIndex + 1}/{safePostImages.length}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              // 桌面端无图模式 - 渐变背景
              <View style={[styles.desktopNoImageHero, { backgroundColor: gradientColors.primary }]}>
                <View style={styles.heroPattern}>
                  <View style={[styles.heroCircle, styles.desktopHeroCircle1, { backgroundColor: gradientColors.secondary }]} />
                  <View style={[styles.heroCircle, styles.desktopHeroCircle2, { backgroundColor: gradientColors.secondary }]} />
                </View>
                <View style={styles.desktopHeroContent}>
                  <View style={[styles.heroTypeBadge, { backgroundColor: `${theme.colors.inverseOnSurface}33` }]}>
                    <Text style={[styles.heroTypeBadgeText, { color: theme.colors.inverseOnSurface }]}>
                      {sharePostData?.share_type ? SHARE_LABEL[sharePostData.share_type] : TYPE_LABEL[post?.post_type ?? 'share']}
                    </Text>
                  </View>
                  <Text style={[styles.desktopHeroTitle, { color: theme.colors.inverseOnSurface, textShadowColor: theme.colors.shadow }]} numberOfLines={4}>{post?.title}</Text>
                  <Text style={[styles.heroMeta, { color: `${theme.colors.inverseOnSurface}BF` }]}>{formatRelativeOrDate(post?.created_at)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* 右侧内容区 */}
          <View style={styles.desktopRight}>
            {/* 作者栏 */}
            {post ? (
              <View style={[styles.desktopHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
                {renderAuthorBar()}
              </View>
            ) : null}

            {/* 滚动内容 */}
            <ScrollView
              style={styles.desktopContent}
              contentContainerStyle={{ paddingBottom: 16 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} progressBackgroundColor={theme.colors.surface} progressViewOffset={0} />}
              showsVerticalScrollIndicator={false}
            >
              {isInitialLoading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator />
                  <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>加载中...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorWrap}>
                  <Text style={{ color: theme.colors.error }}>{error}</Text>
                  <Button mode="contained-tonal" onPress={() => fetchPost('initial')}>重试</Button>
                </View>
              ) : post ? (
                <>
                  {renderContentSection()}
                  <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />
                  {renderCommentsSection()}
                </>
              ) : (
                <View style={styles.errorWrap}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>帖子不存在或已被删除</Text>
                </View>
              )}
            </ScrollView>

            {/* 底部操作 */}
            {shouldShowBottomBar ? (
              <View style={[styles.desktopFooter, { borderTopColor: theme.colors.outlineVariant }]}>
                {renderBottomBar()}
              </View>
            ) : null}
          </View>
        </View>

        {/* Sheets */}
        <BottomSheet visible={shareSheetVisible} onClose={() => setShareSheetVisible(false)} height={200}>
          <View style={styles.shareSheet}>
            <Text style={styles.shareSheetTitle}>分享</Text>
            <View style={styles.shareSheetBtns}>
              <Button mode="contained-tonal" icon="share-variant" onPress={handleShareToPlatform}>
                分享到...
              </Button>
              <Button mode="outlined" icon="content-copy" onPress={handleCopyPostId}>
                复制 ID
              </Button>
            </View>
          </View>
        </BottomSheet>

        <BottomSheet visible={commentSheetVisible} onClose={handleCloseCommentSheet} height={360}>
          <CommentComposer
            value={commentInput}
            onChange={setCommentInput}
            onSubmit={handleSubmitComment}
            replyTarget={commentReplyTarget?.author?.name}
            onCancelReply={handleCancelReply}
            currentUser={currentUser ? { id: currentUser.id, name: currentUser.name || '', avatar_url: currentUser.avatar_url } : undefined}
            loading={commentSubmitting}
          />
        </BottomSheet>

        {!isDesktop && threadSheet}

        <ImageViewer
          visible={imageViewer.visible}
          images={safePostImages}
          initialIndex={imageViewer.index}
          onClose={handleCloseImageViewer}
        />
      </View>
    );
  }

  // ==================== 移动端布局 ====================
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 顶部导航 - 悬浮在图片/Hero上 */}
      <View style={[styles.mobileHeader, { paddingTop: insets.top }]}>
        <Pressable style={[styles.headerBtn, !hasImages && styles.headerBtnLight]} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.onPrimary} />
        </Pressable>
        <Pressable style={[styles.headerBtn, !hasImages && styles.headerBtnLight]} onPress={() => setShareSheetVisible(true)}>
          <Ionicons name="share-outline" size={22} color={theme.colors.onPrimary} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} progressBackgroundColor={theme.colors.surface} progressViewOffset={0} />}
        showsVerticalScrollIndicator={false}
      >
        {isInitialLoading ? (
          <View style={[styles.loaderWrap, { paddingTop: insets.top + 60 }]}>
            <ActivityIndicator />
            <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>加载中...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorWrap, { paddingTop: insets.top + 60 }]}>
            <Text style={{ color: theme.colors.error }}>{error}</Text>
            <Button mode="contained-tonal" onPress={() => fetchPost('initial')}>重试</Button>
          </View>
        ) : post ? (
          <>
            {/* 统一布局：媒体区域 / Fallback Cover */}
            {renderUnifiedHeroSection()}

            {/* 作者栏 - 紧跟封面 */}
            <View style={styles.mobileAuthorBar}>
              {renderAuthorBar()}
            </View>

            {/* 内容区域 - 统一样式 */}
            {renderContentSection()}

            {/* 分隔线 */}
            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />

            {/* 评论 */}
            {renderCommentsSection()}
          </>
        ) : (
          <View style={[styles.errorWrap, { paddingTop: insets.top + 60 }]}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>帖子不存在或已被删除</Text>
          </View>
        )}
      </ScrollView>

      {/* 底部栏 */}
      {shouldShowBottomBar ? renderBottomBar() : null}

      {/* Sheets */}
      <BottomSheet visible={shareSheetVisible} onClose={() => setShareSheetVisible(false)} height={200}>
        <View style={styles.shareSheet}>
          <Text style={styles.shareSheetTitle}>分享</Text>
          <View style={styles.shareSheetBtns}>
            <Button mode="contained-tonal" icon="share-variant" onPress={handleShareToPlatform}>
              分享到...
            </Button>
            <Button mode="outlined" icon="content-copy" onPress={handleCopyPostId}>
              复制 ID
            </Button>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={commentSheetVisible} onClose={handleCloseCommentSheet} height={360}>
        <CommentComposer
          value={commentInput}
          onChange={setCommentInput}
          onSubmit={handleSubmitComment}
          replyTarget={commentReplyTarget?.author?.name}
          onCancelReply={handleCancelReply}
          currentUser={currentUser ? { id: currentUser.id, name: currentUser.name || '', avatar_url: currentUser.avatar_url } : undefined}
          loading={commentSubmitting}
        />
      </BottomSheet>

      {!isDesktop && threadSheet}

      <ImageViewer
        visible={imageViewer.visible}
        images={safePostImages}
        initialIndex={imageViewer.index}
        onClose={handleCloseImageViewer}
      />
    </View>
  );
};

export default PostDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },

  // ==================== Mobile Header ====================
  mobileHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnLight: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ==================== Image Carousel ====================
  carouselContainer: {
    position: 'relative',
  },
  carouselImage: {
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageIndicatorText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: '500',
  },

  // ==================== Author Bar ====================
  mobileAuthorBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  authorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  authorTextWrap: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
  },
  authorMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },

  // ==================== Content Section ====================
  contentSection: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 26,
  },

  // ==================== Info Card ====================
  infoCard: {
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  infoCardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
  },
  infoCardLabel: {
    fontSize: 13,
    width: 36,
    lineHeight: 24,
  },
  infoCardValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 24,
  },
  infoCardTags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  flavorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flavorBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },

  // ==================== Tags Row ====================
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationBadge: {
    // backgroundColor is set dynamically
  },
  // 类型徽章颜色已改为动态使用主题语义颜色 (recommend/warning/seeking)
  topicTag: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ==================== Meta Row ====================
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  metaText: {
    fontSize: 12,
  },

  // ==================== Divider ====================
  divider: {
    height: 8,
    marginVertical: 8,
  },

  // ==================== Comments ====================
  commentsSection: {
    padding: 16,
    gap: 16,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  commentsLoading: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  commentsLoadingText: {
    fontSize: 13,
  },
  commentsList: {
    gap: 16,
  },
  commentItem: {},
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyCommentsText: {
    fontSize: 14,
  },
  repliesBlock: {
    marginTop: 8,
    gap: 12,
    marginBottom: 12,
  },
  threadSheet: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  threadSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  threadSheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  threadSheetHeaderSpacer: {
    width: 32,
    height: 32,
  },
  threadSheetScroll: {
    flex: 1,
  },
  threadSheetContent: {
    paddingBottom: 24,
  },
  threadDividerLine: {
    height: 1,
    marginVertical: 8,
  },
  threadLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  threadEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  threadEmptyText: {
    fontSize: 13,
  },
  threadLoadMore: {
    alignSelf: 'center',
    marginTop: 8,
  },
  threadEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },

  // ==================== Bottom Bar ====================
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    minHeight: 56,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  commentInputText: {
    fontSize: 14,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ==================== Share Sheet ====================
  shareSheet: {
    gap: 16,
  },
  shareSheetTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  shareSheetBtns: {
    flexDirection: 'row',
    gap: 12,
  },

  // ==================== Loaders ====================
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },

  // ==================== Desktop Layout ====================
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopLeft: {
    overflow: 'hidden',
  },
  desktopImageIndicator: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  noImagePlaceholder: {
    alignItems: 'center',
  },
  // 桌面端无图渐变样式
  desktopNoImageHero: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  desktopHeroCircle1: {
    width: 300,
    height: 300,
    borderRadius: 150,
    position: 'absolute',
    right: -100,
    top: -50,
    opacity: 0.3,
  },
  desktopHeroCircle2: {
    width: 200,
    height: 200,
    borderRadius: 100,
    position: 'absolute',
    left: -50,
    bottom: 50,
    opacity: 0.2,
  },
  desktopHeroContent: {
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  desktopHeroTitle: {
    fontSize: 28,
    fontWeight: '700',
    // color 在使用时通过 theme.colors.inverseOnSurface 设置（白色文字在彩色渐变背景上）
    textAlign: 'center',
    marginVertical: 16,
    lineHeight: 36,
    // textShadow 颜色使用 theme.colors.shadow
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  desktopRight: {
    flex: 1,
  },
  desktopHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  desktopContent: {
    flex: 1,
  },
  desktopFooter: {
    borderTopWidth: 1,
  },
  desktopBackBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopShareBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ==================== No-Image Hero Header ====================
  heroContainer: {
    position: 'relative',
    minHeight: 280,
    overflow: 'hidden',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  heroCircle1: {
    width: 200,
    height: 200,
    top: -60,
    right: -40,
  },
  heroCircle2: {
    width: 150,
    height: 150,
    bottom: -30,
    left: -30,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  heroTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  // Hero 区域样式 - 白色文字/元素用于彩色渐变背景上（通过 inverseOnSurface 动态设置）
  heroTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    // color: theme.colors.inverseOnSurface (在组件中动态设置)
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    // color: theme.colors.inverseOnSurface (在组件中动态设置)
    letterSpacing: -0.3,
  },
  heroMeta: {
    fontSize: 13,
    // color: 使用 inverseOnSurface 配合 opacity (在组件中动态设置)
  },
  heroAuthorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    // backgroundColor: 使用 inverseOnSurface 配合 15% opacity (在组件中动态设置)
    borderRadius: 16,
    backdropFilter: 'blur(10px)',
  },
  heroAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  heroAuthorText: {
    flex: 1,
  },
  heroAuthorName: {
    fontSize: 15,
    fontWeight: '600',
    // color: theme.colors.inverseOnSurface (在组件中动态设置)
  },
  heroAuthorBio: {
    fontSize: 12,
    // color: 使用 inverseOnSurface 配合 70% opacity (在组件中动态设置)
    marginTop: 2,
  },
  heroFollowBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    // backgroundColor/borderColor: 使用 inverseOnSurface 配合 opacity (在组件中动态设置)
    borderWidth: 1,
  },
  heroFollowBtnFollowed: {
    // backgroundColor/borderColor: theme.colors.inverseOnSurface (在组件中动态设置)
  },
  heroFollowBtnText: {
    fontSize: 13,
    fontWeight: '600',
    // color: theme.colors.inverseOnSurface (在组件中动态设置)
  },

  // ==================== No-Image Content Section ====================
  noImageContentSection: {
    padding: 20,
    gap: 20,
  },
  noImageTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  noImageContentText: {
    fontSize: 16,
    lineHeight: 28,
  },
  // 美化信息卡片
  infoCardEnhanced: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  infoCardEnhancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoCardEnhancedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardEnhancedLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoCardEnhancedValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  // ==================== Fallback Cover (无图帖子占位封面) ====================
  fallbackCover: {
    position: 'relative',
    minHeight: 300,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackGradientBase: {
    ...StyleSheet.absoluteFillObject,
  },
  fallbackMeshLayer1: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    top: -20,
    right: -30,
    borderRadius: 200,
    opacity: 0.6,
    transform: [{ rotate: '15deg' }],
  },
  fallbackMeshLayer2: {
    position: 'absolute',
    width: '80%',
    height: '60%',
    bottom: -40,
    left: -40,
    borderRadius: 150,
    opacity: 0.4,
    transform: [{ rotate: '-20deg' }],
  },
  fallbackMeshLayer3: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    top: '30%',
    left: '25%',
    borderRadius: 100,
    opacity: 0.3,
  },
  fallbackDecorations: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  fallbackCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -40,
    right: -40,
  },
  fallbackCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: 20,
    left: -30,
  },
  fallbackCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: '50%',
    right: '20%',
  },
  fallbackContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    gap: 16,
  },
  fallbackIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fallbackTypeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fallbackTypeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
