/**
 * Centralized icon size definitions.
 */

export const iconSizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
  hero: 48,
} as const;

export type IconSize = keyof typeof iconSizes;
