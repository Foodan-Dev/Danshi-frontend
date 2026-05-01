import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, Text, useTheme as usePaperTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/auth_context';
import { useNotifications, formatUnreadCount } from '@/src/context/notifications_context';
import { usersService } from '@/src/services/users_service';
import type { UserAggregateStats } from '@/src/models/Stats';
import type { UserProfile } from '@/src/repositories/users_repository';
import type { Post } from '@/src/models/Post';
import { ROLES } from '@/src/constants/app';
import { Masonry } from '@/src/components/md3/masonry';
import { PostCard, estimatePostCardHeight } from '@/src/components/post_card';
import { useWaterfallSettings } from '@/src/context/waterfall_context';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { mapUserPostListItemToPost } from '@/src/utils/post_converters';
import { LinearGradient } from 'expo-linear-gradient';
import { getSafeRemoteUrl } from '@/src/lib/security/url';



const formatCount = (value?: number | null) => {
  if (value == null) return '0';
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`;
};

type TabType = 'posts' | 'favorites';

// ==================== 管理员徽章组件 ====================
type RoleBadgeProps = {
  role: string;
};

const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const theme = usePaperTheme();
  const normalized = String(role).toLowerCase();
  if (normalized === 'super_admin') {
    return (
      <LinearGradient
        colors={[theme.colors.error, theme.colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.superAdminBadge}
      >
        <Ionicons name="shield-checkmark" size={12} color={theme.colors.onError} />
        <Text style={[styles.superAdminBadgeText, { color: theme.colors.onError }]}>超级管理员</Text>
      </LinearGradient>
    );
  }
  if (normalized === 'admin') {
    return (
      <View style={[styles.adminBadge, { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }]}>
        <Ionicons name="shield" size={12} color={theme.colors.primary} />
        <Text style={[styles.adminBadgeText, { color: theme.colors.primary }]}>管理员</Text>
      </View>
    );
  }
  return null;
};

// ==================== 管理控制台入口卡片组件 ====================
type AdminConsoleCardProps = {
  role: string;
};

const AdminConsoleCard: React.FC<AdminConsoleCardProps> = ({ role }) => {
  const theme = usePaperTheme();
  const normalized = String(role).toLowerCase();
  const userIsAdmin = normalized === 'admin' || normalized === 'super_admin';
  
  if (!userIsAdmin) return null;
  
  // 获取扩展的主题色
  const colors = theme.colors as typeof theme.colors & {
    surfaceContainer: string;
    surfaceContainerHigh: string;
  };
  
  return (
    <Pressable
      style={styles.adminConsoleWrapper}
      onPress={() => router.push('/myself/admin' as Href)}
    >
      <View
        style={[
          styles.adminConsoleCard, 
          { 
            backgroundColor: colors.surfaceContainer,
            borderColor: `${theme.colors.primary}4D`, // 30% opacity
          }
        ]}
      >
        {/* 左侧：盾牌图标 */}
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.tertiary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.adminConsoleIconBg}
        >
          <Ionicons name="shield-checkmark" size={20} color={theme.colors.onPrimary} />
        </LinearGradient>
        
        {/* 中间：文字 */}
        <View style={styles.adminConsoleTextWrap}>
          <Text style={[styles.adminConsoleTitle, { color: theme.colors.onSurface }]}>管理中心</Text>
          <Text style={[styles.adminConsoleSubtitle, { color: theme.colors.onSurfaceVariant }]}>处理审核、用户与系统消息</Text>
        </View>
        
        {/* 右侧：箭头 */}
        <Ionicons name="chevron-forward" size={22} color={theme.colors.primary} />
      </View>
    </Pressable>
  );
};

export default function MyselfScreen() {
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const theme = usePaperTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { minHeight, maxHeight } = useWaterfallSettings();
  const tabBarHeight = useBottomTabBarHeight();
  const bottomContentPadding = useMemo(() => tabBarHeight + 24, [tabBarHeight]);

  // 响应式间距 - 与探索界面保持一致
  const bp = useBreakpoint();
  const gap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const verticalGap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const horizontalPadding = pickByBreakpoint(bp, { base: 4, sm: 6, md: 12, lg: 16, xl: 20 });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserAggregateStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [favorites, setFavorites] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const displayName = useMemo(
    () => profile?.name ?? user?.name ?? '未登录',
    [profile?.name, user?.name]
  );
  const displayEmail = useMemo(
    () => profile?.email ?? user?.email ?? undefined,
    [profile?.email, user?.email]
  );
  const avatarUrl = useMemo(
    () => profile?.avatar_url ?? user?.avatar_url ?? null,
    [profile?.avatar_url, user?.avatar_url]
  );
  const safeAvatarUrl = useMemo(() => getSafeRemoteUrl(avatarUrl), [avatarUrl]);

  // 当 avatarUrl 变化时重置加载错误状态
  useEffect(() => {
    setAvatarLoadError(false);
  }, [safeAvatarUrl]);

  // 加载用户资料
  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const fetchedProfile = await usersService.getUser(user.id);
      setProfile(fetchedProfile);
      if (fetchedProfile.stats) {
        setStats({
          post_count: fetchedProfile.stats.post_count,
          follower_count: fetchedProfile.stats.follower_count,
          following_count: fetchedProfile.stats.following_count,
          total_likes: 0,
          total_favorites: 0,
          total_views: 0,
          comment_count: 0,
        });
      }
    } catch (error) {
      if (__DEV__) console.warn('Load profile failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // 加载我的帖子
  const loadPosts = useCallback(async () => {
    if (!user?.id) return;
    setPostsLoading(true);
    try {
      const res = await usersService.getUserPosts(user.id, { limit: 20 });
      // 过滤掉不支持的帖子类型（如 companion）
      const supportedPosts = res.posts.filter((item: any) =>
        !item.post_type || item.post_type === 'share' || item.post_type === 'seeking'
      );
      // 传递当前用户作为作者信息
      const authorInfo = {
        id: user.id,
        name: profile?.name || user.name || '未知用户',
        avatar_url: profile?.avatar_url || user.avatar_url || undefined,
      };
      setPosts(supportedPosts.map((item) => mapUserPostListItemToPost(item, { author: authorInfo })));
    } catch (error: any) {
      // 忽略 companion 类型相关的验证错误
      if (error?.message?.includes('companion') || error?.message?.includes('PostType')) {
        if (__DEV__) console.warn('后端返回了不支持的帖子类型，已忽略');
        setPosts([]);
      } else {
        if (__DEV__) console.warn('Load posts failed:', error);
      }
    } finally {
      setPostsLoading(false);
    }
  }, [user?.id, user?.name, user?.avatar_url, profile?.name, profile?.avatar_url]);

  // 加载收藏的帖子
  const loadFavorites = useCallback(async () => {
    if (!user?.id) return;
    setFavoritesLoading(true);
    try {
      const res = await usersService.getUserFavorites(user.id, { limit: 20 });
      // 过滤掉不支持的帖子类型（如 companion）
      const supportedPosts = res.posts.filter((item: any) =>
        !item.post_type || item.post_type === 'share' || item.post_type === 'seeking'
      );
      setFavorites(
        supportedPosts.map((item) => mapUserPostListItemToPost(item, { forceFavorite: true }))
      );
    } catch (error: any) {
      // 忽略 companion 类型相关的验证错误
      if (error?.message?.includes('companion') || error?.message?.includes('PostType')) {
        if (__DEV__) console.warn('后端返回了不支持的帖子类型，已忽略');
        setFavorites([]);
      } else {
        if (__DEV__) console.warn('Load favorites failed:', error);
      }
    } finally {
      setFavoritesLoading(false);
    }
  }, [user?.id]);

  // 页面获得焦点时刷新数据
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadPosts();
      if (activeTab === 'favorites') {
        loadFavorites();
      }
    }, [loadProfile, loadPosts, loadFavorites, activeTab])
  );

  // 切换到收藏 tab 时加载收藏
  useEffect(() => {
    if (activeTab === 'favorites' && favorites.length === 0) {
      loadFavorites();
    }
  }, [activeTab, favorites.length, loadFavorites]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), activeTab === 'posts' ? loadPosts() : loadFavorites()]);
    setRefreshing(false);
  }, [loadProfile, loadPosts, loadFavorites, activeTab]);

  const handlePostPress = useCallback((postId: string) => {
    router.push({ pathname: '/post/[postId]', params: { postId } });
  }, []);

  const estimateHeight = useCallback(
    (post: Post) => estimatePostCardHeight(post, minHeight, maxHeight),
    [minHeight, maxHeight]
  );

  const currentPosts = activeTab === 'posts' ? posts : favorites;
  const currentLoading = activeTab === 'posts' ? postsLoading : favoritesLoading;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomContentPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} progressBackgroundColor={theme.colors.surface} progressViewOffset={0} />
        }
      >
        {/* ==================== 顶部操作栏 ==================== */}
        <View style={[styles.headerBar, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>个人中心</Text>
          <View style={styles.headerRight}>
            {/* 通知入口 */}
            <Pressable style={styles.headerBtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={24} color={theme.colors.onSurfaceVariant} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                  <Text style={styles.badgeText}>{formatUnreadCount(unreadCount)}</Text>
                </View>
              )}
            </Pressable>
            {/* 设置入口 */}
            <Pressable style={styles.headerBtn} onPress={() => router.push('/myself/settings')}>
              <Ionicons name="settings-outline" size={24} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          </View>
        </View>

        {/* ==================== 用户信息区 ==================== */}
        <View style={[styles.profileSectionSimple, { backgroundColor: theme.colors.surface }]}>
          {/* 悬浮头像 */}
          <View style={styles.profileHeaderRow}>
            <Pressable
              style={[styles.avatarContainer, { backgroundColor: theme.colors.primaryContainer }]}
              onPress={() => router.push('/myself/settings')}
            >
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
            </Pressable>
            <View style={styles.userInfoColumn}>
              <View style={styles.userInfoRow}>
                <Pressable 
                  style={styles.userNameSection}
                  onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                >
                  <View style={styles.userNameRow}>
                    <Text 
                      style={[styles.userName, { color: theme.colors.onSurface }]}
                      numberOfLines={isProfileExpanded ? undefined : 1}
                    >
                      {displayName}
                    </Text>
                    {user?.role && user.role !== ROLES.USER && <RoleBadge role={user.role} />}
                  </View>
                  {profile?.bio ? (
                    <Text 
                      style={[styles.userBio, { color: theme.colors.onSurfaceVariant }]} 
                      numberOfLines={isProfileExpanded ? undefined : 2}
                    >
                      {profile.bio}
                    </Text>
                  ) : null}
                  {displayEmail ? (
                    <Text 
                      style={[styles.userEmail, { color: theme.colors.onSurfaceVariant }]}
                      numberOfLines={isProfileExpanded ? undefined : 1}
                    >
                      {displayEmail}
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            </View>
          </View>

          {/* 数据栏 */}
          <View style={styles.statsRow}>
            <Pressable style={styles.statItem} onPress={() => router.push('/myself/posts' as Href)}>
              <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(stats?.post_count)}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>帖子</Text>
            </Pressable>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.outline }]} />
            <Pressable style={styles.statItem} onPress={() => router.push('/myself/followers' as Href)}>
              <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(stats?.follower_count)}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>粉丝</Text>
            </Pressable>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.outline }]} />
            <Pressable style={styles.statItem} onPress={() => router.push('/myself/following' as Href)}>
              <Text style={[styles.statNumber, { color: theme.colors.onSurface }]}>{formatCount(stats?.following_count)}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>关注</Text>
            </Pressable>
          </View>
        </View>

        {/* ==================== 管理控制台（仅管理员可见）==================== */}
        {user?.role && user.role !== ROLES.USER && <AdminConsoleCard role={user.role} />}

        {/* ==================== Tab 切换栏 ==================== */}
        <View style={[styles.tabSection, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.tabBar, { borderBottomColor: theme.colors.outlineVariant }]}>
            <Pressable
              style={[styles.tabItem, activeTab === 'posts' && [styles.tabItemActive, { borderBottomColor: theme.colors.primary }]]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons
                name={activeTab === 'posts' ? 'grid' : 'grid-outline'}
                size={20}
                color={activeTab === 'posts' ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <Text style={[styles.tabText, { color: activeTab === 'posts' ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                帖子
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabItem, activeTab === 'favorites' && [styles.tabItemActive, { borderBottomColor: theme.colors.primary }]]}
              onPress={() => setActiveTab('favorites')}
            >
              <Ionicons
                name={activeTab === 'favorites' ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={activeTab === 'favorites' ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <Text style={[styles.tabText, { color: activeTab === 'favorites' ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                收藏
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ==================== 内容列表 ==================== */}
        <View style={[styles.contentSection, { backgroundColor: theme.colors.surface }]}>
          {currentLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>加载中...</Text>
            </View>
          ) : currentPosts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name={activeTab === 'posts' ? 'document-text-outline' : 'bookmark-outline'}
                size={48}
                color={theme.colors.outlineVariant}
              />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                {activeTab === 'posts' ? '还没有发布帖子' : '还没有收藏内容'}
              </Text>
              {activeTab === 'posts' && (
                <Pressable
                  style={[styles.emptyBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => router.push('/(tabs)/post')}
                >
                  <Text style={[styles.emptyBtnText, { color: theme.colors.onPrimary }]}>去发布</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={[styles.postsGrid, { paddingHorizontal: horizontalPadding }]}>
              <Masonry
                data={currentPosts}
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

  // ==================== Header Bar ====================
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // ==================== Profile Section ====================
  profileSectionSimple: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
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
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userInfoColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
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
  editProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ==================== Stats Row ====================
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
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
    marginTop: 0,
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
  },
  tabItemActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    // color is set dynamically
  },

  // ==================== Content Section ====================
  contentSection: {
    minHeight: 200,
    paddingTop: 16,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  postsGrid: {
    paddingBottom: 8,
  },

  // ==================== User Name Row (with Badge) ====================
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  // ==================== Role Badges ====================
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    // 仅 ViewStyle 属性，无 web-only 属性
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    // 仅 TextStyle 属性，无 web-only 属性
  },
  superAdminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: '#9333ea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    // 移除 web-only 属性，确保只用 ViewStyle
  },
  superAdminBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    // color is set dynamically
  },

  // ==================== Admin Console Card ====================
  adminConsoleWrapper: {
    marginTop: 12,
    marginHorizontal: 16,
  },
  adminConsoleCard: {
    height: 72,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 39, 0.3)', // #FF7F27 at 30% opacity
  },
  adminConsoleIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminConsoleTextWrap: {
    flex: 1,
    gap: 2,
  },
  adminConsoleTitle: {
    fontSize: 16,
    fontWeight: '700',
    // color is set dynamically
  },
  adminConsoleSubtitle: {
    fontSize: 12,
    // color is set dynamically
  },
});



