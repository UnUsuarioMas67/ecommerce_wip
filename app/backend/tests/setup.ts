import { afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';

import { closeDb, db } from '../src/db/index.js';

export async function truncateAll(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      users,
      categories,
      products,
      cart_items,
      carts,
      addresses,
      order_items,
      orders,
      refresh_tokens
    RESTART IDENTITY CASCADE
  `);
}

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});