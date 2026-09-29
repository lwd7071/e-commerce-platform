import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Load the shared root .env before collecting integration tests.
import './src/platform/config/load-root-env.ts';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    // Supabase session mode is capped at 15 clients. Some concurrency suites
    // intentionally lease 5-6 connections, so only two test files may run in
    // parallel without turning healthy tests into EMAXCONNSESSION failures.
    maxWorkers: 2,
    include: [
      'tests/db/**/*.test.ts',
      'tests/modules/catalog/**/*.test.ts',
    ],
    exclude: [
      'test/**',
      'tests/modules/buyer/**',
      '**/node_modules/**',
      'dist/**',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
      '@contracts': fileURLToPath(new URL('./src/contracts', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
    },
  },
});
