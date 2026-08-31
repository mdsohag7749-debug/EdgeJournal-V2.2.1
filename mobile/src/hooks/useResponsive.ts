// Responsive dimensions hook for mobile viewports (small Android, iPhones, larger phones)

import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isSmallDevice = width < 375;
  const isTablet = width >= 768;
  const isLandscape = width > height;

  return {
    width,
    height,
    isSmallDevice,
    isTablet,
    isLandscape,
    contentPadding: isSmallDevice ? 12 : 16,
  };
}
