import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text, useTheme as usePaperTheme, Button, Menu, IconButton, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useAuth } from '@/src/context/auth_context';
import { isAdmin, isSuperAdmin } from '@/src/lib/auth/roles';
import { adminService } from '@/src/services/admin_service';
import type { AdminUserSummary } from '@/src/repositories/admin_repository';
import type { Role } from '@/src/constants/app';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ROLES } from '@/src/constants/app';
import { formatDate } from '@/src/utils/time_format';
import { UserAvatar } from '@/src/components/user_avatar';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
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
    if (!user || !isAdmin(user.role)) return;
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
    if (isLoading || !user || !isAdmin(user.role)) {
      return;
    }
    void loadUsers();
  }, [isLoading, loadUsers, user]);

  const canManageRole = !!user && isSuperAdmin(user.role);

  const handleUpdateRole = async (userId: string, role: Role) => {
    setActionError('');
    try {
      await adminService.updateUserRole(userId, { role });
      await loadUsers();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '修改用户身份失败，请稍后重试');
    }
  };

  const handleUpdateStatus = async (userId: string, isActive: boolean) => {
    setActionError('');
    try {
      await adminService.updateUserStatus(userId, { is_active: isActive });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: isActive } : u));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '修改用户状态失败，请稍后重试');
    }
  };

  const formatFullDate = (dateStr: string) => formatDate(dateStr, 'full');

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

  if (!isAdmin(user.role)) {
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

      <ScrollView
        style={{ backgroundColor: pTheme.colors.background }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 24,
          paddingHorizontal: contentHorizontalPadding,
          gap: 8
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadUsers(true)}
            colors={[pTheme.colors.primary]}
            tintColor={pTheme.colors.primary}
            progressBackgroundColor={pTheme.colors.surface}
          />
        }
      >
        {loading && users.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text>加载中...</Text>
            </Card.Content>
          </Card>
        ) : loadError && users.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: pTheme.colors.error }}>{loadError}</Text>
              <Button mode="text" onPress={() => void loadUsers()} style={{ marginTop: 8 }}>
                重试
              </Button>
            </Card.Content>
          </Card>
        ) : users.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="people-outline" size={48} color={pTheme.colors.onSurfaceDisabled} />
              <Text style={{ marginTop: 12, color: pTheme.colors.onSurfaceVariant }}>暂无用户</Text>
            </Card.Content>
          </Card>
        ) : (
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
            {users.map((u) => (
              <Pressable
                key={u.id}
                style={[styles.userTile, { backgroundColor: colors.surfaceContainer }]}
              >
                <UserAvatar
                  userId={u.id}
                  name={u.name}
                  avatar_url={u.avatar_url}
                  size={44}
                />

                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: pTheme.colors.onSurface }]} numberOfLines={1}>
                      {u.name}
                    </Text>
                    <RoleBadge role={u.role} />
                    {!u.is_active && (
                      <View style={[styles.statusBadge, { backgroundColor: pTheme.colors.errorContainer }]}>
                        <Text style={[styles.statusBadgeText, { color: pTheme.colors.error }]}>已禁用</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.userEmail, { color: pTheme.colors.onSurfaceVariant }]} numberOfLines={1}>
                    {u.email}
                  </Text>

                  <View style={styles.userMeta}>
                    <Ionicons name="document-text-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
                    <Text style={[styles.metaText, { color: pTheme.colors.onSurfaceVariant }]}>
                      {u.stats?.post_count || 0}
                    </Text>
                    <Text style={[styles.metaSeparator, { color: pTheme.colors.outline }]}>·</Text>
                    <Ionicons name="people-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
                    <Text style={[styles.metaText, { color: pTheme.colors.onSurfaceVariant }]}>
                      {u.stats?.follower_count || 0}
                    </Text>
                    <Text style={[styles.metaSeparator, { color: pTheme.colors.outline }]}>·</Text>
                    <Ionicons name="time-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
                    <Text style={[styles.metaText, { color: pTheme.colors.onSurfaceVariant }]}>
                      {formatFullDate(u.created_at)}
                    </Text>
                  </View>
                </View>

                <Menu
                  visible={menuVisible === u.id}
                  onDismiss={() => setMenuVisible(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      size={18}
                      onPress={() => setMenuVisible(u.id)}
                      style={styles.moreBtn}
                    />
                  }
                >
                  {canManageRole && (
                    <>
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          void handleUpdateRole(u.id, ROLES.USER);
                        }}
                        title="设为普通用户"
                        leadingIcon="account"
                        disabled={u.role === ROLES.USER}
                      />
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          void handleUpdateRole(u.id, ROLES.ADMIN);
                        }}
                        title="设为管理员"
                        leadingIcon="shield-account"
                        disabled={u.role === ROLES.ADMIN}
                      />
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          void handleUpdateRole(u.id, ROLES.SUPER_ADMIN);
                        }}
                        title="设为超级管理员"
                        leadingIcon="shield-crown"
                        disabled={u.role === ROLES.SUPER_ADMIN}
                      />
                      <Divider />
                    </>
                  )}
                  <Menu.Item
                    onPress={() => {
                      setMenuVisible(null);
                      void handleUpdateStatus(u.id, !u.is_active);
                    }}
                    title={u.is_active ? '禁用用户' : '启用用户'}
                    leadingIcon={u.is_active ? 'account-cancel' : 'account-check'}
                    titleStyle={u.is_active ? { color: pTheme.colors.error } : undefined}
                  />
                </Menu>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
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

  // 状态标签
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // 更多按钮
  moreBtn: {
    margin: 0,
  },
});
