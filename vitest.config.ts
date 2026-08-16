import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Tests live in `tests/`, not beside the source.
 *
 * The tree under `tests/unit` mirrors `src/`, so a file's tests are where you
 * would guess. Keeping them out of `src/` means the production build, the
 * bundle analyser and every `src/**` glob see application code only.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Presentational components are covered by the E2E suite, not here.
      exclude: ['src/app/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html'],
    },
  },
});
