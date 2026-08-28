import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Appbar, Card, Text, useTheme as usePaperTheme, Button, Menu, IconButton, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useAuth } from '@/src/context/auth_context';
import { isSuperAdmin } from '@/src/lib/auth/roles';
import { adminService } from '@/src/services/admin_service';
import {
  getAdminUserBanState,
  type AdminUserStatusInput,
  type AdminUserStatusResult,
  type AdminUserSummary,
} from '@/src/repositories/admin_repository';
import type { Role } from '@/src/constants/app';
import type { ManagementRole } from '@/src/models/User';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ROLES } from '@/src/constants/app';
import { formatDate } from '@/src/utils/time_format';
import { UserAvatar } from '@/src/components/user_avatar';
import { LinearGradient } from 'expo-linear-gradient';
import { BanUserSheet } from '@/src/components/admin/ban_user_sheet';

const SCREEN_LOADED_AT = Date.now();
import { UNSET_NICKNAME } from '@/src/constants/user';

// 身份标签组件
type RoleBadgeProps = {
  role: Role;
};

const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const pTheme = usePaperTheme();

  if (role === ROLES.SUPER_ADMIN) {
    return (
      <LinearGradient
        colors={[pTheme.colors.error, pTheme.colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.roleBadge}
      >
        <Ionicons name="shield-checkmark" size={10} color={pTheme.colors.onError} />
        <Text style={[styles.roleBadgeText, { color: pTheme.colors.onError }]}>超管</Text>
      </LinearGradient>
    );
  }

  if (role === ROLES.ADMIN) {
    return (
      <View style={[styles.roleBadge, { backgroundColor: pTheme.colors.primaryContainer }]}>
        <Ionicons name="shield" size={10} color={pTheme.colors.primary} />
        <Text style={[styles.roleBadgeText, { color: pTheme.colors.primary }]}>管理</Text>
      </View>
    );
  }

  // 普通用户不显示标签
  return null;
};

