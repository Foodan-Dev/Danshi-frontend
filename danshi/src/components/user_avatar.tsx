import React from 'react';
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

  const handlePress = () => {
    if (disabled) return;
    router.push(`/user/${userId}` as Href);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.container, style]}
      android_ripple={{ color: pTheme.colors.surfaceDisabled, borderless: true }}
    >
      <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        {safeAvatarUrl ? (
          <Image
            source={{ uri: safeAvatarUrl }}
            style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: pTheme.colors.surfaceVariant, width: size, height: size, borderRadius: size / 2 }]}>
            <Ionicons name="person" size={size * 0.6} color={pTheme.colors.onSurfaceVariant} />
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
