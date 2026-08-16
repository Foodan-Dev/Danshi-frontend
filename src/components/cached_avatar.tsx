import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme as usePaperTheme } from 'react-native-paper';

import { getSafeRemoteUrl } from '@/src/lib/security/url';

type CachedAvatarProps = {
  uri?: string | null;
  size: number;
  backgroundColor?: ColorValue;
  iconColor?: ColorValue;
  iconSize?: number;
  fallback?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  allowLocalUri?: boolean;
};

export function CachedAvatar({
  uri,
  size,
  backgroundColor,
  iconColor,
  iconSize,
  fallback,
  style,
  allowLocalUri = false,
}: CachedAvatarProps) {
  const theme = usePaperTheme();
  const [loadFailed, setLoadFailed] = useState(false);
  const resolvedSize = useMemo(
    () => (Number.isFinite(size) ? Math.max(16, Math.min(128, Math.floor(size))) : 32),
    [size]
  );
  const resolvedUri = allowLocalUri ? uri?.trim() || undefined : getSafeRemoteUrl(uri);

  useEffect(() => {
    setLoadFailed(false);
  }, [resolvedUri]);

  const avatarStyle = {
    width: resolvedSize,
    height: resolvedSize,
    borderRadius: resolvedSize / 2,
  };

  return (
    <View
      style={[
        styles.container,
        avatarStyle,
        { backgroundColor: backgroundColor ?? theme.colors.surfaceVariant },
        style,
      ]}
    >
      {resolvedUri && !loadFailed ? (
        <Image
          source={{ uri: resolvedUri }}
          style={avatarStyle}
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={resolvedUri}
          onError={() => setLoadFailed(true)}
        />
      ) : fallback ?? (
        <Ionicons
          name="person"
          size={iconSize ?? resolvedSize * 0.6}
          color={iconColor ?? theme.colors.onSurfaceVariant}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
