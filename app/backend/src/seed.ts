import { randomUUID } from 'node:crypto';

import { PasswordSchema, type User } from '@ecommerce/schemas';

import env from './config/env.js';
import { hashPassword } from './lib/password.js';
import { nowIso, store } from './store.js';

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
  const user: User = {
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
    createdAt: now,
    lastUpdated: now,
  };

  store.users.set(user.id, user);
  store.usersByEmail.set(user.email, user.id);
  return user;
}

export function seedAdminUser(): Promise<User> {
  seedPromise ??= createAdminUser();
  return seedPromise;
}
