import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/src/context/theme_context';

export default function MyselfSettingsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background as string },
        animation: 'none',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        presentation: 'card',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
