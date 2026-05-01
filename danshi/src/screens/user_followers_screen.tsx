import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme as usePaperTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import type { FollowUserItem } from '@/src/repositories/users_repository';
import { AppError } from '@/src/lib/errors/app_error';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

const formatCount = (value?: number) => {
  if (value == null) return '0';
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`;
};

type ListType = 'followers' | 'following';

// ==================== UserListItem 组件 ====================
type UserListItemProps = {
  user: FollowUserItem;
  listType: ListType;
  isCurrentUserList: boolean;
  isProcessing: boolean;
  onPress: () => void;
  onFollowBack?: () => void;
  onUnfollow?: () => void;
};

const UserListItem: React.FC<UserListItemProps> = ({
  user,
  listType,
  isCurrentUserList,
  isProcessing,
  onPress,
  onFollowBack,
  onUnfollow,
}) => {
  const theme = usePaperTheme();
  const isFollowed = !!user.is_following;
  const safeAvatarUrl = getSafeRemoteUrl(user.avatar_url);
  
  // 判断是否互关
  const isMutual = listType === 'followers' && isFollowed;

  const renderActionButton = () => {
    // 如果不是当前用户的列表，不显示操作按钮（只读模式）
    if (!isCurrentUserList) {
      return null;
    }

    if (listType === 'followers') {
      // 粉丝列表：显示回关或已关注
      return (
        <Pressable
          style={[
            styles.actionBtn,
            isFollowed
              ? { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }
              : { backgroundColor: theme.colors.primary },
          ]}
          onPress={isFollowed ? undefined : onFollowBack}
          disabled={isProcessing || isFollowed}
        >
          {isProcessing ? (
            <ActivityIndicator size={14} color={isFollowed ? theme.colors.onSurfaceVariant : theme.colors.onPrimary} />
          ) : (
            <>
              {isFollowed && (
                <Ionicons name="checkmark" size={14} color={theme.colors.onSurfaceVariant} style={{ marginRight: 4 }} />
              )}
              <Text
                style={[
                  styles.actionBtnText,
                  { color: isFollowed ? theme.colors.onSurfaceVariant : theme.colors.onPrimary },
                ]}
              >
                {isMutual ? '互关' : isFollowed ? '已关注' : '回关'}
              </Text>
            </>
          )}
        </Pressable>
      );
    } else {
      // 关注列表：显示已关注，点击可取消
      return (
        <Pressable
          style={[
            styles.actionBtn,
            { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline },
          ]}
          onPress={onUnfollow}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size={14} color={theme.colors.onSurfaceVariant} />
          ) : (
            <>
              <Ionicons name="checkmark" size={14} color={theme.colors.onSurfaceVariant} style={{ marginRight: 4 }} />
              <Text style={[styles.actionBtnText, { color: theme.colors.onSurfaceVariant }]}>
                已关注
              </Text>
            </>
          )}
        </Pressable>
      );
    }
  };

  return (
    <Pressable
      style={[styles.userCard, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
    >
      {/* 左侧：头像 */}
      <View style={styles.avatarContainer}>
        {safeAvatarUrl ? (
          <Image source={{ uri: safeAvatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name="person" size={24} color={theme.colors.primary} />
          </View>
        )}
      </View>

      {/* 中间：用户信息 */}
      <View style={styles.infoContainer}>
        <Text style={[styles.userName, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={[styles.userBio, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {user.bio || '这个用户还没有填写简介'}
        </Text>
        <View style={styles.statsRow}>
          <Text style={[styles.statsText, { color: theme.colors.onSurfaceVariant }]}>
            {formatCount(user.stats?.post_count)} 帖子
          </Text>
          <Text style={[styles.statsDot, { color: theme.colors.outline }]}>·</Text>
          <Text style={[styles.statsText, { color: theme.colors.onSurfaceVariant }]}>
            {formatCount(user.stats?.follower_count)} 粉丝
          </Text>
        </View>
      </View>

      {/* 右侧：操作按钮 */}
      <View style={styles.actionContainer}>
        {renderActionButton()}
      </View>
    </Pressable>
  );
};

// ==================== 主屏幕 ====================
type UserFollowListScreenProps = {
  type: ListType;
};

export const UserFollowListScreen: React.FC<UserFollowListScreenProps> = ({ type }) => {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<FollowUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const insets = useSafeAreaInsets();
  const theme = usePaperTheme();
  const router = useRouter();
  const bottomPadding = insets.bottom + 24;

  // 判断是否是当前用户的列表（可以进行回关/取消关注操作）
  const isCurrentUserList = currentUser?.id === userId;

  const title = type === 'followers' ? '粉丝' : '关注';

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, [router]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId) return;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const data =
          type === 'followers'
            ? await usersService.getUserFollowers(userId)
            : await usersService.getUserFollowing(userId);
        setItems(data.users);
      } catch (err) {
        const message = err instanceof AppError ? err.message : '读取数据失败，请稍后重试';
        setError(message);
      } finally {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [userId, type],
  );

  useEffect(() => {
    load();
  }, [load]);

  const navigateToProfile = useCallback(
    (targetId: string) => {
      router.push(`/user/${targetId}`);
    },
    [router],
  );

  const withActionLoading = useCallback((targetUserId: string, value: boolean) => {
    setActionLoading((prev) => ({ ...prev, [targetUserId]: value }));
  }, []);

  const handleFollowBack = useCallback(
    async (targetId: string) => {
      setError(null);
      withActionLoading(targetId, true);
      try {
        await usersService.followUser(targetId);
        setItems((prev) =>
          prev.map((item) => (item.id === targetId ? { ...item, is_following: true } : item)),
        );
      } catch (err) {
        const message = err instanceof AppError ? err.message : '操作失败，请稍后重试';
        setError(message);
      } finally {
        withActionLoading(targetId, false);
      }
    },
    [withActionLoading],
  );

  const handleUnfollow = useCallback(
    async (targetId: string) => {
      setError(null);
      withActionLoading(targetId, true);
      try {
        await usersService.unfollowUser(targetId);
        setItems((prev) => prev.filter((item) => item.id !== targetId));
      } catch (err) {
        const message = err instanceof AppError ? err.message : '操作失败，请稍后重试';
        setError(message);
      } finally {
        withActionLoading(targetId, false);
      }
    },
    [withActionLoading],
  );

  const renderItem = ({ item }: { item: FollowUserItem }) => {
    const isProcessing = !!actionLoading[item.id];

    return (
      <UserListItem
        user={item}
        listType={type}
        isCurrentUserList={isCurrentUserList}
        isProcessing={isProcessing}
        onPress={() => navigateToProfile(item.id)}
        onFollowBack={() => handleFollowBack(item.id)}
        onUnfollow={() => handleUnfollow(item.id)}
      />
    );
  };

  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* 顶部操作栏 */}
        <View style={[styles.headerBar, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface }]}>
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>{title}</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.outlineVariant} />
          <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>用户ID缺失</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 顶部操作栏 */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, backgroundColor: theme.colors.surface }]}>
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>{title}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator animating size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
              progressBackgroundColor={theme.colors.surface}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.emptyListContent,
            { paddingBottom: bottomPadding },
          ]}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.colors.outlineVariant }]} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={type === 'followers' ? 'people-outline' : 'heart-outline'}
                size={56}
                color={theme.colors.outlineVariant}
              />
              <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                {type === 'followers' ? '还没有粉丝' : '还没有关注任何人'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {type === 'followers' ? '发布更多精彩内容来吸引粉丝吧' : '去发现页面找找感兴趣的用户吧'}
              </Text>
            </View>
          }
        />
      )}
      {error ? (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

// 导出具体页面组件
export const UserFollowersScreen: React.FC = () => <UserFollowListScreen type="followers" />;
export const UserFollowingScreen: React.FC = () => <UserFollowListScreen type="following" />;

const styles = StyleSheet.create({
  container: {
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },

  // ==================== User Card ====================
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 12,
  },
  statsDot: {
    fontSize: 12,
    marginHorizontal: 6,
  },
  actionContainer: {
    alignItems: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 72,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ==================== Empty State ====================
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // ==================== Error ====================
  errorContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
});

export default UserFollowersScreen;

