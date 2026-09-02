import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['shared/**/*.test.ts', 'src/**/*.test.ts', 'electron/**/*.test.ts'],
  },
});