export default function AdminUsersScreen() {
  const pTheme = usePaperTheme();
  const insets = useSafeAreaInsets();
  const { current } = useResponsive();
  const { user, isLoading } = useAuth();

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [menuVisible, setMenuVisible] = useState<number | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUserSummary | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [now, setNow] = useState(SCREEN_LOADED_AT);
  const requestSeqRef = useRef(0);

  const contentHorizontalPadding = pickByBreakpoint(current, { base: 12, sm: 16, md: 20, lg: 24, xl: 24 });

  // 获取扩展的主题色
  const colors = pTheme.colors as typeof pTheme.colors & {
    surfaceContainer: string;
    surfaceContainerHigh: string;
  };

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/myself/admin');
  }, []);

  const loadUsers = useCallback(async (isRefresh = false) => {
    if (!user || !isSuperAdmin(user.roles)) return;
    const requestId = ++requestSeqRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    try {
      const result = await adminService.getUsers({});
      if (requestSeqRef.current !== requestId) {
        return;
      }
      setUsers(result.users);
    } catch (e) {
      if (requestSeqRef.current !== requestId) {
        return;
      }
      setLoadError(e instanceof Error ? e.message : '读取用户失败，请稍后重试');
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (isLoading || !user || !isSuperAdmin(user.roles)) {
      return;
    }
    void loadUsers();
  }, [isLoading, loadUsers, user]);

  useEffect(() => {
    const refreshNow = () => setNow(Date.now());
    refreshNow();
    const timer = setInterval(refreshNow, 30_000);
    return () => clearInterval(timer);
  }, []);

  const canManageRole = !!user && isSuperAdmin(user.roles);

  const handleUpdateRole = async (userId: number, role: ManagementRole, action: 'grant' | 'revoke') => {
    setActionError('');
    try {
      await adminService.updateUserRole(userId, { role, action });
      await loadUsers();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '修改用户身份失败，请稍后重试');
    }
  };

  const applyStatusResult = useCallback((result: AdminUserStatusResult) => {
    setUsers((previous) => previous.map((listedUser) => listedUser.id === result.user_id
      ? {
          ...listedUser,
          is_active: result.is_active,
          is_banned: result.is_banned,
          ban_reason: result.ban_reason,
          banned_until: result.banned_until,
          ban_is_permanent: result.ban_is_permanent,
          banned_by: result.banned_by,
        }
      : listedUser));
    setNow(Date.now());
  }, []);

  const handleBanUser = async (userId: number, input: AdminUserStatusInput) => {
    setActionError('');
    const result = await adminService.updateUserStatus(userId, input);
    applyStatusResult(result);
  };

  const handleUnbanUser = async (userId: number) => {
    setActionError('');
    setStatusUpdatingId(userId);
    try {
      const result = await adminService.updateUserStatus(userId, { ban_is_permanent: false });
      applyStatusResult(result);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '解封失败，请稍后重试');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const formatFullDate = (dateStr: string | null) => {
    if (!dateStr) return '创建时间未知';
    return formatDate(dateStr, 'full') || '创建时间未知';
  };

  const formatBanDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '未知时间';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${formatDate(dateStr, 'full')} ${hours}:${minutes}`;
  };

  const renderUser = ({ item: listedUser }: { item: AdminUserSummary }) => {
    const banState = getAdminUserBanState(listedUser, now);
    const isCurrentlyBanned = banState.kind !== 'none';
    const displayName = listedUser.name || UNSET_NICKNAME;
    const banStatusText = banState.kind === 'permanent'
      ? '永久封禁'
      : banState.kind === 'timed'
        ? `限时封禁至 ${formatBanDateTime(banState.bannedUntil)}`
        : banState.kind === 'unknown'
          ? '封禁中（期限未知）'
          : '未封禁';

    return (
      <Pressable
        style={[styles.userTile, { backgroundColor: colors.surfaceContainer }]}
      >
      <UserAvatar
        userId={listedUser.id}
        name={displayName}
        avatar_url={listedUser.avatar_url}
        size={44}
      />

      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={[styles.userName, { color: pTheme.colors.onSurface }]} numberOfLines={1}>
            {displayName}
          </Text>
          <RoleBadge role={listedUser.role} />
        </View>

        <Text style={[styles.userEmail, { color: pTheme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {listedUser.email || '未提供邮箱'}
        </Text>

        <View
          style={[
            styles.banStatus,
            { backgroundColor: isCurrentlyBanned ? pTheme.colors.errorContainer : pTheme.colors.secondaryContainer },
          ]}
        >
          <Ionicons
            name={isCurrentlyBanned ? 'ban-outline' : 'checkmark-circle-outline'}
            size={12}
            color={isCurrentlyBanned ? pTheme.colors.error : pTheme.colors.onSecondaryContainer}
          />
          <Text
            style={[
              styles.banStatusText,
              { color: isCurrentlyBanned ? pTheme.colors.error : pTheme.colors.onSecondaryContainer },
            ]}
          >
            {banStatusText}
          </Text>
        </View>
        {isCurrentlyBanned && listedUser.ban_reason ? (
          <Text style={[styles.banReason, { color: pTheme.colors.onSurfaceVariant }]} numberOfLines={2}>
            理由：{listedUser.ban_reason}
          </Text>
        ) : null}

        <View style={styles.userMeta}>
          <Ionicons name="document-text-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: pTheme.colors.onSurfaceVariant }]}>
            {listedUser.stats?.post_count || 0}
          </Text>
          <Text style={[styles.metaSeparator, { color: pTheme.colors.outline }]}>·</Text>
          <Ionicons name="people-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: pTheme.colors.onSurfaceVariant }]}>
            {listedUser.stats?.follower_count || 0}
          </Text>
          <Text style={[styles.metaSeparator, { color: pTheme.colors.outline }]}>·</Text>
          <Ionicons name="time-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
          <Text style={[styles.metaText, { color: pTheme.colors.onSurfaceVariant }]}>
            {formatFullDate(listedUser.created_at)}
          </Text>
        </View>
      </View>

      <Menu
        visible={menuVisible === listedUser.id}
        onDismiss={() => setMenuVisible(null)}
        anchor={
          <IconButton
            icon="dots-vertical"
            size={18}
            onPress={() => setMenuVisible(listedUser.id)}
            style={styles.moreBtn}
          />
        }
      >
        {canManageRole && (
          <>
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                void handleUpdateRole(
                  listedUser.id,
                  ROLES.DICT_REVIEWER,
                  listedUser.roles.includes(ROLES.DICT_REVIEWER) ? 'revoke' : 'grant',
                );
              }}
              title={listedUser.roles.includes(ROLES.DICT_REVIEWER) ? '移除词条审核员' : '授予词条审核员'}
              leadingIcon="book-check"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                void handleUpdateRole(
                  listedUser.id,
                  ROLES.MODERATOR,
                  listedUser.roles.includes(ROLES.MODERATOR) ? 'revoke' : 'grant',
                );
              }}
              title={listedUser.roles.includes(ROLES.MODERATOR) ? '移除内容管理员' : '授予内容管理员'}
              leadingIcon="shield-account"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                void handleUpdateRole(
                  listedUser.id,
                  ROLES.SUPER_ADMIN,
                  listedUser.roles.includes(ROLES.SUPER_ADMIN) ? 'revoke' : 'grant',
                );
              }}
              title={listedUser.roles.includes(ROLES.SUPER_ADMIN) ? '移除超级管理员' : '授予超级管理员'}
              leadingIcon="shield-crown"
            />
            <Divider />
          </>
        )}
        <Menu.Item
          onPress={() => {
            setMenuVisible(null);
            if (isCurrentlyBanned) {
              void handleUnbanUser(listedUser.id);
            } else {
              setBanTarget(listedUser);
            }
          }}
          title={isCurrentlyBanned ? '解封用户' : '封禁用户'}
          leadingIcon={isCurrentlyBanned ? 'account-check' : 'account-cancel'}
          titleStyle={isCurrentlyBanned ? undefined : { color: pTheme.colors.error }}
          disabled={statusUpdatingId === listedUser.id}
        />
      </Menu>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: pTheme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator animating size="large" color={pTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: pTheme.colors.onSurfaceVariant }}>正在校验管理员权限...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: pTheme.colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: pTheme.colors.onSurface, marginBottom: 12 }}>请先登录后再访问用户管理</Text>
        <Button mode="contained" onPress={() => router.replace('/login')} style={{ borderRadius: 10 }}>
          去登录
        </Button>
      </View>
    );
  }

  if (!isSuperAdmin(user.roles)) {
    return (
      <View style={{ flex: 1, backgroundColor: pTheme.colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: pTheme.colors.onSurface, marginBottom: 8 }}>当前账号没有用户管理权限</Text>
        <Text style={{ color: pTheme.colors.onSurfaceVariant, marginBottom: 12 }}>请返回管理中心或切换为管理员账号</Text>
        <Button mode="contained-tonal" onPress={handleBack} style={{ borderRadius: 10 }}>
          返回
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: pTheme.colors.background }}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="用户管理" />
      </Appbar.Header>

      <FlashList
        style={{ flex: 1, backgroundColor: pTheme.colors.background }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 24,
          paddingHorizontal: contentHorizontalPadding,
        }}
        data={users}
        keyExtractor={(listedUser) => String(listedUser.id)}
        renderItem={renderUser}
        extraData={{ menuVisible, canManageRole, now, statusUpdatingId }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadUsers(true)}
            colors={[pTheme.colors.primary]}
            tintColor={pTheme.colors.primary}
            progressBackgroundColor={pTheme.colors.surface}
          />
        }
        ListHeaderComponent={
          users.length > 0 && (loadError || actionError) ? (
            <>
            {loadError ? (
              <Card mode="contained" style={{ marginBottom: 8 }}>
                <Card.Content>
                  <Text style={{ color: pTheme.colors.error }}>刷新失败，当前展示的是旧列表：{loadError}</Text>
                </Card.Content>
              </Card>
            ) : null}
            {actionError ? (
              <Card mode="contained" style={{ marginBottom: 8 }}>
                <Card.Content>
                  <Text style={{ color: pTheme.colors.error }}>{actionError}</Text>
                </Card.Content>
              </Card>
            ) : null}
            </>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <Card mode="contained">
              <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text>加载中...</Text>
              </Card.Content>
            </Card>
          ) : loadError ? (
            <Card mode="contained">
              <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: pTheme.colors.error }}>{loadError}</Text>
                <Button mode="text" onPress={() => void loadUsers()} style={{ marginTop: 8 }}>
                  重试
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <Card mode="contained">
              <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="people-outline" size={48} color={pTheme.colors.onSurfaceDisabled} />
                <Text style={{ marginTop: 12, color: pTheme.colors.onSurfaceVariant }}>暂无用户</Text>
              </Card.Content>
            </Card>
          )
        }
      />
      <BanUserSheet
        visible={banTarget !== null}
        userName={banTarget?.name}
        onClose={() => setBanTarget(null)}
        onSubmit={(input) => {
          if (!banTarget) return Promise.reject(new Error('未选择要封禁的用户'));
          return handleBanUser(banTarget.id, input);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // 用户列表项
  userTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
  },
  metaSeparator: {
    fontSize: 11,
  },

  // 身份标签
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  banStatus: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  banStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  banReason: {
    fontSize: 11,
    lineHeight: 16,
  },

  // 更多按钮
  moreBtn: {
    margin: 0,
  },
});
