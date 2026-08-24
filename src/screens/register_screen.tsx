import React, { useEffect, useState } from 'react';
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

const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_COOLDOWN_SECONDS = 60;

export default function RegisterScreen() {
  const bp = useBreakpoint();
  const pad = pickByBreakpoint(bp, { base: 16, sm: 20, md: 24, lg: 32, xl: 40 });
  const maxWidth = pickByBreakpoint(bp, { base: 440, sm: 480, md: 560, lg: 640, xl: 720 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const validate = (
    nextUsername: string,
    nextEmail: string,
    nextVerificationCode: string,
    nextPassword: string,
    nextConfirm: string,
  ) => {
    if (!nextUsername) return '请输入用户名';
    if (nextUsername.length < 3) return '用户名至少 3 个字符';
    if (!nextEmail) return '请输入邮箱';
    const emailRegex = REGEX.EMAIL;
    if (!emailRegex.test(nextEmail)) return '请输入有效的邮箱地址';
    if (!verificationEmail) return '请先获取邮箱验证码';
    if (verificationEmail !== nextEmail) return '邮箱已修改，请重新获取验证码';
    if (nextVerificationCode.length !== VERIFICATION_CODE_LENGTH) return '请输入 6 位邮箱验证码';
    if (!nextPassword) return '请输入密码';
    if (nextPassword.length < 8) return '密码长度至少 8 位';
    if (nextPassword !== nextConfirm) return '两次输入的密码不一致';
    return '';
  };

  const { signIn } = useAuth();

  const onRequestCode = async () => {
    if (sendingCode || loading || cooldownSeconds > 0) return;
    setError('');
    setVerificationMessage('');
    const normalizedEmail = email.trim();
    if (normalizedEmail !== email) {
      setEmail(normalizedEmail);
    }
    if (!normalizedEmail || !REGEX.EMAIL.test(normalizedEmail)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setSendingCode(true);
    try {
      await authService.requestRegistrationCode(normalizedEmail);
      setVerificationEmail(normalizedEmail);
      setCooldownSeconds(VERIFICATION_COOLDOWN_SECONDS);
      setVerificationMessage('验证码已发送，有效期 10 分钟');
    } catch (caught) {
      const appError = ensureAppError(caught, '验证码发送失败，请重试');
      if (
        appError.errorCode === 'rate_limited'
        || appError.errorCode === 'verify_code_busy'
        || appError.errorCode === 'verify_code_too_many'
      ) {
        const retryAfter = Math.max(
          1,
          appError.retryAfterSeconds ?? VERIFICATION_COOLDOWN_SECONDS,
        );
        setCooldownSeconds(retryAfter);
        setError(`请求过于频繁，请 ${retryAfter} 秒后重试`);
      } else if (appError.errorCode === 'email_domain_not_allow') {
        setError('该邮箱域名暂不支持注册');
      } else {
        setError(appError.message || '验证码发送失败，请重试');
      }
    } finally {
      setSendingCode(false);
    }
  };

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
    const v = validate(
      normalizedUsername,
      normalizedEmail,
      verificationCode,
      password,
      confirm,
    );
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const { token } = await authService.register({
        email: normalizedEmail,
        password,
        name: normalizedUsername,
        verification_code: verificationCode,
      });
      await signIn(token);
      router.replace('/explore');
    } catch (e) {
      const appError = ensureAppError(e, '注册失败，请重试');
      switch (appError.errorCode) {
        case 'email_taken':
          setError('该邮箱已被占用');
          break;
        case 'email_domain_not_allow':
          setError('该邮箱域名暂不支持注册');
          break;
        case 'verify_code_invalid':
          setError('邮箱验证码无效或已过期');
          break;
        case 'verify_code_too_many':
          setError('验证码尝试次数过多，请重新获取');
          break;
        case 'validation_failed':
          setError('注册信息有误，请检查后重试');
          break;
        case 'rate_limited':
          setError('请求过于频繁，请稍后重试');
          break;
        default:
          setError(appError.message || '注册失败，请重试');
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
  const requestCodeButtonLabel = cooldownSeconds > 0
    ? `${cooldownSeconds} 秒后重试`
    : '获取验证码';

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
              {error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: danger, marginBottom: 8 }}
                >
                  {error}
                </Text>
              ) : null}
              {verificationMessage ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: rowPromptColor, marginBottom: 8 }}
                >
                  {verificationMessage}
                </Text>
              ) : null}

              <View style={{ gap: 20 }}>
                <TextInput
                  label="用户名"
                  accessibilityLabel="用户名"
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
                  accessibilityLabel="邮箱"
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={setEmail}
                  outlineColor="transparent"
                  activeOutlineColor={colors.primary}
                  textColor={colors.onSurface}
                  theme={inputTheme}
                />

                <View style={styles.verificationRow}>
                  <TextInput
                    label="邮箱验证码"
                    accessibilityLabel="邮箱验证码"
                    mode="outlined"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    value={verificationCode}
                    onChangeText={(value) => {
                      setVerificationCode(
                        value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH),
                      );
                    }}
                    outlineColor="transparent"
                    activeOutlineColor={colors.primary}
                    textColor={colors.onSurface}
                    theme={inputTheme}
                    style={styles.verificationInput}
                  />
                  <Button
                    mode="outlined"
                    onPress={onRequestCode}
                    loading={sendingCode}
                    disabled={sendingCode || loading || cooldownSeconds > 0}
                    accessibilityLabel={requestCodeButtonLabel}
                    style={[styles.verificationButton, { borderColor: colors.outline }]}
                    contentStyle={styles.verificationButtonContent}
                    textColor={colors.primary}
                  >
                    {requestCodeButtonLabel}
                  </Button>
                </View>

                <TextInput
                  label="密码"
                  accessibilityLabel="密码"
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
                  accessibilityLabel="确认密码"
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
                disabled={loading || sendingCode}
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
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verificationInput: {
    flex: 1,
  },
  verificationButton: {
    borderRadius: 12,
  },
  verificationButtonContent: {
    height: 56,
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
