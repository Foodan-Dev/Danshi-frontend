import React, { useMemo } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text, useTheme as usePaperTheme } from 'react-native-paper';
import { router, type Href } from 'expo-router';
import { CachedAvatar } from '@/src/components/cached_avatar';
import { UNSET_NICKNAME } from '@/src/constants/user';

export type UserAvatarProps = {
  userId: number;
  name: string | null;
  avatar_url?: string | null;
  size?: number;
  show_name?: boolean;
  name_variant?: 'titleSmall' | 'titleMedium' | 'titleLarge' | 'bodySmall' | 'bodyMedium';
  style?: ViewStyle;
  disabled?: boolean;
};

/**
 * 可点击的用户头像组件，点击后跳转到用户主页
 */
export function UserAvatar({
  userId,
  name,
  avatar_url,
  size = 32,
  show_name = false,
  name_variant = 'bodyMedium',
  style,
  disabled = false,
}: UserAvatarProps) {
  const pTheme = usePaperTheme();
  const normalizedUserId = useMemo(
    () => Number.isSafeInteger(userId) && userId > 0 ? userId : null,
    [userId],
  );
  const resolvedSize = useMemo(
    () => (Number.isFinite(size) ? Math.max(16, Math.min(96, Math.floor(size))) : 32),
    [size]
  );

  const handlePress = () => {
    if (disabled || !normalizedUserId) return;
    router.push(`/user/${normalizedUserId}` as Href);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.container, style]}
      android_ripple={{ color: pTheme.colors.surfaceDisabled, borderless: true }}
    >
      <CachedAvatar uri={avatar_url} size={resolvedSize} />
      {show_name && (
        <Text
          variant={name_variant}
          style={[styles.name, { color: pTheme.colors.onSurface }]}
          numberOfLines={1}
        >
          {name || UNSET_NICKNAME}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    marginLeft: 8,
    fontWeight: '500',
  },
});
