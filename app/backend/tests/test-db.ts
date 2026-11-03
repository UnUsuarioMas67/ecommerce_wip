import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Tests truncate every table between cases, so they must never run against the
// database the app uses. `vitest.config.ts` loads `.env.test`; this module
// refuses to run when DATABASE_URL is missing or matches `.env.development`.
export function getTestDatabaseUrl(): string {
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      'DATABASE_URL is not set. Point it at the dedicated test database in app/backend/.env.test (see .env.example); tests truncate all tables.',
    );
  }

  const devUrl = readDevelopmentDatabaseUrl();
  if (devUrl && isSameDatabase(testUrl, devUrl)) {
    throw new Error(
      'DATABASE_URL in .env.test points at the same database as .env.development. Refusing to run tests that truncate every table.',
    );
  }

  return testUrl;
}

function readDevelopmentDatabaseUrl(): string | undefined {
  try {
    return parseEnv(
      readFileSync(new URL('../.env.development', import.meta.url), 'utf8'),
    ).DATABASE_URL;
  } catch {
    return undefined;
  }
}

// Supabase projects share a pooler host per region; the project ref lives in the
// username (`postgres.<ref>`), so host + database alone is not enough.
function isSameDatabase(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return (
      left.host === right.host &&
      left.username === right.username &&
      left.pathname === right.pathname
    );
  } catch {
    return a === b;
  }
}
