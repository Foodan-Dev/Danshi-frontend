import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
} from 'react-native';
import { useTheme as usePaperTheme } from 'react-native-paper';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number; // default auto, otherwise fixed height
};

export const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, children, height }) => {
  const paperTheme = usePaperTheme();
  const translateY = useRef(new Animated.Value(1)).current; // 1 -> hidden, 0 -> shown
  const dragY = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const resolvedHeight = useMemo(
    () => (Number.isFinite(height) ? Math.max(120, Math.floor(height as number)) : undefined),
    [height]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.setValue(0);
    }

    animationRef.current?.stop();
    animationRef.current = Animated.timing(translateY, {
      toValue: visible ? 0 : 1,
      duration: visible ? 140 : 110,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animationRef.current.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => {
      animationRef.current?.stop();
    };
  }, [dragY, translateY, visible]);

  const resetDrag = useCallback(() => {
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 0,
    }).start();
  }, [dragY]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => visible,
    onMoveShouldSetPanResponder: (_, gestureState) => visible && gestureState.dy > 2,
    onPanResponderMove: (_, gestureState) => {
      dragY.setValue(Math.max(0, gestureState.dy));
    },
    onPanResponderRelease: (_, gestureState) => {
      const closeThreshold = resolvedHeight ? Math.min(96, resolvedHeight * 0.2) : 72;
      if (gestureState.dy > closeThreshold || gestureState.vy > 0.8) {
        onClose();
        return;
      }
      resetDrag();
    },
    onPanResponderTerminate: resetDrag,
  }), [dragY, onClose, resetDrag, resolvedHeight, visible]);

  const backdropOpacity = translateY.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0] });
  const sheetTranslate = translateY.interpolate({ inputRange: [0, 1], outputRange: [0, 40] });
  const sheetOpacity = translateY.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[styles.backdrop, { backgroundColor: paperTheme.colors.scrim, opacity: backdropOpacity }]} />
        </Pressable>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            styles.sheet,
            {
              backgroundColor: paperTheme.colors.surface,
              shadowColor: paperTheme.colors.shadow,
              transform: [{ translateY: sheetTranslate }, { translateY: dragY }],
              opacity: sheetOpacity,
            },
            resolvedHeight ? { height: resolvedHeight } : undefined,
          ]}
        >
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: paperTheme.colors.outlineVariant }]} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    elevation: 8,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
});

export default BottomSheet;
