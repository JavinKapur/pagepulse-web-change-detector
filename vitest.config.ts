import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts', 'apps/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@pagepulse/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@pagepulse/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@pagepulse/db': path.resolve(__dirname, './packages/db/src/index.ts'),
      '@pagepulse/browser': path.resolve(__dirname, './packages/browser/src/index.ts'),
      '@pagepulse/notifications': path.resolve(__dirname, './packages/notifications/src/index.ts'),
      '@pagepulse/worker': path.resolve(__dirname, './apps/worker/src/index.ts'),
    },
  },
});
