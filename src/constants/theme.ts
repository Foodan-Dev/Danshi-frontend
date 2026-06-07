/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Responsive tokens: spacing scale and type scale per breakpoint
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type BreakpointName = 'base' | 'sm' | 'md' | 'lg' | 'xl';

export type TypeScaleConfig = Record<
  'h1' | 'h2' | 'h3' | 'subtitle' | 'body' | 'caption',
  Record<BreakpointName, number>
>;

export const TypeScale: TypeScaleConfig = {
  h1: { base: 28, sm: 28, md: 32, lg: 36, xl: 40 },
  h2: { base: 22, sm: 22, md: 24, lg: 28, xl: 32 },
  h3: { base: 18, sm: 18, md: 20, lg: 22, xl: 24 },
  subtitle: { base: 16, sm: 16, md: 17, lg: 18, xl: 18 },
  body: { base: 14, sm: 14, md: 15, lg: 16, xl: 16 },
  caption: { base: 12, sm: 12, md: 12, lg: 13, xl: 13 },
};

const tintColorLight = '#F57C00';
const tintColorDark = '#F57C00';

export const Colors = {
  light: {
    text: '#422C1E',
    background: '#FFFBF7',
    card: '#FFFFFF',
    danger: '#E64A19',
    header: '#FFB74D',
    headerAlt: '#FFB74D',
    tint: tintColorLight,
    icon: '#F57C00',
    tabIconDefault: '#FFB74D',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F3EADE',
    background: '#2A1F1A',
    card: '#3A2D25',
    danger: '#E64A19',
    header: '#FFB74D',
    headerAlt: '#FFB74D',
    tint: tintColorDark,
    icon: '#F57C00',
    tabIconDefault: '#8A7E78',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
