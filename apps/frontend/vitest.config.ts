import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@cowry/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 10_000,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**', 'components/**', 'app/**'],
      exclude: ['**/__tests__/**', '**/*.test.*', 'app/api/**'],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
