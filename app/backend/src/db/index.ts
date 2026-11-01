import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import env from '../config/env.js';
import * as schema from './schema.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

export function closeDb(): Promise<void> {
  return pool.end();
}
