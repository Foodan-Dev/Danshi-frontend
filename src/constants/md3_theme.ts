import { MD3DarkTheme, MD3LightTheme, MD3Theme, useTheme as usePaperTheme } from 'react-native-paper'
import { generatePalette } from '@/src/lib/theme/color_generator'

// ==================== 语义颜色扩展 ====================
// 帖子类型颜色：推荐(green)、避雷(red)、求助(purple)

export interface SemanticColors {
  // 推荐类型 (绿色)
  recommend: string;
  onRecommend: string;
  recommendContainer: string;
  onRecommendContainer: string;
  // 避雷类型 (红色)
  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;
  // 求助类型 (紫色)
  seeking: string;
  onSeeking: string;
  seekingContainer: string;
  onSeekingContainer: string;
}

export interface SurfaceColors {
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
}

const semanticLight: SemanticColors = {
  // 推荐：绿色系
  recommend: '#059669',
  onRecommend: '#FFFFFF',
  recommendContainer: '#D1FAE5',
  onRecommendContainer: '#065F46',
  // 避雷：红色系
  warning: '#DC2626',
  onWarning: '#FFFFFF',
  warningContainer: '#FEE2E2',
  onWarningContainer: '#7F1D1D',
  // 求助：紫色系
  seeking: '#7C3AED',
  onSeeking: '#FFFFFF',
  seekingContainer: '#EDE9FE',
  onSeekingContainer: '#5B21B6',
};

const semanticDark: SemanticColors = {
  // 推荐：绿色系 (深色模式调亮)
  recommend: '#34D399',
  onRecommend: '#065F46',
  recommendContainer: '#065F46',
  onRecommendContainer: '#D1FAE5',
  // 避雷：红色系 (深色模式调亮)
  warning: '#F87171',
  onWarning: '#7F1D1D',
  warningContainer: '#7F1D1D',
  onWarningContainer: '#FEE2E2',
  // 求助：紫色系 (深色模式调亮)
  seeking: '#A78BFA',
  onSeeking: '#5B21B6',
  seekingContainer: '#5B21B6',
  onSeekingContainer: '#EDE9FE',
};

// ==================== MD3 基础颜色 ====================

const brandLight = {
  primary: '#F97316',
  surfaceTint: '#F97316',
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFEDD5',
  onPrimaryContainer: '#7C2D12',
  secondary: '#64748B',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F1F5F9',
  onSecondaryContainer: '#334155',
  tertiary: '#10B981',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#D1FAE5',
  onTertiaryContainer: '#065F46',
  error: '#E53935',
  onError: '#FFFFFF',
  errorContainer: '#FFEBEE',
  onErrorContainer: '#7F1D1D',
  background: '#FFFFFF',
  onBackground: '#1A1A1A',
  surface: '#FFFFFF',
  onSurface: '#1A1A1A',
  surfaceVariant: '#F8F8F8',
  onSurfaceVariant: '#5F6368',
  outline: '#DADCE0',
  outlineVariant: '#F1F3F4',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#1F2937',
  inverseOnSurface: '#F9FAFB',
  inversePrimary: '#FDBA74',
  primaryFixed: '#FFEDD5',
  onPrimaryFixed: '#7C2D12',
  primaryFixedDim: '#FB923C',
  onPrimaryFixedVariant: '#EA580C',
  secondaryFixed: '#F1F5F9',
  onSecondaryFixed: '#334155',
  secondaryFixedDim: '#94A3B8',
  onSecondaryFixedVariant: '#475569',
  tertiaryFixed: '#D1FAE5',
  onTertiaryFixed: '#065F46',
  tertiaryFixedDim: '#6EE7B7',
  onTertiaryFixedVariant: '#047857',
  surfaceDim: '#E8EAED',
  surfaceBright: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFBFC',
  surfaceContainer: '#F5F6F7',
  surfaceContainerHigh: '#F0F1F2',
  surfaceContainerHighest: '#E8EAED',
};

/**
 * 暗色主题
 */
const brandDark = {
  primary: '#FB923C',
  surfaceTint: '#FB923C',
  onPrimary: '#FFFFFF',
  primaryContainer: '#C2410C',
  onPrimaryContainer: '#FFEDD5',
  secondary: '#94A3B8',
  onSecondary: '#334155',
  secondaryContainer: '#475569',
  onSecondaryContainer: '#F1F5F9',
  tertiary: '#6EE7B7',
  onTertiary: '#065F46',
  tertiaryContainer: '#047857',
  onTertiaryContainer: '#D1FAE5',
  error: '#EF9A9A',
  onError: '#7F1D1D',
  errorContainer: '#C62828',
  onErrorContainer: '#FFEBEE',
  background: '#121212',
  onBackground: '#F5F5F5',
  surface: '#121212',
  onSurface: '#F5F5F5',
  surfaceVariant: '#2D2D2D',
  onSurfaceVariant: '#D1D5DB',
  outline: '#6B7280',
  outlineVariant: '#4B5563',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#F5F5F5',
  inverseOnSurface: '#1F2937',
  inversePrimary: '#F97316',
  primaryFixed: '#FFEDD5',
  onPrimaryFixed: '#7C2D12',
  primaryFixedDim: '#FB923C',
  onPrimaryFixedVariant: '#EA580C',
  secondaryFixed: '#F1F5F9',
  onSecondaryFixed: '#334155',
  secondaryFixedDim: '#94A3B8',
  onSecondaryFixedVariant: '#475569',
  tertiaryFixed: '#D1FAE5',
  onTertiaryFixed: '#065F46',
  tertiaryFixedDim: '#6EE7B7',
  onTertiaryFixedVariant: '#047857',
  surfaceDim: '#0F0F0F',
  surfaceBright: '#1E1E1E',
  surfaceContainerLowest: '#0A0A0A',
  surfaceContainerLow: '#1A1A1A',
  surfaceContainer: '#1E1E1E',
  surfaceContainerHigh: '#282828',
  surfaceContainerHighest: '#353535',
};

// ==================== 扩展主题类型 ====================

export type ExtendedMD3Theme = MD3Theme & {
  colors: MD3Theme['colors'] & SemanticColors & SurfaceColors;
};

// 默认主题色
const DEFAULT_ACCENT_COLOR = '#F97316';

function buildTheme(mode: 'light' | 'dark', accentColor?: string): ExtendedMD3Theme {
  const base = mode === 'dark' ? MD3DarkTheme : MD3LightTheme
  const semantic = mode === 'dark' ? semanticDark : semanticLight

  // 如果没有自定义主题色（空字符串或未定义），使用预设的颜色
  // 否则使用动态生成的调色板
  const useCustomColor = accentColor && accentColor.trim() !== ''
  const palette = useCustomColor
    ? generatePalette(accentColor, mode === 'dark')
    : (mode === 'dark' ? brandDark : brandLight)

  return {
    ...base,
    roundness: 4, 
    colors: {
      ...base.colors,
      ...palette,
      ...semantic,
    },
  }
}

/**
 * 获取 MD3 主题
 * @param mode 亮色/暗色模式
 * @param accentColor 可选的自定义主题色（HEX 格式），空字符串或不传则使用预设品牌色
 */
export function getMD3Theme(mode: 'light' | 'dark', accentColor?: string): ExtendedMD3Theme {
  return buildTheme(mode, accentColor)
}

/**
 * 类型安全的主题 Hook，返回包含语义颜色的扩展主题。
 * 用于替代 `usePaperTheme()` + `theme.colors as any` 的模式。
 */
export function useExtendedTheme(): ExtendedMD3Theme {
  return usePaperTheme<ExtendedMD3Theme>();
}
