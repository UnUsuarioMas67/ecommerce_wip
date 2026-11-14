import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import env from '../config/env.js';
import * as schema from './schema.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: 10_000,
  // Serverless hosts freeze idle function instances without closing their
  // sockets, so a warm instance can end up holding connections the Supabase
  // pooler has already dropped. Reaping idle clients quickly frees those
  // pooler slots and makes the instance reconnect instead of reusing a stale
  // socket. With the transaction pooler (`max: 1`) this is a single client.
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

export function closeDb(): Promise<void> {
  return pool.end();
}
