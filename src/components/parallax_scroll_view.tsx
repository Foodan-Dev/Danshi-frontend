import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';

import { ThemedView } from '@/src/components/themed_view';
import { useTheme, ThemeColors } from '@/src/context/theme_context';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  // Backwards-compatible: either pass explicit light/dark mapping or a key from theme palette
  headerBackgroundColor?: { dark: string; light: string };
  headerColorKey?: keyof ThemeColors;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerColorKey,
}: Props) {
  const { colors, effective } = useTheme();
  const backgroundColor = colors.background;

  // derive a single header background color from either the explicit mapping or the theme key
  const headerBgColorValue = headerBackgroundColor ? headerBackgroundColor[effective] : headerColorKey ? colors[headerColorKey] : undefined;
  // Ensure we have a valid string color value
  const headerBgColor = typeof headerBgColorValue === 'string' ? headerBgColorValue : undefined;
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ backgroundColor, flex: 1 }}
      scrollEventThrottle={16}>
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: headerBgColor },
          headerAnimatedStyle,
        ]}>
        {headerImage}
      </Animated.View>
      <ThemedView style={styles.content}>{children}</ThemedView>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    // Keep vertical rhythm but avoid horizontal padding to not clash with Container
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
    overflow: 'hidden',
  },
});
