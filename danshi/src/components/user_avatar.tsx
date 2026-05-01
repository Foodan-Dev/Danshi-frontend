import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Text, useTheme as usePaperTheme } from 'react-native-paper';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

export type UserAvatarProps = {
  userId: string;
  name: string;
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
  const safeAvatarUrl = getSafeRemoteUrl(avatar_url);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const normalizedUserId = useMemo(() => userId.trim(), [userId]);
  const resolvedSize = useMemo(
    () => (Number.isFinite(size) ? Math.max(16, Math.min(96, Math.floor(size))) : 32),
    [size]
  );

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [safeAvatarUrl]);

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
      <View style={[styles.avatarContainer, { width: resolvedSize, height: resolvedSize, borderRadius: resolvedSize / 2 }]}>
        {safeAvatarUrl && !avatarLoadFailed ? (
          <Image
            source={{ uri: safeAvatarUrl }}
            style={[styles.avatar, { width: resolvedSize, height: resolvedSize, borderRadius: resolvedSize / 2 }]}
            resizeMode="cover"
            onError={() => setAvatarLoadFailed(true)}
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: pTheme.colors.surfaceVariant, width: resolvedSize, height: resolvedSize, borderRadius: resolvedSize / 2 }]}>
            <Ionicons name="person" size={resolvedSize * 0.6} color={pTheme.colors.onSurfaceVariant} />
          </View>
        )}
      </View>
      {show_name && (
        <Text
          variant={name_variant}
          style={[styles.name, { color: pTheme.colors.onSurface }]}
          numberOfLines={1}
        >
          {name}
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
  avatarContainer: {
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginLeft: 8,
    fontWeight: '500',
  },
});
