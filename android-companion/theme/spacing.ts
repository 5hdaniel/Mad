/**
 * Keepr Companion spacing scale.
 * Consistent 4px base grid matching Tailwind defaults.
 */

export const spacing = {
  /** 0px */
  none: 0,
  /** 2px */
  '0.5': 2,
  /** 4px */
  1: 4,
  /** 6px */
  1.5: 6,
  /** 8px */
  2: 8,
  /** 12px */
  3: 12,
  /** 16px */
  4: 16,
  /** 20px */
  5: 20,
  /** 24px */
  6: 24,
  /** 32px */
  8: 32,
  /** 40px */
  10: 40,
  /** 48px */
  12: 48,
  /** 64px */
  16: 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;
