import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile(new URL('./.env', import.meta.url));
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and point it at the Supabase session pooler.',
  );
}

// drizzle-kit talks to whichever database DATABASE_URL points at, so make the
// target obvious in migration output (host + database only, never the password).
const target = new URL(url);
console.log(`[drizzle] target: ${target.host}${target.pathname}`);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url,
  },
});
