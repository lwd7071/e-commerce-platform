import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Load the shared root .env before collecting integration tests.
import './src/platform/config/load-root-env.ts';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    // Remote PostgreSQL integration files use isolated schemas, but share the
    // project's bounded Supabase session budget. Run files serially so one
    // suite cannot drop/reset fixtures while another is still establishing its schema.
    maxWorkers: 1,
    include: [
      'tests/db/**/*.test.ts',
      'tests/modules/catalog/**/*.test.ts',
      'tests/modules/flash-sale-security.test.ts',
      'tests/modules/seller-phase2-security.test.ts',
      'tests/modules/seller-phase2-suite.test.ts',
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
