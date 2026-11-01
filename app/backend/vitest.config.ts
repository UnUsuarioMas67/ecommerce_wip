import { defineConfig } from 'vitest/config';

import { getTestDatabaseUrl } from './tests/test-db.js';

// Tests use the same variable names as the app, but load `.env.test` so the
// suite can never pick up the development database by accident.
try {
  process.loadEnvFile(new URL('./.env.test', import.meta.url));
} catch {
  // A CI job may inject DATABASE_URL directly instead of shipping .env.test;
  // getTestDatabaseUrl() below still refuses to run without one.
}
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: getTestDatabaseUrl(),
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret',
      SUPABASE_PRODUCT_IMAGES_BUCKET: 'product-images',
    },
    globalSetup: './tests/global-setup.ts',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
  },
});
