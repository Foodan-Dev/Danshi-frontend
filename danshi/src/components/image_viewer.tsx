import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Platform,
  FlatList,
  StatusBar,
} from 'react-native';
import { Text, IconButton, useTheme as usePaperTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

interface ZoomableImageProps {
  uri: string;
  onSingleTap: () => void;
}

/**
 * 可缩放的单张图片组件
 * - 移动端：支持双指捏合缩放、双击缩放、拖动
 * - Web端：支持滚轮缩放、拖动
 */
function ZoomableImage({ uri, onSingleTap }: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // 重置缩放和位移
  const resetTransform = useCallback(() => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  // 限制位移范围
  const clampTranslate = useCallback((value: number, maxValue: number) => {
    'worklet';
    return Math.min(Math.max(value, -maxValue), maxValue);
  }, []);

  // 捏合缩放手势
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.5), 5);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        resetTransform();
      }
    });

  // 拖动手势
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      if (scale.value > 1) {
        const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;
        translateX.value = clampTranslate(
          savedTranslateX.value + e.translationX,
          maxTranslateX
        );
        translateY.value = clampTranslate(
          savedTranslateY.value + e.translationY,
          maxTranslateY
        );
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // 点击手势（双击缩放，单击关闭）
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) return;

      if (scale.value > 1) {
        resetTransform();
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDelay(250)
    .onEnd((_event, success) => {
      if (!success) return;

      runOnJS(onSingleTap)();
    });

  const tapGesture = Gesture.Exclusive(doubleTapGesture, singleTapGesture);

  // 组合手势
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(panGesture, tapGesture)
  );

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Web 端滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale.value * delta, 0.5), 5);
    scale.value = withTiming(newScale, { duration: 100 });
    savedScale.value = newScale;

    if (newScale < 1) {
      translateX.value = withTiming(0, { duration: 100 });
      translateY.value = withTiming(0, { duration: 100 });
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  if (Platform.OS === 'web') {
    return (
      <View
        style={styles.imageContainer}
        // @ts-ignore - Web only
        onWheel={handleWheel}
      >
        <Animated.Image
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onSingleTap} />
      </View>
    );
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={styles.imageContainer}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * 图片查看器组件
 * 支持多图浏览、缩放、关闭
 */
export default function ImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: ImageViewerProps) {
  const theme = usePaperTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeImages = useMemo(
    () => images.map((item) => getSafeRemoteUrl(item)).filter((item): item is string => !!item),
    [images]
  );
  const normalizedInitialIndex = Math.min(Math.max(initialIndex, 0), Math.max(0, safeImages.length - 1));

  const clearPendingScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  // 当 visible 变化时，重置到初始索引
  React.useEffect(() => {
    clearPendingScroll();

    if (!visible || !safeImages.length) return clearPendingScroll;

    setCurrentIndex(normalizedInitialIndex);
    // 延迟滚动，确保 FlatList 已渲染
    scrollTimeoutRef.current = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: normalizedInitialIndex,
        animated: false,
      });
      scrollTimeoutRef.current = null;
    }, 50);

    return clearPendingScroll;
  }, [clearPendingScroll, visible, normalizedInitialIndex, safeImages.length]);

  React.useEffect(() => clearPendingScroll, [clearPendingScroll]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <View style={styles.slide}>
        <ZoomableImage uri={item} onSingleTap={onClose} />
      </View>
    ),
    [onClose]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  if (!visible) return null;

  const content = (
    <View style={[styles.container, { backgroundColor: theme.colors.scrim }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.scrim} />

      {/* 顶部栏 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton
          icon="close"
          iconColor={theme.colors.inverseOnSurface}
          size={28}
          onPress={onClose}
          style={styles.closeButton}
        />
        {safeImages.length > 1 && (
          <Text style={[styles.counter, { color: theme.colors.inverseOnSurface }]}>
            {currentIndex + 1} / {safeImages.length}
          </Text>
        )}
        <View style={{ width: 48 }} />
      </View>

      {/* 图片列表 */}
      {!safeImages.length ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.inverseOnSurface }]}>
            图片暂时不可用
          </Text>
        </View>
      ) : safeImages.length === 1 ? (
        <View style={styles.singleImageContainer}>
          <ZoomableImage uri={safeImages[0]} onSingleTap={onClose} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={safeImages}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          initialScrollIndex={normalizedInitialIndex}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}

      {/* 底部指示器 */}
      {safeImages.length > 1 && (
        <View style={[styles.pagination, { paddingBottom: insets.bottom + 20 }]}>
          {safeImages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex
                    ? theme.colors.inverseOnSurface
                    : `${theme.colors.inverseOnSurface}66` // 40% opacity
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );

  // Web 端使用 Modal，原生端也使用 Modal
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {Platform.OS === 'web' ? (
        content
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          {content}
        </GestureHandlerRootView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
  closeButton: {
    margin: 0,
  },
  counter: {
    // color 已移至动态样式
    fontSize: 16,
    fontWeight: '500',
  },
  singleImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  pagination: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // dotActive 和 dotInactive 颜色已移至动态样式
});
