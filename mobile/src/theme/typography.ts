// Typography tokens for React Native

import { TextStyle } from 'react-native';

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  display: 36,
};

export const FONT_WEIGHTS: Record<string, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const LINE_HEIGHTS = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};
