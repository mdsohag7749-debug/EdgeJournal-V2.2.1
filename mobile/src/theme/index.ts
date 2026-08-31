// Main Theme Interface & Factory

import { THEME_PRESETS, ACCENT_PRESETS, SEMANTIC_COLORS, ThemeColors, AccentColor } from './colors';
import { FONT_SIZES, FONT_WEIGHTS, LINE_HEIGHTS } from './typography';
import { SPACING } from './spacing';
import { RADII } from './radii';
import { SHADOWS } from './shadows';

export interface Theme {
  colors: ThemeColors & {
    accent: string;
    accentStrong: string;
    accentGlow: string;
    accentDim: string;
    semantic: typeof SEMANTIC_COLORS;
  };
  typography: {
    sizes: typeof FONT_SIZES;
    weights: typeof FONT_WEIGHTS;
    lineHeights: typeof LINE_HEIGHTS;
  };
  spacing: typeof SPACING;
  radii: typeof RADII;
  shadows: typeof SHADOWS;
  isDark: boolean;
}

export function buildTheme(themeId: string = 'midnight', accentId: string = 'crimson'): Theme {
  const themeColors = THEME_PRESETS[themeId] || THEME_PRESETS.midnight;
  const accent = ACCENT_PRESETS[accentId] || ACCENT_PRESETS.crimson;

  return {
    colors: {
      ...themeColors,
      accent: accent.color,
      accentStrong: accent.strong,
      accentGlow: accent.glow,
      accentDim: accent.dim,
      semantic: SEMANTIC_COLORS,
    },
    typography: {
      sizes: FONT_SIZES,
      weights: FONT_WEIGHTS,
      lineHeights: LINE_HEIGHTS,
    },
    spacing: SPACING,
    radii: RADII,
    shadows: SHADOWS,
    isDark: themeId !== 'arctic',
  };
}

export const defaultTheme = buildTheme('midnight', 'crimson');

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radii';
export * from './shadows';
