/** Dark palette — matches Pencil mockups */
export const colors = {
  // Backgrounds
  background: '#0C0C0C',
  surface: '#1A1A1A',
  surfaceLight: '#242424',
  surfaceBorder: '#2A2A2A',

  // Accent
  accent: '#FF8400',
  accentLight: '#FF9F33',
  accentDim: 'rgba(255, 132, 0, 0.15)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',

  // Score colors
  scoreEpic: '#22C55E',
  scoreGreat: '#4ADE80',
  scoreGood: '#84CC16',
  scoreFair: '#EAB308',
  scorePoor: '#F97316',
  scoreFlat: '#6B7280',

  // Status
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',

  // Nortada warning
  nortadaBg: 'rgba(249, 115, 22, 0.15)',
  nortadaText: '#F97316',
} as const;

export type ColorName = keyof typeof colors;
