/**
 * 向后兼容的 re-export。
 * 所有响应式功能已统一到 use_responsive.ts 中。
 */
export { useBreakpoint, useMinWidth, useMaxWidth } from './use_responsive';

/** @deprecated 使用 useResponsive() 替代 */
export { useResponsive as useViewport } from './use_responsive';
