// Breakpoint pixel values (min-width). Base covers widths below `sm`.
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type BreakpointKey = keyof typeof breakpoints; // 'sm' | 'md' | 'lg' | 'xl'
export type Breakpoint = 'base' | BreakpointKey; // include 'base'

export const BREAKPOINT_ORDER: Breakpoint[] = ['base', 'sm', 'md', 'lg', 'xl'];

// Pick value by current breakpoint
export function pickByBreakpoint<T>(current: Breakpoint, map: Record<Breakpoint, T> | Partial<Record<Breakpoint, T>> & { base: T }): T {
  // exact match first
  if (map[current as keyof typeof map] != null) return map[current as keyof typeof map] as T;
  // fallback to the nearest smaller breakpoint defined
  const idx = BREAKPOINT_ORDER.indexOf(current);
  for (let i = idx; i >= 0; i--) {
    const key = BREAKPOINT_ORDER[i] as keyof typeof map;
    if (map[key] != null) return map[key] as T;
  }
  // final fallback to base (required in type)
  return (map as Record<Breakpoint, T>).base;
}
