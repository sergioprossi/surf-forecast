import { TextStyle } from 'react-native';

/** Typography scale — Sora for headlines, system font for body */
export const typography = {
  // Headlines (Sora would be a custom font — using system bold as fallback)
  h1: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
    letterSpacing: -1,
  } as TextStyle,

  h2: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
  } as TextStyle,

  h3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  } as TextStyle,

  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,

  // Body
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  } as TextStyle,

  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,

  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,

  // Labels
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as TextStyle,

  // Score display
  scoreHero: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 80,
    letterSpacing: -2,
  } as TextStyle,

  scoreMedium: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  } as TextStyle,
} as const;
