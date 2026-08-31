import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': path.resolve(__dirname, '__mocks__/asyncStorage.ts'),
      'react-native-svg': path.resolve(__dirname, '__mocks__/reactNativeSvg.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'mobile/__tests__/**/*.test.ts'],
  },
});
