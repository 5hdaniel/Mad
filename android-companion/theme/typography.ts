/**
 * Keepr Companion typography scale.
 * Matches the desktop app font sizes and weights.
 */

import { TextStyle } from 'react-native';

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export const fontWeights = {
  normal: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

export const lineHeights = {
  tight: 20,
  normal: 24,
  relaxed: 28,
  loose: 32,
} as const;

/**
 * Pre-composed text styles for common use cases.
 */
export const textStyles = {
  /** Page title — 24px bold */
  heading: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.loose,
  } satisfies TextStyle,

  /** Section title — 20px bold */
  subheading: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.relaxed,
  } satisfies TextStyle,

  /** Card title — 14px bold uppercase */
  cardTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } satisfies TextStyle,

  /** Body text — 16px normal */
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
  } satisfies TextStyle,

  /** Small label — 14px medium */
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  } satisfies TextStyle,

  /** Caption — 12px normal */
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
  } satisfies TextStyle,

  /** Button text — 16px semibold */
  button: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
  } satisfies TextStyle,

  /** Small button text — 14px semibold */
  buttonSmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  } satisfies TextStyle,
} as const;
