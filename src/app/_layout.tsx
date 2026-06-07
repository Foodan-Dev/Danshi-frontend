import React from 'react';
import { Stack } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeModeProvider, useTheme } from '@/src/context/theme_context';
import { AuthProvider } from '@/src/context/auth_context';
import { WaterfallSettingsProvider } from '@/src/context/waterfall_context';
import { NotificationsProvider } from '@/src/context/notifications_context';
import { PaperProvider } from 'react-native-paper';
import { getMD3Theme } from '@/src/constants/md3_theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <ThemeModeProvider>
        <ThemedPaperRoot>
          <AuthProvider>
            <NotificationsProvider>
              <WaterfallSettingsProvider>
                <RootStack />
              </WaterfallSettingsProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ThemedPaperRoot>
      </ThemeModeProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { effective, background } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: background as string }]}>
      <StatusBar style={effective === 'dark' ? 'light' : 'dark'} translucent />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: background as string },
          // 统一无动画
          animation: 'none',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          // 防止闪白
          presentation: 'card',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post" />
        <Stack.Screen name="user" />
        <Stack.Screen name="search" />
        <Stack.Screen name="notifications" />
      </Stack>
    </View>
  );
}

function ThemedPaperRoot({ children }: { children: React.ReactNode }) {
  const { effective, accentColor } = useTheme();
  const theme = getMD3Theme(effective, accentColor);
  return (
    <PaperProvider theme={theme}>
      <WebAutofillStyle
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.onSurface}
        caretColor={theme.colors.primary}
      />
      {children}
    </PaperProvider>
  );
}

function WebAutofillStyle({
  backgroundColor,
  textColor,
  caretColor,
}: {
  backgroundColor: string;
  textColor: string;
  caretColor: string;
}) {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const styleId = 'danshi-web-autofill-style';
    const css = `
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
textarea:-webkit-autofill,
textarea:-webkit-autofill:hover,
textarea:-webkit-autofill:focus {
  -webkit-text-fill-color: ${textColor};
  caret-color: ${caretColor};
  -webkit-box-shadow: 0 0 0 1000px ${backgroundColor} inset;
  box-shadow: 0 0 0 1000px ${backgroundColor} inset;
}
`;

    const existing = document.getElementById(styleId);
    const style = existing ?? document.createElement('style');
    style.id = styleId;
    style.textContent = css;

    if (!existing) {
      document.head.appendChild(style);
    }

    return () => {
      const current = document.getElementById(styleId);
      if (current?.parentNode) {
        current.parentNode.removeChild(current);
      }
    };
  }, [backgroundColor, textColor, caretColor]);

  return null;
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});
