import React from 'react';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { useTheme } from '@/src/context/theme_context';
import { useAuth } from '@/src/context/auth_context';

export default function AuthLayout() {
  const theme = useTheme();
  const { userToken, isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingWrap, { backgroundColor: theme.background as string }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  if (userToken) {
    return <Redirect href="/explore" />;
  }
  return (
    <View style={[styles.container, { backgroundColor: theme.background as string }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          // 流畅的过渡动画
          animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom',
          animationDuration: 200,
          gestureEnabled: true,
          presentation: 'card',
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
