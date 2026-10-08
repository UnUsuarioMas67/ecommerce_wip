import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { PasswordSchema, type User } from '@ecommerce/schemas';

import env from './config/env.js';
import { db } from './db/index.js';
import { mapUser } from './db/mappers.js';
import { users } from './db/schema.js';
import { hashPassword } from './lib/password.js';
import { nowIso } from './lib/time.js';

let seedPromise: Promise<User> | undefined;

async function createAdminUser(): Promise<User> {
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;

  if (env.NODE_ENV !== 'production' && password === 'ChangeMe1234!') {
    console.warn(
      '[seed] using the default ADMIN_PASSWORD; set ADMIN_EMAIL/ADMIN_PASSWORD before deploying',
    );
  }

  const parsed = PasswordSchema.safeParse(password);
  if (!parsed.success) {
    throw new Error(
      `ADMIN_PASSWORD does not satisfy the password policy: ${parsed.error.issues[0]?.message}`,
    );
  }

  const now = nowIso();
  const [row] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      firstName: 'Bootstrap',
      lastName: 'Admin',
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
      phoneNumber: '+15550100000',
      birthDate: '1990-01-01',
      createdAt: new Date(now),
      lastUpdated: new Date(now),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash: sql`excluded.password_hash`,
        role: sql`excluded.role`,
        isActive: true,
        lastUpdated: sql`excluded.last_updated`,
      },
    })
    .returning();
  return mapUser(row);
}

export function seedAdminUser(): Promise<User> {
  seedPromise ??= createAdminUser();
  return seedPromise;
}