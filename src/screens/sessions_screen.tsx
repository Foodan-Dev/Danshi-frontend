import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/context/auth_context';
import { AppError } from '@/src/lib/errors/app_error';
import type { Session } from '@/src/repositories/auth_repository';
import { authService } from '@/src/services/auth_service';

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function SessionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busySessionId, setBusySessionId] = useState<number | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setSessions(await authService.listSessions());
    } catch (caught: unknown) {
      setError(AppError.from(caught, '读取登录会话失败').message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, user]);

  const revoke = useCallback(async (sessionId: number) => {
    setBusySessionId(sessionId);
    setError(null);
    try {
      await authService.revokeSession(sessionId);
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (caught: unknown) {
      setError(AppError.from(caught, '撤销会话失败').message);
    } finally {
      setBusySessionId(null);
    }
  }, []);

  const confirmRevoke = useCallback((session: Session) => {
    Alert.alert(
      '撤销登录会话',
      `确定要让“${session.deviceLabel || '未知设备'}”退出登录吗？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '撤销', style: 'destructive', onPress: () => void revoke(session.id) },
      ],
    );
  }, [revoke]);

  const logoutAll = useCallback(async () => {
    setLoggingOutAll(true);
    setError(null);
    try {
      await authService.logoutAll();
      await signOut();
      router.replace('/login');
    } catch (caught: unknown) {
      setError(AppError.from(caught, '退出所有设备失败').message);
    } finally {
      setLoggingOutAll(false);
    }
  }, [signOut]);

  const confirmLogoutAll = useCallback(() => {
    Alert.alert(
      '退出所有设备',
      '所有登录会话（包括当前设备）都会失效，需要重新登录。',
      [
        { text: '取消', style: 'cancel' },
        { text: '全部退出', style: 'destructive', onPress: () => void logoutAll() },
      ],
    );
  }, [logoutAll]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="登录设备" />
      </Appbar.Header>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {!user ? (
          <Card mode="contained">
            <Card.Content style={styles.centered}>
              <Ionicons name="lock-closed-outline" size={42} color={theme.colors.outline} />
              <Text variant="titleMedium">请先登录</Text>
              <Button mode="contained" onPress={() => router.replace('/login')}>去登录</Button>
            </Card.Content>
          </Card>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
            <Text>正在读取登录设备…</Text>
          </View>
        ) : (
          <>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              如果发现陌生设备，请立即撤销对应会话并修改密码。
            </Text>
            {error ? (
              <Card mode="contained" style={{ backgroundColor: theme.colors.errorContainer }}>
                <Card.Content>
                  <Text style={{ color: theme.colors.onErrorContainer }}>{error}</Text>
                </Card.Content>
              </Card>
            ) : null}
            {sessions.length === 0 ? (
              <Card mode="contained">
                <Card.Content style={styles.centered}>
                  <Ionicons name="phone-portrait-outline" size={42} color={theme.colors.outline} />
                  <Text variant="titleMedium">暂无可显示的会话</Text>
                  <Button onPress={() => void load()}>重新加载</Button>
                </Card.Content>
              </Card>
            ) : sessions.map((session) => (
              <Card key={session.id} mode="contained">
                <Card.Title
                  title={session.deviceLabel || '未知设备'}
                  subtitle={session.isCurrent ? '当前设备' : `会话 #${session.id}`}
                  left={(props) => <Ionicons {...props} name="phone-portrait-outline" size={28} color={theme.colors.primary} />}
                />
                <Card.Content style={styles.sessionDetails}>
                  <Text variant="bodySmall">IP：{session.ip || '未知'}</Text>
                  <Text variant="bodySmall">最近活动：{formatDateTime(session.lastSeenAt)}</Text>
                  <Text variant="bodySmall">登录时间：{formatDateTime(session.createdAt)}</Text>
                  <Text variant="bodySmall">到期时间：{formatDateTime(session.expiresAt)}</Text>
                  {session.userAgent ? <Text variant="bodySmall" numberOfLines={2}>客户端：{session.userAgent}</Text> : null}
                </Card.Content>
                {!session.isCurrent ? (
                  <Card.Actions>
                    <Button
                      textColor={theme.colors.error}
                      loading={busySessionId === session.id}
                      disabled={busySessionId !== null}
                      onPress={() => confirmRevoke(session)}
                    >
                      撤销会话
                    </Button>
                  </Card.Actions>
                ) : null}
              </Card>
            ))}
            <Button
              mode="outlined"
              textColor={theme.colors.error}
              loading={loggingOutAll}
              disabled={loggingOutAll || busySessionId !== null}
              onPress={confirmLogoutAll}
            >
              退出所有设备
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 40, gap: 12 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 36 },
  sessionDetails: { gap: 5 },
});
