import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { getTestDatabaseUrl } from './test-db.js';

export default async function globalSetup(): Promise<void> {
  const databaseUrl = getTestDatabaseUrl();
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end();
    throw new Error(
      `Could not connect to the test database (${new URL(databaseUrl).host}). Check DATABASE_URL in .env.test, the database password, and whether a free Supabase project is paused.`,
      { cause: error },
    );
  }

  // Hosted test databases cannot be created on demand (Supabase allows a single
  // database per project), so the schema is applied idempotently instead.
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  });
  await pool.end();
}
