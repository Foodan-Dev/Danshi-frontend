import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, StyleSheet, Pressable, Animated, Easing, ScrollView, Dimensions } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';

export type PickerOption = {
  label: string;
  value: string;
};

export type CenterPickerProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: PickerOption[];
  selectedValue?: string | null;
  onSelect: (value: string) => void;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_HEIGHT = SCREEN_HEIGHT * 0.6;

export const CenterPicker: React.FC<CenterPickerProps> = ({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}) => {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }

    animationRef.current?.stop();
    if (visible) {
      animationRef.current = Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    } else {
      animationRef.current = Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 110,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 110,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    }
    animationRef.current.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => {
      animationRef.current?.stop();
    };
  }, [visible, scale, opacity]);

  const handleSelect = (value: string) => {
    onSelect(value);
    onClose();
  };

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                backgroundColor: theme.colors.scrim,
                opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
              },
            ]}
          />
        </Pressable>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            styles.picker,
            {
              backgroundColor: theme.colors.surface,
              shadowColor: theme.colors.shadow,
              transform: [{ scale }],
              opacity,
            },
          ]}
        >
          {title ? (
            <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
              <Text variant="titleMedium" style={{ fontWeight: '600' }}>{title}</Text>
              <IconButton icon="close" size={20} onPress={onClose} />
            </View>
          ) : null}
          <ScrollView
            style={{ maxHeight: MAX_HEIGHT - 60 }}
            contentContainerStyle={styles.optionsContainer}
            showsVerticalScrollIndicator={true}
          >
            {options.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  暂无可选项
                </Text>
              </View>
            ) : options.map((option) => {
              const isSelected = option.value === selectedValue;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primaryContainer
                        : pressed
                        ? theme.colors.surfaceVariant
                        : 'transparent',
                    },
                  ]}
                >
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                      fontWeight: isSelected ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // backgroundColor 已移至动态样式，使用 theme.colors.scrim
  },
  picker: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    // shadowColor 使用 theme.colors.shadow（已在 MD3 主题中定义为 #000000）
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionsContainer: {
    paddingVertical: 8,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 10,
  },
});

export default CenterPicker;
