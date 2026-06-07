/**
 * useResponsive — 统一的响应式 Hook
 *
 * 合并了原 useResponsive 和 use_media_query 中的功能，
 * 提供断点判断、窗口尺寸等信息。
 */
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { breakpoints, type Breakpoint, type BreakpointKey } from '@/src/constants/breakpoints';

export type ResponsiveInfo = {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
  /** 当前命中的断点名称 */
  current: Breakpoint;
  /** 便捷布尔值 */
  isSM: boolean;
  isMD: boolean;
  isLG: boolean;
  isXL: boolean;
};

/** 获取完整响应式信息 */
export function useResponsive(): ResponsiveInfo {
  const { width, height, scale, fontScale } = useWindowDimensions();

  return useMemo(() => {
    const current: Breakpoint =
      width >= breakpoints.xl ? 'xl'
      : width >= breakpoints.lg ? 'lg'
      : width >= breakpoints.md ? 'md'
      : width >= breakpoints.sm ? 'sm'
      : 'base';

    return {
      width,
      height,
      scale,
      fontScale,
      current,
      isSM: width >= breakpoints.sm,
      isMD: width >= breakpoints.md,
      isLG: width >= breakpoints.lg,
      isXL: width >= breakpoints.xl,
    };
  }, [width, height, scale, fontScale]);
}

/** 只获取当前断点名称（轻量快捷方式） */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'base';
}

/** 判断当前宽度是否 >= 指定断点 */
export function useMinWidth(bp: BreakpointKey): boolean {
  const { width } = useWindowDimensions();
  return width >= breakpoints[bp];
}

/** 判断当前宽度是否 < 指定断点 */
export function useMaxWidth(bp: BreakpointKey): boolean {
  const { width } = useWindowDimensions();
  return width < breakpoints[bp];
}
