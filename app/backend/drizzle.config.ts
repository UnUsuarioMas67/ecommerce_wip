import { defineConfig } from 'drizzle-kit';

// Keep this in sync with src/config/env.ts: NODE_ENV selects the env file,
// defaulting to development when it is unset.
const nodeEnv = process.env.NODE_ENV ?? 'development';

try {
  process.loadEnvFile(new URL(`./.env.${nodeEnv}`, import.meta.url));
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    `DATABASE_URL is not set. Copy .env.example to .env.${nodeEnv} and point it at the Supabase session pooler.`,
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
