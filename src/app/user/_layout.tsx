import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/src/context/theme_context';

export default function UserStackLayout() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background as string }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background as string },
          animation: 'none',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          presentation: 'card',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
