import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/src/context/theme_context';
import { Text, List, useTheme as usePaperTheme, Button, Snackbar } from 'react-native-paper';
import BottomSheetOverlay from '@/src/components/overlays/bottom_sheet';
import { ThemeColorPicker } from '@/src/components/theme_color_picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import { uploadService } from '@/src/services/upload_service';
import type { UserProfile } from '@/src/repositories/users_repository';
import { getSafeRemoteUrl } from '@/src/lib/security/url';
import { CachedAvatar } from '@/src/components/cached_avatar';
import { AppDiagnosticsSection } from '@/src/components/settings/app_diagnostics_section';

export default function SettingsScreen() {
  const { mode, setMode, accentColor } = useTheme();
  const { userToken, user, isLoading: authLoading, signOut, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const pTheme = usePaperTheme();

  // 编辑状态
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadError, setLoadError] = useState('');
  const profileRequestId = useRef(0);

  // 表单字段
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  // Sheet 状态
  const [sheet, setSheet] = useState<null | 'theme' | 'edit-name' | 'edit-bio'>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Snackbar 状态
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });

  const themeLabel = useMemo(() => (mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色模式' : '深色模式'), [mode]);

  // 检测是否有未保存的修改
  const hasUnsavedChanges = useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.name ?? '') ||
      bio !== (profile.bio ?? '') ||
      avatarUrl !== (profile.avatar_url ?? null)
    );
  }, [profile, name, bio, avatarUrl]);

  // 加载用户资料
  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const requestId = ++profileRequestId.current;
    setProfileLoading(true);
    setProfile(null);
    setLoadError('');
    try {
      const fetchedProfile = await usersService.getUser(user.id);
      if (requestId !== profileRequestId.current) return;
      setProfile(fetchedProfile);
      setName(fetchedProfile.name ?? '');
      setBio(fetchedProfile.bio ?? '');
      setAvatarUrl(fetchedProfile.avatar_url ?? null);
    } catch (error) {
      if (requestId !== profileRequestId.current) return;
      const message = error instanceof Error ? error.message : '加载资料失败，请稍后重试';
      setLoadError(message);
      if (__DEV__) console.warn('Load profile failed:', error);
    } finally {
      if (requestId === profileRequestId.current) {
        setProfileLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!userToken) {
      profileRequestId.current += 1;
      setProfile(null);
      setName('');
      setBio('');
      setAvatarUrl(null);
      setLocalAvatarUri(null);
      setLoadError('');
      setProfileLoading(false);
      return;
    }

    if (user?.id) {
      void loadProfile();
    }
  }, [loadProfile, user?.id, userToken]);

  const handleRetryProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile();
      return;
    }

    setProfileLoading(true);
    setLoadError('');
    try {
      await refreshUser();
    } finally {
      setProfileLoading(false);
    }
  }, [loadProfile, refreshUser, user?.id]);

  // 保存个人资料
  const handleSaveProfile = useCallback(async (shouldNavigate = true): Promise<boolean> => {
    if (!user?.id) {
      Alert.alert('错误', '用户未登录，无法保存');
      return false;
    }
    const trimmedName = name.trim();
    const trimmedBio = bio.trim();
    if (!trimmedName) {
      Alert.alert('保存失败', '昵称不能为空');
      return false;
    }
    setSaving(true);
    try {
      const input: Parameters<typeof usersService.updateUser>[1] = {
        name: trimmedName,
        bio: trimmedBio,
        avatar_url: avatarUrl ?? null,
      };
      const updatedProfile = await usersService.updateUser(user.id, input);
      setProfile(updatedProfile);
      setName(updatedProfile.name ?? '');
      setBio(updatedProfile.bio ?? '');
      setAvatarUrl(updatedProfile.avatar_url ?? null);
      await refreshUser?.();
      const goBack = () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/myself');
        }
      };
      if (shouldNavigate) {
        if (Platform.OS === 'web') {
          window.alert('保存成功：个人资料已更新');
          goBack();
        } else {
          Alert.alert('保存成功', '个人资料已更新', [
            {
              text: '确定',
              onPress: goBack,
            },
          ]);
        }
      }
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '请稍后重试';
      if (__DEV__) console.error('[Settings] Save failed:', error);
      if (Platform.OS === 'web') {
        window.alert('保存失败：' + message);
      } else {
        Alert.alert('保存失败', message);
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.id, name, bio, avatarUrl, refreshUser]);

  // Web 端文件上传处理
  const handleWebFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      window.alert('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.alert('图片大小不能超过 10MB');
      return;
    }

    // 创建本地预览
    const localUrl = URL.createObjectURL(file);
    setLocalAvatarUri(localUrl);
    setUploadingAvatar(true);

    try {
      const uploadResult = await uploadService.uploadImage(file, 'avatar');
      setAvatarUrl(uploadResult.url);
      setLocalAvatarUri(null);
      URL.revokeObjectURL(localUrl);
    } catch (uploadError: unknown) {
      const message = uploadError instanceof Error ? uploadError.message : '请检查网络连接';
      window.alert('上传失败: ' + message);
      setLocalAvatarUri(null);
      URL.revokeObjectURL(localUrl);
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  // 选择头像
  const handlePickAvatar = useCallback(async () => {
    // Web 端使用原生 file input
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          handleWebFileUpload(file);
        }
      };
      input.click();
      return;
    }

    // 移动端使用 expo-image-picker
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('权限不足', '请允许访问相册以选择头像');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setLocalAvatarUri(asset.uri);
      setUploadingAvatar(true);

      try {
        const uploadResult = await uploadService.uploadImage(
          {
            uri: asset.uri,
            name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          },
          'avatar',
        );
        setAvatarUrl(uploadResult.url);
        setLocalAvatarUri(null);
      } catch (uploadError: unknown) {
        Alert.alert('上传失败', uploadError instanceof Error ? uploadError.message : '请检查网络连接');
        setLocalAvatarUri(null);
      } finally {
        setUploadingAvatar(false);
      }
    } catch (error: unknown) {
      Alert.alert('选择失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }, [handleWebFileUpload]);

  // Web 端拖拽上传状态
  const [isDragging, setIsDragging] = useState(false);

  // Web 端拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleWebFileUpload(file);
    }
  }, [handleWebFileUpload]);

  // 编辑字段
  const handleOpenEdit = (field: 'name' | 'bio') => {
    if (field === 'name') {
      setEditValue(name);
      setSheet('edit-name');
    } else if (field === 'bio') {
      setEditValue(bio);
      setSheet('edit-bio');
    }
  };

  const handleConfirmEdit = () => {
    if (sheet === 'edit-name') {
      setName(editValue);
    } else if (sheet === 'edit-bio') {
      setBio(editValue);
    }
    setSheet(null);
  };

  const doGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(userToken ? '/myself' : '/login');
    }
  };

  const goBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        '未保存的修改',
        '你有未保存的修改，确定要离开吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '不保存', style: 'destructive', onPress: doGoBack },
          {
            text: '保存并离开',
            onPress: async () => {
              const saved = await handleSaveProfile(false);
              if (saved) {
                doGoBack();
              }
            },
          },
        ]
      );
    } else {
      doGoBack();
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('确定要退出当前账号吗？');
      if (confirmed) {
        signOut?.();
        router.replace('/');
      }
    } else {
      Alert.alert('退出登录', '确定要退出当前账号吗？', [
        { text: '取消', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: () => {
            signOut?.();
            router.replace('/');
          },
        },
      ]);
    }
  };

  const safeRemoteAvatarUrl = useMemo(() => getSafeRemoteUrl(avatarUrl), [avatarUrl]);
  const displayAvatarUri = localAvatarUri || safeRemoteAvatarUrl;

  return (
    <View style={{ flex: 1, backgroundColor: pTheme.colors.background }}>
      {/* 顶部导航栏 - 与 post_screen 相同结构 */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top,
            backgroundColor: pTheme.colors.background,
          },
        ]}
      >
        <View style={styles.topBarContent}>
          {/* 左侧：返回按钮 */}
          <Pressable style={styles.topBarLeft} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color={pTheme.colors.onSurface} />
          </Pressable>

          <Text style={[styles.topBarTitle, { color: pTheme.colors.onSurface }]}>设置</Text>

          {userToken && profile ? (
            <Pressable
              style={[
                styles.saveBtn,
                { backgroundColor: pTheme.colors.primary },
                saving && styles.saveBtnDisabled,
              ]}
              onPress={() => {
                void handleSaveProfile();
              }}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size={14} color={pTheme.colors.onPrimary} />
              ) : (
                <Text style={[styles.saveBtnText, { color: pTheme.colors.onPrimary }]}>保存</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.topBarRightPlaceholder} />
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ backgroundColor: pTheme.colors.background }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {/* 纯本地设置：不依赖登录或网络 */}
          <List.Section>
            <List.Subheader>外观</List.Subheader>
            <List.Item
              title="主题模式"
              description={themeLabel}
              left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => setSheet('theme')}
            />
            <List.Item
              title="主题色"
              description={accentColor ? accentColor.toUpperCase() : '默认'}
              left={(props) => <List.Icon {...props} icon="palette" />}
              right={(props) => (
                <View style={styles.colorPreviewRow}>
                  <View
                    style={[
                      styles.colorPreview,
                      { backgroundColor: accentColor || pTheme.colors.primary },
                    ]}
                  />
                  <List.Icon {...props} icon="chevron-right" />
                </View>
              )}
              onPress={() => setColorPickerOpen(true)}
            />
          </List.Section>

          <AppDiagnosticsSection />

          {authLoading ? (
            <List.Section>
              <List.Subheader>账号与个人资料</List.Subheader>
              <View style={styles.profileStateWrap}>
                <ActivityIndicator size="small" color={pTheme.colors.primary} />
                <Text style={{ color: pTheme.colors.onSurfaceVariant }}>正在读取登录状态…</Text>
              </View>
            </List.Section>
          ) : !userToken ? (
            <List.Section>
              <List.Subheader>账号与个人资料</List.Subheader>
              <View
                style={[
                  styles.loginGate,
                  {
                    backgroundColor: pTheme.colors.surfaceVariant,
                    borderColor: pTheme.colors.outlineVariant,
                  },
                ]}
              >
                <Ionicons name="person-circle-outline" size={44} color={pTheme.colors.primary} />
                <Text variant="titleMedium" style={{ color: pTheme.colors.onSurface }}>
                  请先登录
                </Text>
                <Text style={[styles.loginGateDescription, { color: pTheme.colors.onSurfaceVariant }]}>
                  登录后可编辑个人资料、管理登录设备、查看词条建议并退出账号。
                </Text>
                <Button mode="contained" onPress={() => router.push('/login')}>
                  前往登录
                </Button>
              </View>
            </List.Section>
          ) : (
            <>
              <List.Section>
                <List.Subheader>个人资料</List.Subheader>
                {profileLoading || (Boolean(user?.id) && !profile && !loadError) ? (
                  <View style={styles.profileStateWrap}>
                    <ActivityIndicator size="small" color={pTheme.colors.primary} />
                    <Text style={{ color: pTheme.colors.onSurfaceVariant }}>正在加载个人资料…</Text>
                  </View>
                ) : profile ? (
                  <>
                    <View
                      style={[
                        styles.avatarSection,
                        Platform.OS === 'web' && isDragging && {
                          backgroundColor: pTheme.colors.primaryContainer,
                          borderRadius: 16,
                        },
                      ]}
                      {...(Platform.OS === 'web'
                        ? {
                            onDragOver: handleDragOver,
                            onDragLeave: handleDragLeave,
                            onDrop: handleDrop,
                          }
                        : {})}
                    >
                      <Pressable
                        style={styles.avatarContainer}
                        onPress={handlePickAvatar}
                        disabled={uploadingAvatar}
                      >
                        <CachedAvatar
                          uri={displayAvatarUri}
                          size={96}
                          allowLocalUri={!!localAvatarUri}
                          backgroundColor={pTheme.colors.primaryContainer}
                          iconColor={pTheme.colors.primary}
                          iconSize={48}
                        />
                        {uploadingAvatar ? (
                          <View style={styles.avatarOverlay}>
                            <ActivityIndicator size="small" color={pTheme.colors.onPrimary} />
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.avatarBadge,
                              {
                                backgroundColor: pTheme.colors.primary,
                                borderColor: pTheme.colors.surface,
                              },
                            ]}
                          >
                            <Ionicons name="camera" size={16} color={pTheme.colors.onPrimary} />
                          </View>
                        )}
                      </Pressable>
                      <Text style={[styles.avatarHint, { color: pTheme.colors.onSurfaceVariant }]}>
                        {Platform.OS === 'web' ? '点击或拖拽图片更换头像' : '点击更换头像'}
                      </Text>
                    </View>
                    <List.Item
                      title="昵称"
                      description={name || '未设置'}
                      left={(props) => <List.Icon {...props} icon="account" />}
                      right={(props) => <List.Icon {...props} icon="chevron-right" />}
                      onPress={() => handleOpenEdit('name')}
                    />
                    <List.Item
                      title="简介"
                      description={bio || '未设置'}
                      descriptionNumberOfLines={2}
                      left={(props) => <List.Icon {...props} icon="text" />}
                      right={(props) => <List.Icon {...props} icon="chevron-right" />}
                      onPress={() => handleOpenEdit('bio')}
                    />
                  </>
                ) : (
                  <View
                    style={[
                      styles.profileError,
                      { backgroundColor: pTheme.colors.errorContainer },
                    ]}
                  >
                    <Ionicons name="cloud-offline-outline" size={32} color={pTheme.colors.error} />
                    <Text style={[styles.profileErrorText, { color: pTheme.colors.onErrorContainer }]}>
                      {loadError || '暂时无法获取个人资料，请检查网络后重试。'}
                    </Text>
                    <Button
                      mode="text"
                      textColor={pTheme.colors.error}
                      onPress={() => {
                        void handleRetryProfile();
                      }}
                    >
                      重新加载资料
                    </Button>
                  </View>
                )}
              </List.Section>

              <List.Section>
                <List.Subheader>账号</List.Subheader>
                <List.Item
                  title="登录设备"
                  description="查看和管理当前账号的登录会话"
                  left={(props) => <List.Icon {...props} icon="devices" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => router.push('/sessions')}
                />
                <List.Item
                  title="词条建议"
                  description="提交建议并查看审核状态"
                  left={(props) => <List.Icon {...props} icon="lightbulb-outline" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => router.push('/dictionary-suggestions')}
                />
                <List.Item
                  title="退出登录"
                  titleStyle={{ color: pTheme.colors.error }}
                  left={(props) => (
                    <List.Icon {...props} icon="logout" color={pTheme.colors.error} />
                  )}
                  onPress={handleLogout}
                />
              </List.Section>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 主题选择 */}
      <BottomSheetOverlay visible={sheet === 'theme'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>选择主题模式</Text>
        {(['system', 'light', 'dark'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode?.(m);
              setSheet(null);
            }}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: 'transparent' },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={{ color: pTheme.colors.onSurface }}>
              {m === 'system' ? '跟随系统' : m === 'light' ? '浅色模式' : '深色模式'}
            </Text>
            {mode === m ? <Ionicons name="checkmark" size={18} color={pTheme.colors.primary} /> : null}
          </Pressable>
        ))}
      </BottomSheetOverlay>

      {/* 编辑昵称 */}
      <BottomSheetOverlay visible={sheet === 'edit-name'} onClose={() => setSheet(null)} height={200}>
        <Text style={styles.sheetTitle}>编辑昵称</Text>
        <TextInput
          style={[
            styles.textInput,
            styles.inputWhiteboard,
            { color: pTheme.colors.onSurface },
          ]}
          value={editValue}
          onChangeText={setEditValue}
          placeholder="请输入昵称"
          placeholderTextColor={pTheme.colors.outline}
          maxLength={20}
          autoFocus
        />
        <View style={[styles.sheetDivider, { backgroundColor: pTheme.colors.outlineVariant }]} />
        <View style={styles.sheetFooter}>
          <Text style={[styles.charCount, { color: pTheme.colors.onSurfaceVariant }]}>可用 20 字</Text>
          <Button mode="contained" onPress={handleConfirmEdit} style={styles.confirmBtn} buttonColor={pTheme.colors.primary}>
            确认
          </Button>
        </View>
      </BottomSheetOverlay>

      {/* 编辑简介 */}
      <BottomSheetOverlay visible={sheet === 'edit-bio'} onClose={() => setSheet(null)} height={280}>
        <Text style={styles.sheetTitle}>编辑简介</Text>
        <TextInput
          style={[
            styles.textInput,
            styles.bioInput,
            styles.inputWhiteboard,
            { color: pTheme.colors.onSurface },
          ]}
          value={editValue}
          onChangeText={setEditValue}
          placeholder="介绍一下自己吧..."
          placeholderTextColor={pTheme.colors.outline}
          maxLength={100}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          autoFocus
        />
        <View style={[styles.sheetDivider, { backgroundColor: pTheme.colors.outlineVariant }]} />
        <View style={styles.sheetFooter}>
          <Text style={[styles.charCount, { color: pTheme.colors.onSurfaceVariant }]}>
            {editValue.length}/100
          </Text>
          <Button mode="contained" onPress={handleConfirmEdit} style={styles.confirmBtn} buttonColor={pTheme.colors.primary}>
            确认
          </Button>
        </View>
      </BottomSheetOverlay>

      {/* 主题色选择 */}
      <ThemeColorPicker
        visible={colorPickerOpen}
        onDismiss={() => setColorPickerOpen(false)}
      />

      {/* 保存结果提示 */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={2000}
        style={{
          backgroundColor: snackbar.type === 'success' ? pTheme.colors.tertiary : pTheme.colors.error,
          marginBottom: insets.bottom,
        }}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  // ==================== Top Bar ====================
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    width: '100%',
  },
  topBarLeft: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  topBarRightPlaceholder: {
    width: 52,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  loginGate: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
  },
  loginGateDescription: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  profileStateWrap: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  profileError: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  profileErrorText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarHint: {
    fontSize: 13,
    marginTop: 8,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  inputWhiteboard: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    paddingHorizontal: 0,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  sheetFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bioInput: {
    height: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  confirmBtn: {
    marginTop: 0,
  },
});
