import { fileURLToPath } from 'node:url';
import { Client, Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { getTestDatabaseUrl } from './test-db.js';

export default async function globalSetup(): Promise<void> {
  const url = new URL(getTestDatabaseUrl());
  const databaseName = url.pathname.slice(1);
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    databaseName,
  ]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  }
  await admin.end();

  const pool = new Pool({ connectionString: getTestDatabaseUrl() });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  await pool.end();
}