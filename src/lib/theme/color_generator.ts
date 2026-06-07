/**
 * 基于 Material Color Utilities 的动态主题色生成器
 * 从用户选择的单一种子色生成完整的 MD3 调色板
 */

import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  TonalPalette,
  Hct,
} from '@material/material-color-utilities';

export interface GeneratedPalette {
  // Primary
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  // Secondary
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  // Tertiary
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  // Error (固定)
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  // Surface
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceTint: string;
  // Background
  background: string;
  onBackground: string;
  // Outline
  outline: string;
  outlineVariant: string;
  // Inverse
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  // Shadow
  shadow: string;
  scrim: string;
  // Surface containers
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
}

/**
 * 预设主题色选项
 */
export const PRESET_COLORS = [
  { name: '活力橙', hex: '#F97316', emoji: '🟠' },
  { name: '宁静蓝', hex: '#3B82F6', emoji: '🔵' },
  { name: '清新绿', hex: '#10B981', emoji: '🟢' },
  { name: '优雅紫', hex: '#8B5CF6', emoji: '🟣' },
  { name: '热情红', hex: '#EF4444', emoji: '🔴' },
  { name: '樱花粉', hex: '#EC4899', emoji: '🌸' },
  { name: '天空青', hex: '#06B6D4', emoji: '🩵' },
  { name: '琥珀金', hex: '#F59E0B', emoji: '🟡' },
] as const;

export type PresetColorName = typeof PRESET_COLORS[number]['name'];

/**
 * 验证是否为有效的 HEX 颜色
 */
export function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

/**
 * 从种子色生成完整的 MD3 调色板
 * @param seedColor HEX 格式的种子色（如 #F97316）
 * @param isDark 是否为暗色模式
 */
export function generatePalette(seedColor: string, isDark: boolean): GeneratedPalette {
  const argb = argbFromHex(seedColor);
  const theme = themeFromSourceColor(argb);
  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;

  return {
    // Primary
    primary: hexFromArgb(scheme.primary),
    onPrimary: hexFromArgb(scheme.onPrimary),
    primaryContainer: hexFromArgb(scheme.primaryContainer),
    onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),
    // Secondary
    secondary: hexFromArgb(scheme.secondary),
    onSecondary: hexFromArgb(scheme.onSecondary),
    secondaryContainer: hexFromArgb(scheme.secondaryContainer),
    onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),
    // Tertiary
    tertiary: hexFromArgb(scheme.tertiary),
    onTertiary: hexFromArgb(scheme.onTertiary),
    tertiaryContainer: hexFromArgb(scheme.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(scheme.onTertiaryContainer),
    // Error
    error: hexFromArgb(scheme.error),
    onError: hexFromArgb(scheme.onError),
    errorContainer: hexFromArgb(scheme.errorContainer),
    onErrorContainer: hexFromArgb(scheme.onErrorContainer),
    // Surface
    surface: hexFromArgb(scheme.surface),
    onSurface: hexFromArgb(scheme.onSurface),
    surfaceVariant: hexFromArgb(scheme.surfaceVariant),
    onSurfaceVariant: hexFromArgb(scheme.onSurfaceVariant),
    surfaceTint: hexFromArgb(scheme.primary),
    // Background
    background: hexFromArgb(scheme.background),
    onBackground: hexFromArgb(scheme.onBackground),
    // Outline
    outline: hexFromArgb(scheme.outline),
    outlineVariant: hexFromArgb(scheme.outlineVariant),
    // Inverse
    inverseSurface: hexFromArgb(scheme.inverseSurface),
    inverseOnSurface: hexFromArgb(scheme.inverseOnSurface),
    inversePrimary: hexFromArgb(scheme.inversePrimary),
    // Shadow
    shadow: hexFromArgb(scheme.shadow),
    scrim: hexFromArgb(scheme.scrim),
    // Surface containers (使用 neutral tonal palette)
    ...generateSurfaceContainers(theme.palettes.neutral, isDark),
  };
}

/**
 * 生成 Surface Container 系列颜色
 */
function generateSurfaceContainers(
  neutralPalette: TonalPalette,
  isDark: boolean
): Pick<
  GeneratedPalette,
  | 'surfaceDim'
  | 'surfaceBright'
  | 'surfaceContainerLowest'
  | 'surfaceContainerLow'
  | 'surfaceContainer'
  | 'surfaceContainerHigh'
  | 'surfaceContainerHighest'
> {
  if (isDark) {
    return {
      surfaceDim: hexFromArgb(neutralPalette.tone(6)),
      surfaceBright: hexFromArgb(neutralPalette.tone(24)),
      surfaceContainerLowest: hexFromArgb(neutralPalette.tone(4)),
      surfaceContainerLow: hexFromArgb(neutralPalette.tone(10)),
      surfaceContainer: hexFromArgb(neutralPalette.tone(12)),
      surfaceContainerHigh: hexFromArgb(neutralPalette.tone(17)),
      surfaceContainerHighest: hexFromArgb(neutralPalette.tone(22)),
    };
  } else {
    return {
      surfaceDim: hexFromArgb(neutralPalette.tone(87)),
      surfaceBright: hexFromArgb(neutralPalette.tone(98)),
      surfaceContainerLowest: hexFromArgb(neutralPalette.tone(100)),
      surfaceContainerLow: hexFromArgb(neutralPalette.tone(96)),
      surfaceContainer: hexFromArgb(neutralPalette.tone(94)),
      surfaceContainerHigh: hexFromArgb(neutralPalette.tone(92)),
      surfaceContainerHighest: hexFromArgb(neutralPalette.tone(90)),
    };
  }
}

/**
 * 获取颜色的对比色（用于在颜色预览圆圈上显示选中标记）
 */
export function getContrastColor(hex: string): string {
  const argb = argbFromHex(hex);
  const hct = Hct.fromInt(argb);
  // 如果颜色较亮，返回深色；否则返回浅色
  return hct.tone > 50 ? '#000000' : '#FFFFFF';
}
