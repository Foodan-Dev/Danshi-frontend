import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  ActivityIndicator,
  Appbar,
  Card,
  Text,
  useTheme as usePaperTheme,
  Button,
  IconButton,
  Divider,
  List,
} from 'react-native-paper';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useAuth } from '@/src/context/auth_context';
import { isSuperAdmin, normalizeRoles } from '@/src/lib/auth/roles';
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
import { BanUserSheet } from '@/src/components/admin/ban_user_sheet';
import { BottomSheet } from '@/src/components/overlays/bottom_sheet';
import { UNSET_NICKNAME } from '@/src/constants/user';

const SCREEN_LOADED_AT = Date.now();

type RoleBadgeProps = {
  role: Role;
};

const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const pTheme = usePaperTheme();
  const presentation = role === ROLES.SUPER_ADMIN
    ? {
        label: '超级管理员',
        icon: 'shield-checkmark' as const,
        backgroundColor: pTheme.colors.errorContainer,
        color: pTheme.colors.onErrorContainer,
      }
    : role === ROLES.MODERATOR
      ? {
          label: '审核管理员',
          icon: 'shield' as const,
          backgroundColor: pTheme.colors.primaryContainer,
          color: pTheme.colors.onPrimaryContainer,
        }
      : role === ROLES.DICT_REVIEWER
        ? {
            label: '词条管理员',
            icon: 'book' as const,
            backgroundColor: pTheme.colors.tertiaryContainer,
            color: pTheme.colors.onTertiaryContainer,
          }
        : {
            label: '普通用户',
            icon: 'person' as const,
            backgroundColor: pTheme.colors.secondaryContainer,
            color: pTheme.colors.onSecondaryContainer,
          };

  return (
    <View style={[styles.roleBadge, { backgroundColor: presentation.backgroundColor }]}>
      <Ionicons name={presentation.icon} size={11} color={presentation.color} />
      <Text style={[styles.roleBadgeText, { color: presentation.color }]}>{presentation.label}</Text>
    </View>
  );
};

type RoleBadgesProps = {
  roles: readonly ManagementRole[];
};

const RoleBadges: React.FC<RoleBadgesProps> = ({ roles }) => {
  const normalized = normalizeRoles(roles);
  const displayRoles: Role[] = normalized.length > 0
    ? [ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.DICT_REVIEWER]
        .filter((role): role is ManagementRole => normalized.includes(role))
    : [ROLES.USER];

  return (
    <View style={styles.roleBadges}>
      {displayRoles.map((role) => <RoleBadge key={role} role={role} />)}
    </View>
  );
};

