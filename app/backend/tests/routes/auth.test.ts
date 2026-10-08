import { beforeEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import app from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { PublicUserSchema, TokenResponseSchema, type User } from '@ecommerce/schemas';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { hashPassword } from '../../src/lib/password.js';
import z from 'zod';

const seedUserPassword = 'password';
const seedUser: User = {
  id: randomUUID(),
  firstName: 'José',
  lastName: 'Pruebas',
  email: 'josep123@email.com',
  passwordHash: await hashPassword(seedUserPassword),
  role: 'client',
  isActive: true,
  tokenVersion: 0,
  phoneNumber: '+15550100000',
  birthDate: '1990-01-01',
  createdAt: dayjs().toISOString(),
  lastUpdated: dayjs().toISOString(),
};

beforeEach(async () => {
  await db.insert(users).values({
    id: seedUser.id,
    firstName: seedUser.firstName,
    lastName: seedUser.lastName,
    email: seedUser.email,
    passwordHash: seedUser.passwordHash,
    role: seedUser.role,
    isActive: seedUser.isActive,
    tokenVersion: seedUser.tokenVersion,
    phoneNumber: seedUser.phoneNumber,
    birthDate: seedUser.birthDate,
    createdAt: new Date(seedUser.createdAt),
    lastUpdated: new Date(seedUser.lastUpdated),
  });
});

describe('/auth/login', () => {
  it('should return 200, with the correct schema', async () => {
    const response = await request(app).post('/auth/login').send({
      email: seedUser.email,
      password: seedUserPassword,
    });

    const responseSchema = z.object({
      user: PublicUserSchema,
      ...TokenResponseSchema.shape,
    });

    expect(response.statusCode).toBe(200);
    expect(() => {
      responseSchema.parse(response.body);
    }).not.toThrow();
  });

  it('should return 401 if email or password are incorrect', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'incorrect@wrong.com',
      password: '13245',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 if account is inactive', async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.id, seedUser.id));

    const response = await request(app).post('/auth/login').send({
      email: seedUser.email,
      password: seedUserPassword,
    });
    expect(response.statusCode).toBe(403);
  });

  it('should return 400 if body schema is invalid', async () => {
    const response = await request(app).post('/auth/login').send({
      password: seedUserPassword,
    });

    expect(response.statusCode).toBe(400);
  });
});
