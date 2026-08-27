import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Card, Divider, List, Text, useTheme as usePaperTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomSheetOverlay from '@/src/components/overlays/bottom_sheet';
import { ThemeColorPicker } from '@/src/components/theme_color_picker';
import { useAuth } from '@/src/context/auth_context';
import { useTheme } from '@/src/context/theme_context';

type SettingsScreenProps = {
  accountHref: Href;
  aboutHref: Href;
};

export default function SettingsScreen({ accountHref, aboutHref }: SettingsScreenProps) {
  const { mode, setMode, accentColor } = useTheme();
  const { userToken, user, preview, isLoading: authLoading } = useAuth();
  const theme = usePaperTheme();
  const insets = useSafeAreaInsets();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const themeLabel = useMemo(
    () => (mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色模式' : '深色模式'),
    [mode],
  );

  const accountDescription = useMemo(() => {
    if (authLoading) return '正在读取登录状态…';
    if (!userToken) return '未登录 · 登录后管理个人资料和账号';

    const displayName = user?.name || preview?.name;
    return displayName
      ? `${displayName} · 个人资料、登录设备与账号操作`
      : '个人资料、登录设备与账号操作';
  }, [authLoading, preview?.name, user?.name, userToken]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(userToken ? '/myself' : '/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="设置" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text variant="bodyMedium" style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}>
          管理账号与本机偏好。故障诊断信息位于“关于”。
        </Text>

        <List.Section style={styles.section}>
          <List.Subheader>账号</List.Subheader>
          <Card mode="contained" style={styles.card}>
            <List.Item
              title="账号管理"
              description={accountDescription}
              descriptionNumberOfLines={2}
              left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push(accountHref)}
            />
          </Card>
        </List.Section>

        <List.Section style={styles.section}>
          <List.Subheader>外观</List.Subheader>
          <Card mode="contained" style={styles.card}>
            <List.Item
              title="主题模式"
              description={themeLabel}
              left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => setThemeSheetOpen(true)}
            />
            <Divider />
            <List.Item
              title="主题色"
              description={accentColor ? accentColor.toUpperCase() : '默认'}
              left={(props) => <List.Icon {...props} icon="palette-outline" />}
              right={(props) => (
                <View style={styles.colorPreviewRow}>
                  <View
                    style={[
                      styles.colorPreview,
                      { backgroundColor: accentColor || theme.colors.primary },
                    ]}
                  />
                  <List.Icon {...props} icon="chevron-right" />
                </View>
              )}
              onPress={() => setColorPickerOpen(true)}
            />
          </Card>
        </List.Section>

        <List.Section style={styles.section}>
          <List.Subheader>关于</List.Subheader>
          <Card mode="contained" style={styles.card}>
            <List.Item
              title="关于旦食"
              description="版本、运行环境与故障诊断信息"
              left={(props) => <List.Icon {...props} icon="information-outline" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push(aboutHref)}
            />
          </Card>
        </List.Section>
      </ScrollView>

      <BottomSheetOverlay visible={themeSheetOpen} onClose={() => setThemeSheetOpen(false)}>
        <Text style={styles.sheetTitle}>选择主题模式</Text>
        {(['system', 'light', 'dark'] as const).map((nextMode) => (
          <Pressable
            key={nextMode}
            onPress={() => {
              setMode(nextMode);
              setThemeSheetOpen(false);
            }}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            <Text style={{ color: theme.colors.onSurface }}>
              {nextMode === 'system' ? '跟随系统' : nextMode === 'light' ? '浅色模式' : '深色模式'}
            </Text>
            {mode === nextMode ? (
              <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
            ) : null}
          </Pressable>
        ))}
      </BottomSheetOverlay>

      <ThemeColorPicker visible={colorPickerOpen} onDismiss={() => setColorPickerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  intro: {
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  section: {
    marginVertical: 4,
  },
  card: {
    overflow: 'hidden',
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
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
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
  optionPressed: {
    opacity: 0.6,
  },
});
