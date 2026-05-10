import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@cowry/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10_000,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/services/**',
        'src/middleware/**',
        'src/controllers/**',
        'src/models/**',
      ],
      exclude: ['src/__tests__/**', 'src/config/**'],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
