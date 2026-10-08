import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile(new URL('./.env', import.meta.url));
} catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/ecommerce',
  },
});