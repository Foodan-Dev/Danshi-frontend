import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '@/src/context/theme_context';
import { Text, List, useTheme as usePaperTheme, ActivityIndicator, Button, Snackbar } from 'react-native-paper';
import BottomSheet from '@/src/components/overlays/bottom_sheet';
import { CenterPicker } from '@/src/components/overlays/center_picker';
import { ThemeColorPicker } from '@/src/components/theme_color_picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import { uploadService } from '@/src/services/upload_service';
import { HOMETOWN_OPTIONS, findOptionLabel } from '@/src/constants/selects';
import type { UserProfile } from '@/src/repositories/users_repository';
import { getSafeRemoteUrl } from '@/src/lib/security/url';


export default function SettingsScreen() {
  const { mode, setMode, accentColor } = useTheme();
  const { user, signOut, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const pTheme = usePaperTheme();

  // 编辑状态
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // 表单字段
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [hometown, setHometown] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  // Sheet 状态
  const [sheet, setSheet] = useState<null | 'theme' | 'edit-name' | 'edit-bio'>(null);
  const [hometownPickerOpen, setHometownPickerOpen] = useState(false);
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
      hometown !== (profile.hometown ?? '') ||
      avatarUrl !== (profile.avatar_url ?? null)
    );
  }, [profile, name, bio, hometown, avatarUrl]);

  const hometownLabel = useMemo(() => {
    return findOptionLabel(HOMETOWN_OPTIONS, hometown) || hometown || '未设置';
  }, [hometown]);

  // 加载用户资料
  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const fetchedProfile = await usersService.getUser(user.id);
      setProfile(fetchedProfile);
      setName(fetchedProfile.name ?? '');
      setBio(fetchedProfile.bio ?? '');
      setHometown(fetchedProfile.hometown ?? '');
      setAvatarUrl(fetchedProfile.avatar_url ?? null);
    } catch (error) {
      if (__DEV__) console.warn('Load profile failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 保存个人资料
  const handleSaveProfile = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('错误', '用户未登录，无法保存');
      return;
    }
    setSaving(true);
    try {
      const input: Parameters<typeof usersService.updateUser>[1] = {
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        hometown: hometown.trim() || undefined,
        avatar_url: avatarUrl ?? undefined,
      };
      await usersService.updateUser(user.id, input);
      // 更新 profile 状态，使 hasUnsavedChanges 变为 false
      setProfile(prev => prev ? { ...prev, name: name.trim(), bio: bio.trim(), hometown: hometown.trim(), avatar_url: avatarUrl } : prev);
      refreshUser?.();
      // 显示成功提示，然后自动返回
      const goBack = () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/myself');
        }
      };
      if (Platform.OS === 'web') {
        // Web 端使用 window.alert
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
    } catch (error: any) {
      if (__DEV__) console.error('[Settings] Save failed:', error);
      if (Platform.OS === 'web') {
        window.alert('保存失败：' + (error?.message ?? '请稍后重试'));
      } else {
        Alert.alert('保存失败', error?.message ?? '请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  }, [user?.id, name, bio, hometown, avatarUrl, refreshUser]);

  // Web 端文件上传处理
  const handleWebFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      window.alert('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert('图片大小不能超过 5MB');
      return;
    }

    // 创建本地预览
    const localUrl = URL.createObjectURL(file);
    setLocalAvatarUri(localUrl);
    setUploadingAvatar(true);

    try {
      const uploadResult = await uploadService.uploadImage(file);
      setAvatarUrl(uploadResult.url);
      setLocalAvatarUri(null);
      URL.revokeObjectURL(localUrl);
    } catch (uploadError: any) {
      window.alert('上传失败: ' + (uploadError?.message ?? '请检查网络连接'));
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
        const uploadResult = await uploadService.uploadImage({
          uri: asset.uri,
          name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        });
        setAvatarUrl(uploadResult.url);
        setLocalAvatarUri(null);
      } catch (uploadError: any) {
        Alert.alert('上传失败', uploadError?.message ?? '请检查网络连接');
        setLocalAvatarUri(null);
      } finally {
        setUploadingAvatar(false);
      }
    } catch (error: any) {
      Alert.alert('选择失败', error?.message ?? '请稍后重试');
    }
  }, [handleWebFileUpload]);

  // Web 端拖拽上传状态
  const [isDragging, setIsDragging] = useState(false);

  // Web 端拖拽处理
  const handleDragOver = useCallback((e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: any) => {
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
      router.replace('/myself');
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
              await handleSaveProfile();
              doGoBack();
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

          {/* 右侧：保存按钮 - 使用内联样式确保显示 */}
          <Pressable
            style={{
              backgroundColor: pTheme.colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 16,
              minWidth: 52,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.6 : 1,
            }}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size={14} color={pTheme.colors.onPrimary} />
            ) : (
              <Text style={{ color: pTheme.colors.onPrimary, fontSize: 14, fontWeight: '600' }}>保存</Text>
            )}
          </Pressable>
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
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={pTheme.colors.primary} />
            </View>
          ) : (
            <>
              {/* 头像编辑 */}
              <View 
                style={[
                  styles.avatarSection,
                  Platform.OS === 'web' && isDragging && { 
                    backgroundColor: pTheme.colors.primaryContainer,
                    borderRadius: 16,
                  }
                ]}
                {...(Platform.OS === 'web' ? {
                  onDragOver: handleDragOver,
                  onDragLeave: handleDragLeave,
                  onDrop: handleDrop,
                } : {})}
              >
                <Pressable style={styles.avatarContainer} onPress={handlePickAvatar} disabled={uploadingAvatar}>
                  {displayAvatarUri ? (
                    <Image source={{ uri: displayAvatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: pTheme.colors.primaryContainer }]}>
                      <Ionicons name="person" size={48} color={pTheme.colors.primary} />
                    </View>
                  )}
                  {uploadingAvatar ? (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator size="small" color={pTheme.colors.onPrimary} />
                    </View>
                  ) : (
                    <View style={[styles.avatarBadge, { backgroundColor: pTheme.colors.primary, borderColor: pTheme.colors.surface }]}>
                      <Ionicons name="camera" size={16} color={pTheme.colors.onPrimary} />
                    </View>
                  )}
                </Pressable>
                <Text style={[styles.avatarHint, { color: pTheme.colors.onSurfaceVariant }]}>
                  {Platform.OS === 'web' ? '点击或拖拽图片更换头像' : '点击更换头像'}
                </Text>
              </View>

              {/* 个人信息 */}
              <List.Section>
                <List.Subheader>个人信息</List.Subheader>
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
                <List.Item
                  title="家乡"
                  description={hometownLabel}
                  left={(props) => <List.Icon {...props} icon="map-marker" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => setHometownPickerOpen(true)}
                />
              </List.Section>

              {/* 主题设置 */}
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
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: accentColor || pTheme.colors.primary, marginRight: 8 }} />
                      <List.Icon {...props} icon="chevron-right" />
                    </View>
                  )}
                  onPress={() => setColorPickerOpen(true)}
                />
              </List.Section>

              {/* 账号操作 */}
              <List.Section>
                <List.Subheader>账号</List.Subheader>
                <List.Item
                  title="退出登录"
                  titleStyle={{ color: pTheme.colors.error }}
                  left={(props) => <List.Icon {...props} icon="logout" color={pTheme.colors.error} />}
                  onPress={handleLogout}
                />
              </List.Section>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 主题选择 */}
      <BottomSheet visible={sheet === 'theme'} onClose={() => setSheet(null)}>
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
      </BottomSheet>

      {/* 编辑昵称 */}
      <BottomSheet visible={sheet === 'edit-name'} onClose={() => setSheet(null)} height={200}>
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
      </BottomSheet>

      {/* 编辑简介 */}
      <BottomSheet visible={sheet === 'edit-bio'} onClose={() => setSheet(null)} height={280}>
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
      </BottomSheet>

      {/* 家乡选择 */}
      <CenterPicker
        visible={hometownPickerOpen}
        onClose={() => setHometownPickerOpen(false)}
        title="选择家乡"
        options={HOMETOWN_OPTIONS}
        selectedValue={hometown}
        onSelect={(value) => setHometown(value)}
      />

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
  loadingWrap: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
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
