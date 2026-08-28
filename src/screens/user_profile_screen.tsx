import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text, useTheme as usePaperTheme, ActivityIndicator } from 'react-native-paper';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import type { UserProfile } from '@/src/repositories/users_repository';
import type { UserStats } from '@/src/models/User';
import type { Post } from '@/src/models/Post';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PostCard } from '@/src/components/post_card';
import { mapUserPostListItemToPost } from '@/src/utils/post_converters';
import { CachedAvatar } from '@/src/components/cached_avatar';
import { usePostChangeSync } from '@/src/hooks/use_post_change_sync';
import { UNSET_NICKNAME } from '@/src/constants/user';


const formatCount = (value?: number | null) => {
  if (value == null) return '0';
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`;
};

const getPostId = (post: Post) => post.id;
const mapChangedPost = (post: Post) => post;

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = useMemo(() => {
    const raw = Array.isArray(params.userId) ? params.userId[0] : params.userId;
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, [params.userId]);
  const { user: currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = usePaperTheme();

  // 响应式间距 - 与探索界面保持一致
  const bp = useBreakpoint();
  const gap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const verticalGap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const horizontalPadding = pickByBreakpoint(bp, { base: 4, sm: 6, md: 12, lg: 16, xl: 20 });
  const numColumns = pickByBreakpoint(bp, { base: 2, md: 2, lg: 3, xl: 4 });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [followError, setFollowError] = useState('');
  const [postsError, setPostsError] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  usePostChangeSync({
    setItems: setPosts,
    getPostId,
    mapPost: mapChangedPost,
    publicOnly: true,
  });

  const isCurrentUser = currentUser?.id === userId;
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/explore');
  }, []);

  // 加载用户资料
  const loadUserData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setProfileError('');
    try {
      const profileData = await usersService.getUser(userId);
      setProfile(profileData);
      if (profileData.stats) {
        setStats(profileData.stats);
      } else {
        setStats(null);
      }
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : '加载用户资料失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 加载用户帖子
  const loadPosts = useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    setPostsError('');
    try {
      const res = await usersService.getUserPosts(userId, { limit: 20 });
      const supportedPosts = res.posts.filter((item) => item.status === 'approved');
      const converted: Post[] = supportedPosts.map((item) => mapUserPostListItemToPost(item));
      setPosts(converted);
    } catch (error) {
      setPostsError(error instanceof Error ? error.message : '加载用户帖子失败，请稍后重试');
      if (__DEV__) console.warn('Load user posts failed:', error);
    } finally {
      setPostsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadUserData();
    loadPosts();
  }, [userId, loadUserData, loadPosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setFollowError('');
    await Promise.all([loadUserData(), loadPosts()]);
    setRefreshing(false);
  }, [loadUserData, loadPosts]);

  const handleFollowToggle = useCallback(async () => {
    if (!userId || !profile) return;
    if (!currentUser) {
      setFollowError('请先登录后再关注用户');
      return;
    }
    setFollowLoading(true);
    setFollowError('');
    try {
      if (profile.is_following) {
        const result = await usersService.unfollowUser(userId);
        setProfile((prev) => prev ? {
          ...prev,
          is_following: result.is_following,
          stats: { ...prev.stats, follower_count: Math.max(0, result.follower_count) },
        } : prev);
      } else {
        const result = await usersService.followUser(userId);
        setProfile((prev) => prev ? {
          ...prev,
          is_following: result.is_following,
          stats: { ...prev.stats, follower_count: Math.max(0, result.follower_count) },
        } : prev);
      }
    } catch (e) {
      setFollowError(e instanceof Error ? e.message : '关注操作失败，请稍后重试');
    } finally {
      setFollowLoading(false);
    }
  }, [currentUser, profile, userId]);

  const handlePostPress = useCallback((postId: number) => {
    router.push({ pathname: '/post/[postId]', params: { postId: String(postId) } });
  }, []);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <View style={{ marginHorizontal: gap / 2, marginBottom: verticalGap }}>
        <PostCard post={item} onPress={handlePostPress} />
      </View>
    ),
    [gap, handlePostPress, verticalGap]
  );

  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface }]}>
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>用户主页</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>用户ID缺失</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlashList
        style={styles.scrollView}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24 }}
        data={profile && !postsLoading ? posts : []}
        masonry
        optimizeItemArrangement={false}
        numColumns={numColumns}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} progressBackgroundColor={theme.colors.surface} progressViewOffset={0} />
        }
        ListHeaderComponent={
          <View style={{ marginHorizontal: -horizontalPadding }}>
        {/* ==================== 顶部操作栏 ==================== */}
        <View style={[styles.headerBar, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface }]}>
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>用户主页</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {loading && !profile ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>加载中...</Text>
          </View>
        ) : profileError && !profile ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{profileError}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: theme.colors.primaryContainer }]} onPress={handleRefresh}>
              <Ionicons name="refresh" size={18} color={theme.colors.primary} />
              <Text style={[styles.retryText, { color: theme.colors.primary }]}>重新加载</Text>
            </Pressable>
          </View>
        ) : profile ? (
          <>
            {followError || (profileError && profile) ? (
              <View style={[styles.inlineError, { backgroundColor: theme.colors.errorContainer }]}>
                <Text style={{ color: theme.colors.error }}>{followError || profileError}</Text>
              </View>
            ) : null}
            {/* ==================== 用户信息区 ==================== */}
            <View style={[styles.profileSection, { backgroundColor: theme.colors.surface }]}>
              {/* 头像和用户信息并排 */}
              <View style={styles.profileHeaderRow}>
                <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                  <CachedAvatar
                    uri={profile.avatar_url}
                    size={88}
                    backgroundColor={theme.colors.primaryContainer}
                    iconColor={theme.colors.primary}
                    iconSize={40}
                  />
                </View>
                <View style={styles.userInfoColumn}>
                  <View style={styles.userInfoRow}>
                    <Pressable 
                      style={styles.userNameSection}
                      onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                    >
                      <Text 
                        style={[styles.userName, { color: theme.colors.onSurface }]}
                        numberOfLines={isProfileExpanded ? undefined : 1}
                      >
                        {profile.name || UNSET_NICKNAME}
                      </Text>
                      {profile.bio ? (
                        <Text 
                          style={[styles.userBio, { color: theme.colors.onSurfaceVariant }]} 
                          numberOfLines={isProfileExpanded ? undefined : 2}
                        >
                          {profile.bio}
                        </Text>
                      ) : null}
                      {profile.email && (
                        <Text 
                          style={[styles.userEmail, { color: theme.colors.onSurfaceVariant }]}
                          numberOfLines={isProfileExpanded ? undefined : 1}
                        >
                          {profile.email}
                        </Text>
                      )}
                    </Pressable>
                    {currentUser && !isCurrentUser && (
                      <Pressable
                        style={[
                          styles.followBtn,
                          profile.is_following
                            ? { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }
                            : { backgroundColor: theme.colors.primary }
                        ]}
                        onPress={handleFollowToggle}
                        disabled={followLoading}
                      >
                        {followLoading ? (
                          <ActivityIndicator size="small" color={profile.is_following ? theme.colors.onSurfaceVariant : theme.colors.onPrimary} />
                        ) : (
                          <>
                            <Ionicons
                              name={profile.is_following ? 'checkmark' : 'add'}
                              size={16}
                              color={profile.is_following ? theme.colors.onSurfaceVariant : theme.colors.onPrimary}
                            />
                            <Text
                              style={[
                                styles.followBtnText,
                                { color: profile.is_following ? theme.colors.onSurfaceVariant : theme.colors.onPrimary }
                              ]}
                            >
                              {profile.is_following ? '已关注' : '关注'}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              {/* 数据栏 */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(stats?.post_count)}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>帖子</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.colors.outline }]} />
                <Pressable style={styles.statItem} onPress={() => router.push(`/user/${userId}/followers` as Href)}>
                  <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(profile.stats.follower_count)}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>粉丝</Text>
                </Pressable>
                <View style={[styles.statDivider, { backgroundColor: theme.colors.outline }]} />
                <Pressable style={styles.statItem} onPress={() => router.push(`/user/${userId}/following` as Href)}>
                  <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(profile.stats.following_count)}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>关注</Text>
                </Pressable>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(stats?.like_count)}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>获赞</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.colors.outline }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(stats?.favorite_count)}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>收藏</Text>
                </View>
              </View>
            </View>

            {/* ==================== 帖子标题栏 ==================== */}
            <View style={[styles.tabSection, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.tabBar, { borderBottomColor: theme.colors.outlineVariant }]}>
                <View style={[styles.tabItem, styles.tabItemActive, { borderBottomColor: theme.colors.primary }]}>
                  <Ionicons name="grid" size={20} color={theme.colors.primary} />
                  <Text style={[styles.tabText, { color: theme.colors.primary }]}>TA的帖子</Text>
                </View>
              </View>
            </View>

            {/* ==================== 帖子列表 ==================== */}
            {postsError && posts.length > 0 ? (
              <View style={[styles.inlineError, { backgroundColor: theme.colors.errorContainer, marginHorizontal: horizontalPadding, marginVertical: 12 }]}>
                <Text style={{ color: theme.colors.error }}>{postsError}</Text>
              </View>
            ) : null}
            {posts.length > 0 ? <View style={styles.listTopSpacing} /> : null}
          </>
        ) : null}
          </View>
        }
        ListEmptyComponent={
          profile ? (
            <View style={[styles.contentSection, { backgroundColor: theme.colors.surface, marginHorizontal: -horizontalPadding }]}>
              {postsLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>加载中...</Text>
                </View>
              ) : postsError && posts.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
                  <Text style={[styles.emptyText, { color: theme.colors.error }]}>
                    {postsError}
                  </Text>
                  <Pressable style={[styles.retryBtn, { backgroundColor: theme.colors.primaryContainer }]} onPress={loadPosts}>
                    <Ionicons name="refresh" size={18} color={theme.colors.primary} />
                    <Text style={[styles.retryText, { color: theme.colors.primary }]}>重试</Text>
                  </Pressable>
                </View>
              ) : posts.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="document-text-outline" size={48} color={theme.colors.outlineVariant} />
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    还没有发布帖子
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==================== Header Bar ====================
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerPlaceholder: {
    width: 40,
  },

  // ==================== Loading & Error ====================
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  inlineError: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ==================== Profile Section ====================
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
  },
  userInfoColumn: {
    flex: 1,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userNameSection: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 4,
  },
  userBio: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ==================== Stats Row ====================
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },

  // ==================== Tab Section ====================
  tabSection: {
    marginTop: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ==================== Content Section ====================
  contentSection: {
    minHeight: 200,
    paddingTop: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  listTopSpacing: {
    height: 4,
  },
});
