import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/src/context/theme_context';
import { useAuth } from '@/src/context/auth_context';
import { router } from 'expo-router';
import { Button, Card, Text, TextInput, Banner } from 'react-native-paper';
import { authService } from '@/src/services/auth_service';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { REGEX } from '../constants/app';
import { ensureAppError } from '@/src/lib/errors/app_error';

export default function LoginScreen() {
  const bp = useBreakpoint();
  const pad = pickByBreakpoint(bp, { base: 16, sm: 20, md: 24, lg: 32, xl: 40 });
  const maxWidth = pickByBreakpoint(bp, { base: 440, sm: 480, md: 560, lg: 640, xl: 720 });
  const [identifier, setIdentifier] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSessionBanner, setShowSessionBanner] = useState(false);

  const { signIn, sessionExpired, clearSessionExpired } = useAuth();

  // 监听会话过期状态
  useEffect(() => {
    if (sessionExpired) {
      setShowSessionBanner(true);
      // 清除 context 中的标记，避免重复显示
      clearSessionExpired();
    }
  }, [sessionExpired, clearSessionExpired]);

  const validate = (nextIdentifier: string, nextPassword: string) => {
    if (!nextIdentifier) return '请输入邮箱或用户名';
    const ok = REGEX.EMAIL.test(nextIdentifier) || REGEX.USERNAME.test(nextIdentifier);
    if (!ok) return '请输入有效的邮箱或用户名';
    if (!nextPassword) return '请输入密码';
    return '';
  };

  const onSubmit = async () => {
    if (loading) return;
    setError('');
    const normalizedIdentifier = identifier.trim();
    if (normalizedIdentifier !== identifier) {
      setIdentifier(normalizedIdentifier);
    }
    const v = validate(normalizedIdentifier, password);
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const { token } = await authService.login({ identifier: normalizedIdentifier, password });
      await signIn(token);
      // 直接跳到 tabs 的探索页，避免在 (auth) 栈内 REPLACE('index') 报错
      router.replace('/explore');
    } catch (e) {
      const appError = ensureAppError(e, '登录失败，请重试');
      if (appError.code === 'NETWORK_ERROR' || appError.code === 'TIMEOUT') {
        setError(appError.message);
      } else if (!appError.status && !appError.code) {
        setError(appError.message);
      } else if (appError.status === 401) {
        setError('账号或密码错误');
      } else {
        setError('登录失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const { danger, colors } = useTheme();
  const palette = colors as unknown as Record<string, string>;
  const surfaceContainerLow = palette.surfaceContainerLow ?? colors.background;
  const cardBorderColor = palette.outlineVariant ?? colors.outline;
  const rowPromptColor = palette.onSurfaceVariant ?? colors.onSurface;
  const inputTheme = { roundness: 10 };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingHorizontal: pad, backgroundColor: surfaceContainerLow }]}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <StatusBar style="auto" />
      {/* 会话过期提示 Banner */}
      <Banner
        visible={showSessionBanner}
        actions={[
          {
            label: '知道了',
            onPress: () => setShowSessionBanner(false),
          },
        ]}
        icon="clock-outline"
        style={[styles.sessionBanner, { backgroundColor: colors.tertiaryContainer }]}
      >
        <Text style={{ color: colors.onTertiaryContainer }}>
          登录已过期，请重新登录
        </Text>
      </Banner>
      <View style={styles.centerWrap}> 
        <View style={{ width: '100%', maxWidth }}>
          <Card
            mode="outlined"
            style={[
              styles.card,
              {
                backgroundColor: colors.surface + 'CC', // 增加透明度
                borderColor: cardBorderColor,
                borderWidth: 0.5, // 更细
                shadowOpacity: 0.05, // 极弱阴影
              },
            ]}
          >
            <Card.Content>
              <Text variant="headlineSmall" style={[styles.title, { color: colors.onSurface }]}>
                登录
              </Text>
              {error ? <Text style={{ color: danger, marginBottom: 8 }}>{error}</Text> : null}

              <View style={{ gap: 20 }}>
                <TextInput
                  label="邮箱或用户名"
                  mode="outlined"
                  autoCapitalize="none"
                  value={identifier}
                  onChangeText={setIdentifier}
                  outlineColor="transparent"
                  activeOutlineColor={colors.primary}
                  textColor={colors.onSurface}
                  theme={inputTheme}
                />

                <TextInput
                  label="密码"
                  mode="outlined"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  outlineColor="transparent"
                  activeOutlineColor={colors.primary}
                  textColor={colors.onSurface}
                  theme={inputTheme}
                />
              </View>

              <Button
                mode="contained"
                style={{ marginTop: 35, borderRadius: 12 }}
                contentStyle={{ height: 48 }}
                onPress={onSubmit}
                loading={loading}
                disabled={loading}
                buttonColor={colors.primary}
                textColor={colors.onPrimary}
              >
                登录
              </Button>

              <View style={styles.row}>
                <Text style={[styles.rowPrompt, { color: rowPromptColor }]}>没有账号？</Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => router.push('/register')}
                  style={[styles.rowLink, { borderColor: colors.outline, borderRadius: 10 }]}
                  contentStyle={styles.rowLinkContent}
                  textColor={colors.primary}
                >
                  注册
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'transparent',
  },
  sessionBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {},
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  rowPrompt: {
    fontSize: 15,
    lineHeight: 36,
  },
  rowLink: {
    marginLeft: 0,
    alignSelf: 'center',
  },
  rowLinkContent: {
    height: 36,
  },
});
