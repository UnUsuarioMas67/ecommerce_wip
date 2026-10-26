import { defineConfig } from 'vitest/config';

import { getTestDatabaseUrl } from './tests/test-db.js';

export default defineConfig({
  test: {
    env: {
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