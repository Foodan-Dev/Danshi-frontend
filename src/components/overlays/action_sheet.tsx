import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import { BottomSheet } from '@/src/components/overlays/bottom_sheet';

export type ActionSheetItem = {
  key: string;
  title: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type ActionSheetProps = {
  visible: boolean;
  title: string;
  items: ActionSheetItem[];
  onClose: () => void;
};

type ActionSheetContent = Pick<ActionSheetProps, 'title' | 'items'>;

export function ActionSheet({ visible, title, items, onClose }: ActionSheetProps) {
  const theme = useTheme();
  const [cachedContent, setCachedContent] = useState<ActionSheetContent>({ title, items });
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible) setCachedContent({ title, items });
  }, [items, title, visible]);

  const content = visible ? { title, items } : cachedContent;
  const handleClosed = useCallback(() => {
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    pendingAction?.();
  }, []);

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={handleClosed}>
      <View style={styles.container}>
        <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
          {content.title}
        </Text>
        <List.Section style={styles.list}>
          {content.items.map((item) => {
            const color = item.destructive ? theme.colors.error : theme.colors.onSurfaceVariant;
            return (
              <List.Item
                key={item.key}
                title={item.title}
                titleStyle={item.destructive ? { color: theme.colors.error } : undefined}
                left={(props) => <List.Icon {...props} icon={item.icon} color={color} />}
                onPress={() => {
                  pendingActionRef.current = item.onPress;
                  onClose();
                }}
                disabled={item.disabled}
                style={styles.item}
              />
            );
          })}
        </List.Section>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  title: {
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  list: {
    marginVertical: 0,
  },
  item: {
    minHeight: 52,
  },
});
