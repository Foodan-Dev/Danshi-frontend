import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/src/context/auth_context';
import { useTheme } from '@/src/context/theme_context';
import { router } from 'expo-router';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { authService } from '@/src/services/auth_service';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { REGEX } from '../constants/app';
import { ensureAppError } from '@/src/lib/errors/app_error';

export default function RegisterScreen() {
  const bp = useBreakpoint();
  const pad = pickByBreakpoint(bp, { base: 16, sm: 20, md: 24, lg: 32, xl: 40 });
  const maxWidth = pickByBreakpoint(bp, { base: 440, sm: 480, md: 560, lg: 640, xl: 720 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');

  const validate = (nextUsername: string, nextEmail: string, nextPassword: string, nextConfirm: string) => {
    if (!nextUsername) return '请输入用户名';
    if (nextUsername.length < 3) return '用户名至少 3 个字符';
    if (!nextEmail) return '请输入邮箱';
    const emailRegex = REGEX.EMAIL;
    if (!emailRegex.test(nextEmail)) return '请输入有效的邮箱地址';
    if (!nextPassword) return '请输入密码';
    if (nextPassword.length < 8) return '密码长度至少 8 位';
    if (nextPassword !== nextConfirm) return '两次输入的密码不一致';
    return '';
  };

  const { signIn } = useAuth();

  const onSubmit = async () => {
    if (loading) return;
    setError('');
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim();
    if (normalizedUsername !== username) {
      setUsername(normalizedUsername);
    }
    if (normalizedEmail !== email) {
      setEmail(normalizedEmail);
    }
    const v = validate(normalizedUsername, normalizedEmail, password, confirm);
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const { token } = await authService.register({ email: normalizedEmail, password, name: normalizedUsername });
      await signIn(token);
      router.replace('/explore');
    } catch (e) {
      const appError = ensureAppError(e, '注册失败，请重试');
      if (appError.code === 'NETWORK_ERROR' || appError.code === 'TIMEOUT') {
        setError(appError.message);
      } else if (!appError.status && !appError.code) {
        setError(appError.message);
      } else if (appError.status === 409) {
        setError('该邮箱或用户名已被占用');
      } else if (appError.status === 400) {
        setError('注册信息有误，请检查后重试');
      } else {
        setError('注册失败，请重试');
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
      <View style={styles.centerWrap}>
        <View style={{ width: '100%', maxWidth }}>
          <Card
            mode="outlined"
            style={{
              backgroundColor: colors.surface + 'CC', // 增加透明度
              borderColor: cardBorderColor,
              borderWidth: 0.5, // 更细
              shadowOpacity: 0.05, // 极弱阴影
            }}
          >
            <Card.Content>
              <Text variant="headlineSmall" style={[styles.title, { color: colors.onSurface }]}>
                注册
              </Text>
              {error ? <Text style={{ color: danger, marginBottom: 8 }}>{error}</Text> : null}

              <View style={{ gap: 20 }}>
                <TextInput
                  label="用户名"
                  mode="outlined"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  outlineColor="transparent"
                  activeOutlineColor={colors.primary}
                  textColor={colors.onSurface}
                  theme={inputTheme}
                />

                <TextInput
                  label="邮箱"
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
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

                <TextInput
                  label="确认密码"
                  mode="outlined"
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
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
                创建账号
              </Button>

              <View style={styles.row}>
                <Text style={[styles.rowPrompt, { color: rowPromptColor }]}>已有账号？</Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => router.push('/login')}
                  style={[styles.rowLink, { borderColor: colors.outline, borderRadius: 10 }]}
                  contentStyle={styles.rowLinkContent}
                  textColor={colors.primary}
                >
                  登录
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
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
