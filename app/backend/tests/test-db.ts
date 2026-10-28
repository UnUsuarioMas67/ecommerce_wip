// Tests truncate every table between cases, so they must never run against the
// database the app uses. They point at a dedicated database instead: a second
// Supabase project (or a local Postgres when working offline).
export function getTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Point it at the dedicated test database (see .env.example); tests truncate all tables and will not fall back to DATABASE_URL.',
    );
  }

  const devUrl = process.env.DATABASE_URL;
  if (devUrl && isSameDatabase(testUrl, devUrl)) {
    throw new Error(
      'TEST_DATABASE_URL points at the same database as DATABASE_URL. Refusing to run tests that truncate every table.',
    );
  }

  return testUrl;
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
