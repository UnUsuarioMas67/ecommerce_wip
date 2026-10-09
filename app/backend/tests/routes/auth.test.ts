import { beforeEach, describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import app from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { refreshTokens, users } from '../../src/db/schema.js';
import {
  AuthResponseSchema,
  PublicUserSchema,
  TokenResponseSchema,
  type User,
} from '@ecommerce/schemas';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { z } from 'zod';
import { hashPassword } from '../../src/lib/password.js';
import { generateRefreshToken } from '../../src/lib/tokens.js';
import { loginUser } from '../../src/services/auth.js';
import {
  DEFAULT_BIRTH_DATE,
  DEFAULT_PASSWORD,
  DEFAULT_PHONE_NUMBER,
  ValidationErrorResponseSchema,
  authHeader,
  createUser,
} from '../helpers.js';

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

const MeResponseSchema = z.object({ user: PublicUserSchema });
const AuthErrorSchema = z.object({ error: z.string(), code: z.string() });

function validRegisterBody(email = `new-${randomUUID()}@example.com`) {
  return {
    firstName: 'New',
    lastName: 'User',
    email,
    password: DEFAULT_PASSWORD,
    confirmPassword: DEFAULT_PASSWORD,
    phoneNumber: DEFAULT_PHONE_NUMBER,
    birthDate: DEFAULT_BIRTH_DATE,
  };
}

async function tokensFor(user: User) {
  const { tokens } = await loginUser({ email: user.email, password: DEFAULT_PASSWORD });
  return tokens;
}

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

describe('POST /auth/register', () => {
  it('should return 201 with the auth schema and create an active client', async () => {
    const body = validRegisterBody();

    const response = await request(app).post('/auth/register').send(body);

    expect(response.statusCode).toBe(201);
    expect(() => AuthResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.user.role).toBe('client');
    expect(response.body.user.isActive).toBe(true);
    expect(response.body.user.email).toBe(body.email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('user.tokenVersion');

    const [row] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    expect(row).toBeDefined();
    expect(row.role).toBe('client');
    expect(row.isActive).toBe(true);
  });

  it('should return 400 when the passwords do not match', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validRegisterBody(), confirmPassword: 'Different123!' });

    expect(response.statusCode).toBe(400);
    expect(() => ValidationErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('should return 400 when the password is weak', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validRegisterBody(), password: 'weak', confirmPassword: 'weak' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when an unknown field is provided', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validRegisterBody(), role: 'admin' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 409 when the email is already registered', async () => {
    const existing = await createUser();

    const response = await request(app)
      .post('/auth/register')
      .send(validRegisterBody(existing.email));

    expect(response.statusCode).toBe(409);
    expect(() => AuthErrorSchema.parse(response.body)).not.toThrow();
    expect(response.body.code).toBe('EMAIL_TAKEN');
  });
});

describe('POST /auth/refresh', () => {
  it('should return 200 with new tokens and rotate (single-use) the old token', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });

    expect(response.statusCode).toBe(200);
    expect(() => TokenResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.refreshToken).not.toBe(tokens.refreshToken);
    expect(response.body.tokenType).toBe('Bearer');

    const reused = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });

    expect(reused.statusCode).toBe(401);
    expect(reused.body.code).toBe('REFRESH_TOKEN_REUSED');

    const revokedFamily = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: response.body.refreshToken });

    expect(revokedFamily.statusCode).toBe(401);
  });

  it('should return 400 when the body is invalid', async () => {
    const response = await request(app).post('/auth/refresh').send({});

    expect(response.statusCode).toBe(400);
  });

  it('should return 401 when the refresh token is unknown', async () => {
    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: randomUUID() + randomUUID() });

    expect(response.statusCode).toBe(401);
    expect(() => AuthErrorSchema.parse(response.body)).not.toThrow();
    expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('should return 401 when the refresh token has expired', async () => {
    const user = await createUser();
    const { raw, hash } = generateRefreshToken();

    await db.insert(refreshTokens).values({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hash,
      familyId: randomUUID(),
      expiresAt: dayjs().subtract(1, 'day').toDate(),
      revokedAt: null,
      replacedById: null,
      userAgent: null,
      createdAt: new Date(),
    });

    const response = await request(app).post('/auth/refresh').send({ refreshToken: raw });

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('should return 401 when the owning user is inactive', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  it('should return 204 and revoke the refresh token', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);

    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: tokens.refreshToken });

    expect(response.statusCode).toBe(204);
    expect(response.body).toEqual({});

    const refresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });

    expect(refresh.statusCode).toBe(401);
  });

  it('should return 204 when the refresh token is unknown (idempotent)', async () => {
    const response = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: randomUUID() + randomUUID() });

    expect(response.statusCode).toBe(204);
  });

  it('should return 400 when the body is invalid', async () => {
    const response = await request(app).post('/auth/logout').send({ refreshToken: 'short' });

    expect(response.statusCode).toBe(400);
  });
});

describe('GET /auth/me', () => {
  it('should return 200 with the public user schema', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(200);
    expect(() => MeResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.user.id).toBe(user.id);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('tokenVersion');
  });

  it('should return 401 without an authorization header', async () => {
    const response = await request(app).get('/auth/me');

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });

  it('should return 401 with an invalid token', async () => {
    const response = await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-token');

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('INVALID_TOKEN');
  });

  it('should return 401 when the token has been revoked', async () => {
    const user = await createUser();
    const header = await authHeader(user);
    await db.update(users).set({ tokenVersion: user.tokenVersion + 1 }).where(eq(users.id, user.id));

    const response = await request(app).get('/auth/me').set('Authorization', header);

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('REVOKED_TOKEN');
  });

  it('should return 401 when the user no longer exists', async () => {
    const user = await createUser();
    const header = await authHeader(user);
    await db.delete(users).where(eq(users.id, user.id));

    const response = await request(app).get('/auth/me').set('Authorization', header);

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('INVALID_TOKEN');
  });
});
