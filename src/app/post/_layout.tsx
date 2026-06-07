import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/src/context/theme_context';

export default function PostStackLayout() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background as string }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background as string },
          // 流畅的过渡动画
          animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
          animationDuration: 200,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          presentation: 'card',
        }}
      >
        <Stack.Screen name="[postId]" />
        <Stack.Screen name="edit" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
