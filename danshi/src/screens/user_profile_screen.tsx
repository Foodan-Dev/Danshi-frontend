import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Image, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Text, useTheme as usePaperTheme, ActivityIndicator } from 'react-native-paper';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import type { UserProfile } from '@/src/repositories/users_repository';
import type { UserAggregateStats } from '@/src/models/Stats';
import type { Post } from '@/src/models/Post';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Masonry } from '@/src/components/md3/masonry';
import { PostCard, estimatePostCardHeight } from '@/src/components/post_card';
import { useWaterfallSettings } from '@/src/context/waterfall_context';
import { HOMETOWN_OPTIONS, findOptionLabel } from '@/src/constants/selects';
import { mapUserPostListItemToPost } from '@/src/utils/post_converters';
import { getSafeRemoteUrl } from '@/src/lib/security/url';


const formatCount = (value?: number | null) => {
  if (value == null) return '0';
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`;
};

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = usePaperTheme();
  const { minHeight, maxHeight } = useWaterfallSettings();

  // 响应式间距 - 与探索界面保持一致
  const bp = useBreakpoint();
  const gap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const verticalGap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const horizontalPadding = pickByBreakpoint(bp, { base: 4, sm: 6, md: 12, lg: 16, xl: 20 });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserAggregateStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const safeAvatarUrl = useMemo(() => getSafeRemoteUrl(profile?.avatar_url), [profile?.avatar_url]);

  const isCurrentUser = currentUser?.id === userId;

  // 当头像 URL 变化时重置加载错误状态
  useEffect(() => {
    setAvatarLoadError(false);
  }, [safeAvatarUrl]);

  // 加载用户资料
  const loadUserData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const profileData = await usersService.getUser(userId);
      setProfile(profileData);
      if (profileData.stats) {
        setStats({
          post_count: profileData.stats.post_count,
          follower_count: profileData.stats.follower_count,
          following_count: profileData.stats.following_count,
          total_likes: 0,
          total_favorites: 0,
          total_views: 0,
          comment_count: 0,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 加载用户帖子
  const loadPosts = useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const res = await usersService.getUserPosts(userId, { limit: 20 });
      // 过滤掉不支持的帖子类型（如 companion）和未审核通过的帖子
      const supportedPosts = res.posts.filter((item: any) => 
        (!item.post_type || item.post_type === 'share' || item.post_type === 'seeking') &&
        (!item.status || item.status === 'approved')
      );
      const converted: Post[] = supportedPosts.map((item) => mapUserPostListItemToPost(item));
      setPosts(converted);
    } catch (error: any) {
      // 忽略 companion 类型相关的验证错误
      if (error?.message?.includes('companion') || error?.message?.includes('PostType')) {
        if (__DEV__) console.warn('后端返回了不支持的帖子类型，已忽略');
        setPosts([]);
      } else {
        if (__DEV__) console.warn('Load user posts failed:', error);
      }
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
    await Promise.all([loadUserData(), loadPosts()]);
    setRefreshing(false);
  }, [loadUserData, loadPosts]);

  const handleFollowToggle = async () => {
    if (!userId || !profile) return;
    setFollowLoading(true);
    try {
      if (profile.is_following) {
        await usersService.unfollowUser(userId);
        setProfile({ 
          ...profile, 
          is_following: false, 
          stats: { ...profile.stats, follower_count: profile.stats.follower_count - 1 }
        });
      } else {
        await usersService.followUser(userId);
        setProfile({ 
          ...profile, 
          is_following: true, 
          stats: { ...profile.stats, follower_count: profile.stats.follower_count + 1 }
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePostPress = useCallback((postId: string) => {
    router.push({ pathname: '/post/[postId]', params: { postId } });
  }, []);

  const estimateHeight = useCallback(
    (post: Post) => estimatePostCardHeight(post, minHeight, maxHeight),
    [minHeight, maxHeight]
  );

  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} progressBackgroundColor={theme.colors.surface} progressViewOffset={0} />
        }
      >
        {/* ==================== 顶部操作栏 ==================== */}
        <View style={[styles.headerBar, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
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
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: theme.colors.primaryContainer }]} onPress={loadUserData}>
              <Ionicons name="refresh" size={18} color={theme.colors.primary} />
              <Text style={[styles.retryText, { color: theme.colors.primary }]}>重新加载</Text>
            </Pressable>
          </View>
        ) : profile ? (
          <>
            {/* ==================== 用户信息区 ==================== */}
            <View style={[styles.profileSection, { backgroundColor: theme.colors.surface }]}>
              {/* 头像和用户信息并排 */}
              <View style={styles.profileHeaderRow}>
                <View style={[styles.avatarContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                  {safeAvatarUrl && !avatarLoadError ? (
                    <Image 
                      source={{ uri: safeAvatarUrl }}
                      style={styles.avatar}
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primaryContainer }]}>
                      <Ionicons name="person" size={40} color={theme.colors.primary} />
                    </View>
                  )}
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
                        {profile.name}
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
                      {profile.hometown && profile.hometown !== 'Default' && (
                        <View style={styles.locationRow}>
                          <Ionicons name="location-outline" size={14} color={theme.colors.onSurfaceVariant} />
                          <Text 
                            style={[styles.locationText, { color: theme.colors.onSurfaceVariant }]}
                            numberOfLines={isProfileExpanded ? undefined : 1}
                          >
                            {findOptionLabel(HOMETOWN_OPTIONS, profile.hometown) || profile.hometown}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    {!isCurrentUser && (
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
            <View style={[styles.contentSection, { backgroundColor: theme.colors.surface }]}>
              {postsLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>加载中...</Text>
                </View>
              ) : posts.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="document-text-outline" size={48} color={theme.colors.outlineVariant} />
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    还没有发布帖子
                  </Text>
                </View>
              ) : (
                <View style={[styles.postsGrid, { paddingHorizontal: horizontalPadding }]}>
                  <Masonry
                    data={posts}
                    columns={{ base: 2, md: 2, lg: 3, xl: 4 }}
                    gap={gap}
                    verticalGap={verticalGap}
                    getItemHeight={estimateHeight}
                    keyExtractor={(item) => item.id}
                    renderItem={(item) => <PostCard post={item} onPress={handlePostPress} />}
                  />
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
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
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  postsGrid: {
    paddingBottom: 8,
  },
});