export default function AdminUsersScreen() {
  const pTheme = usePaperTheme();
  const insets = useSafeAreaInsets();
  const { current } = useResponsive();
  const { height: windowHeight } = useWindowDimensions();
  const { user, isLoading } = useAuth();

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionTarget, setActionTarget] = useState<AdminUserSummary | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
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

  const openActionSheet = (target: AdminUserSummary) => {
    setActionTarget(target);
    setActionSheetVisible(true);
  };

  const runRoleAction = (target: AdminUserSummary, role: ManagementRole) => {
    setActionSheetVisible(false);
    void handleUpdateRole(
      target.id,
      role,
      target.roles.includes(role) ? 'revoke' : 'grant',
    );
  };

  const openBanSheet = async (target: AdminUserSummary) => {
    setActionSheetVisible(false);
    if (Platform.OS !== 'web') {
      await new Promise((resolve) => setTimeout(resolve, 160));
    }
    setBanTarget(target);
  };

  const runUnbanAction = (target: AdminUserSummary) => {
    setActionSheetVisible(false);
    void handleUnbanUser(target.id);
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
        </View>

        <RoleBadges roles={listedUser.roles} />

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

      <IconButton
        icon="dots-vertical"
        size={18}
        onPress={() => openActionSheet(listedUser)}
        style={styles.moreBtn}
        accessibilityLabel={`管理${displayName}`}
      />
      </Pressable>
    );
  };

  const actionTargetBanState = actionTarget ? getAdminUserBanState(actionTarget, now) : null;
  const actionTargetIsBanned = actionTargetBanState !== null && actionTargetBanState.kind !== 'none';
  const actionTargetBanStatusText = actionTargetBanState?.kind === 'permanent'
    ? '永久封禁'
    : actionTargetBanState?.kind === 'timed'
      ? `限时封禁至 ${formatBanDateTime(actionTargetBanState.bannedUntil)}`
      : actionTargetBanState?.kind === 'unknown'
        ? '封禁中（期限未知）'
        : '未封禁';

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
        <Text style={{ color: pTheme.colors.onSurfaceVariant, marginBottom: 12 }}>用户管理仅向超级管理员开放，请返回管理中心</Text>
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
        extraData={{ now }}
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
      <BottomSheet
        visible={actionSheetVisible && actionTarget !== null}
        onClose={() => setActionSheetVisible(false)}
        height={Math.min(windowHeight * 0.86, 620)}
      >
        {actionTarget ? (
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <UserAvatar
                userId={actionTarget.id}
                name={actionTarget.name || UNSET_NICKNAME}
                avatar_url={actionTarget.avatar_url}
                size={48}
              />
              <View style={styles.actionSheetIdentity}>
                <Text
                  variant="titleMedium"
                  style={{ color: pTheme.colors.onSurface, fontWeight: '700' }}
                  numberOfLines={1}
                >
                  {actionTarget.name || UNSET_NICKNAME}
                </Text>
                <Text style={{ color: pTheme.colors.onSurfaceVariant }} numberOfLines={1}>
                  {actionTarget.email || '未提供邮箱'}
                </Text>
              </View>
              <IconButton
                icon="close"
                size={20}
                onPress={() => setActionSheetVisible(false)}
                accessibilityLabel="关闭用户操作"
              />
            </View>

            <RoleBadges roles={actionTarget.roles} />
            <View
              style={[
                styles.sheetBanStatus,
                {
                  backgroundColor: actionTargetIsBanned
                    ? pTheme.colors.errorContainer
                    : pTheme.colors.secondaryContainer,
                },
              ]}
            >
              <Ionicons
                name={actionTargetIsBanned ? 'ban-outline' : 'checkmark-circle-outline'}
                size={14}
                color={actionTargetIsBanned ? pTheme.colors.error : pTheme.colors.onSecondaryContainer}
              />
              <Text
                style={{
                  color: actionTargetIsBanned ? pTheme.colors.error : pTheme.colors.onSecondaryContainer,
                  fontWeight: '600',
                }}
              >
                {actionTargetBanStatusText}
              </Text>
            </View>

            <Divider style={styles.actionSheetDivider} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <List.Section>
                <List.Subheader style={{ color: pTheme.colors.onSurfaceVariant }}>身份管理</List.Subheader>
                {([
                  { role: ROLES.DICT_REVIEWER, label: '词条管理员', icon: 'book-check' },
                  { role: ROLES.MODERATOR, label: '审核管理员', icon: 'shield-account' },
                  { role: ROLES.SUPER_ADMIN, label: '超级管理员', icon: 'shield-crown' },
                ] as const).map(({ role, label, icon }) => {
                  const isRemoving = actionTarget.roles.includes(role);
                  return (
                    <List.Item
                      key={role}
                      title={`${isRemoving ? '移除' : '授予'}${label}`}
                      titleStyle={isRemoving ? { color: pTheme.colors.error } : undefined}
                      left={(props) => (
                        <List.Icon
                          {...props}
                          icon={icon}
                          color={isRemoving ? pTheme.colors.error : pTheme.colors.onSurfaceVariant}
                        />
                      )}
                      onPress={() => runRoleAction(actionTarget, role)}
                    />
                  );
                })}
              </List.Section>

              <Divider />
              <List.Section>
                <List.Subheader style={{ color: pTheme.colors.onSurfaceVariant }}>账号状态</List.Subheader>
                <List.Item
                  title={actionTargetIsBanned ? '解封用户' : '封禁用户'}
                  titleStyle={actionTargetIsBanned ? undefined : { color: pTheme.colors.error }}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={actionTargetIsBanned ? 'account-check' : 'account-cancel'}
                      color={actionTargetIsBanned ? pTheme.colors.onSurfaceVariant : pTheme.colors.error}
                    />
                  )}
                  onPress={() => {
                    if (actionTargetIsBanned) {
                      runUnbanAction(actionTarget);
                    } else {
                      void openBanSheet(actionTarget);
                    }
                  }}
                  disabled={statusUpdatingId === actionTarget.id}
                />
              </List.Section>
            </ScrollView>
          </View>
        ) : null}
      </BottomSheet>
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
    fontSize: 11,
    fontWeight: '600',
  },
  roleBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
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
  actionSheet: {
    flex: 1,
    paddingHorizontal: 8,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionSheetIdentity: {
    flex: 1,
    gap: 2,
  },
  sheetBanStatus: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
  },
  actionSheetDivider: {
    marginTop: 12,
  },
});
