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
import { Appbar, Text, List, useTheme as usePaperTheme, Button } from 'react-native-paper';
import BottomSheetOverlay from '@/src/components/overlays/bottom_sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import { uploadService } from '@/src/services/upload_service';
import type { UserProfile } from '@/src/repositories/users_repository';
import { getSafeRemoteUrl } from '@/src/lib/security/url';
import { CachedAvatar } from '@/src/components/cached_avatar';

type AccountSettingsScreenProps = {
  settingsHref: Href;
};

export default function AccountSettingsScreen({ settingsHref }: AccountSettingsScreenProps) {
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
  const [sheet, setSheet] = useState<null | 'edit-name' | 'edit-bio'>(null);
  const [editValue, setEditValue] = useState('');

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
          router.replace(settingsHref);
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
  }, [user?.id, name, bio, avatarUrl, refreshUser, settingsHref]);

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
      router.replace(settingsHref);
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
        router.replace('/login');
      }
    } else {
      Alert.alert('退出登录', '确定要退出当前账号吗？', [
        { text: '取消', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: () => {
            signOut?.();
            router.replace('/login');
          },
        },
      ]);
    }
  };

  const safeRemoteAvatarUrl = useMemo(() => getSafeRemoteUrl(avatarUrl), [avatarUrl]);
  const displayAvatarUri = localAvatarUri || safeRemoteAvatarUrl;

  return (
    <View style={{ flex: 1, backgroundColor: pTheme.colors.background }}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={goBack} />
        <Appbar.Content title="账号管理" />
        {userToken && profile ? (
          // 保存必须是有文字的按钮：上传头像只改本地 state，界面会立刻显示新头像，
          // 光靠一个图标无法让人意识到改动尚未提交。未保存时才可点，点完即置灰。
          <Button
            mode="contained"
            compact
            loading={saving}
            disabled={saving || !hasUnsavedChanges}
            accessibilityLabel="保存个人资料"
            style={styles.saveButton}
            labelStyle={styles.saveButtonLabel}
            onPress={() => {
              void handleSaveProfile();
            }}
          >
            保存
          </Button>
        ) : (
          <View style={styles.appbarPlaceholder} />
        )}
      </Appbar.Header>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ backgroundColor: pTheme.colors.background }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
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

    </View>
  );
}

const styles = StyleSheet.create({
  saveButton: {
    marginRight: 8,
    borderRadius: 20,
  },
  saveButtonLabel: {
    fontSize: 14,
    marginHorizontal: 12,
  },
  appbarPlaceholder: {
    width: 48,
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
