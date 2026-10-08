import { defineConfig } from 'vitest/config';

import { getTestDatabaseUrl } from './tests/test-db.js';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: getTestDatabaseUrl(),
    },
    globalSetup: './tests/global-setup.ts',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
  },
});