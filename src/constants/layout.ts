import type { BreakpointKey } from '@/src/constants/breakpoints';
import { Spacing } from '@/src/constants/theme';

// Optional brand/layout overrides can be supplied via theme file if needed
export type ContainerConfigOverrides = Partial<{
  maxWidths: Partial<Record<'base' | BreakpointKey, number>>;
  paddings: Partial<Record<'base' | BreakpointKey, number>>;
}>;

// Consumers can import and override this in a single place in the future if needed
export const LayoutOverrides: ContainerConfigOverrides | undefined = undefined;

export type ContainerConfig = {
  maxWidths: Record<'base' | BreakpointKey, number>;
  paddings: Record<'base' | BreakpointKey, number>;
};

const defaultConfig: ContainerConfig = {
  maxWidths: {
    base: 720,
    sm: 720,
    md: 860,
    lg: 1024,
    xl: 1200,
  },
  paddings: {
    base: Spacing.md,
    sm: Spacing.md,
    md: Spacing.lg,
    lg: Spacing.xl,
    xl: Spacing.xl,
  },
};

const overrides = (LayoutOverrides ?? {}) as ContainerConfigOverrides;

export const containerConfig: ContainerConfig = {
  maxWidths: {
    ...defaultConfig.maxWidths,
    ...(overrides.maxWidths ?? {}),
  },
  paddings: {
    ...defaultConfig.paddings,
    ...(overrides.paddings ?? {}),
  },
};
