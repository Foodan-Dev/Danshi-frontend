import { router, type Href } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDiagnosticsSection } from '@/src/components/settings/app_diagnostics_section';

type AboutScreenProps = {
  settingsHref: Href;
};

export default function AboutScreen({ settingsHref }: AboutScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(settingsHref);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="关于" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text variant="titleLarge">旦食</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          以下信息用于确认当前运行的 App、更新包与 API 地址。遇到启动、网络或 OTA
          问题时，可一键复制后提供给开发者排查。
        </Text>
        <AppDiagnosticsSection />
      </ScrollView>
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
    paddingTop: 20,
    gap: 8,
  },
});
