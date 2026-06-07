import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/src/context/theme_context';

export default function MyselfTabStackLayout() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background as string }]}>
      <Stack
        screenOptions={{
          headerShown: false, // 统一关闭原生 Header，由各页面组件自带 Appbar 处理
          contentStyle: { backgroundColor: theme.background as string },
          animation: 'none',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          presentation: 'card',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="posts" />
        <Stack.Screen name="followers" />
        <Stack.Screen name="following" />
        <Stack.Screen name="admin" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
