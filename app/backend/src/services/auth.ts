import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import dayjs from 'dayjs';

import type {
  CreateUserInput,
  LoginInput,
  PublicUser,
  TokenResponse,
  User,
  UserId,
} from '@ecommerce/schemas';

import env from '../config/env.js';
import { db } from '../db/index.js';
import { mapRefreshToken, mapUser } from '../db/mappers.js';
import { refreshTokens, users, type RefreshTokenRecord } from '../db/schema.js';
import { AuthError, pgErrorCode } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { nowIso } from '../lib/time.js';
import {
  accessTokenLifetimeSeconds,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../lib/tokens.js';

const INVALID_CREDENTIALS = 'Invalid email or password';
const UNIQUE_VIOLATION = '23505';

let dummyHash: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomUUID());
  return dummyHash;
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _hash, tokenVersion: _version, ...rest } = user;
  return rest;
}

async function createRefreshRecord(
  userId: UserId,
  familyId: string,
  userAgent: string | null,
): Promise<{ record: RefreshTokenRecord; raw: string }> {
  const { raw, hash } = generateRefreshToken();
  const [row] = await db
    .insert(refreshTokens)
    .values({
      id: randomUUID(),
      userId,
      tokenHash: hash,
      familyId,
      expiresAt: new Date(dayjs().add(env.REFRESH_TOKEN_TTL_DAYS, 'day').toISOString()),
      revokedAt: null,
      replacedById: null,
      userAgent,
      createdAt: new Date(nowIso()),
    })
    .returning();
  return { record: mapRefreshToken(row), raw };
}

async function issueTokens(
  user: User,
  userAgent: string | null,
  familyId: string = randomUUID(),
): Promise<{ tokens: TokenResponse; record: RefreshTokenRecord }> {
  const accessToken = await signAccessToken(user);
  const { record, raw } = await createRefreshRecord(user.id, familyId, userAgent);
  return {
    record,
    tokens: {
      accessToken,
      refreshToken: raw,
      tokenType: 'Bearer',
      expiresIn: accessTokenLifetimeSeconds(),
    },
  };
}

function revokeFamily(familyId: string): Promise<void> {
  return db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
    .then(() => undefined);
}

export async function registerUser(
  input: CreateUserInput,
  userAgent: string | null = null,
): Promise<{ user: PublicUser; tokens: TokenResponse }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing.length > 0) {
    throw new AuthError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }

  const now = nowIso();
  let user: User;
  try {
    const [row] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'client',
        isActive: true,
        tokenVersion: 0,
        phoneNumber: input.phoneNumber,
        birthDate: input.birthDate,
        createdAt: new Date(now),
        lastUpdated: new Date(now),
      })
      .returning();
    user = mapUser(row);
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
      throw new AuthError(409, 'EMAIL_TAKEN', 'Email is already registered');
    }
    throw error;
  }

  const { tokens } = await issueTokens(user, userAgent);
  return { user: toPublicUser(user), tokens };
}

export async function loginUser(
  input: LoginInput,
  userAgent: string | null = null,
): Promise<{ user: PublicUser; tokens: TokenResponse }> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  const user = row === undefined ? undefined : mapUser(row);

  if (user === undefined) {
    await verifyPassword(input.password, await getDummyHash());
    throw new AuthError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new AuthError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  }

  const { tokens } = await issueTokens(user, userAgent);
  return { user: toPublicUser(user), tokens };
}

export async function refreshSession(
  raw: string,
  userAgent: string | null = null,
): Promise<TokenResponse> {
  const [current] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(raw)))
    .limit(1);

  if (current === undefined) {
    throw new AuthError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const record = mapRefreshToken(current);

  if (record.revokedAt !== null) {
    await revokeFamily(record.familyId);
    throw new AuthError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token has already been used');
  }

  if (dayjs(record.expiresAt).isBefore(dayjs())) {
    throw new AuthError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
  }

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, current.userId))
    .limit(1);
  const user = userRow === undefined ? undefined : mapUser(userRow);
  if (user === undefined || !user.isActive) {
    throw new AuthError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const { tokens, record: replacement } = await issueTokens(user, userAgent, record.familyId);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedById: replacement.id })
    .where(eq(refreshTokens.id, current.id));
  return tokens;
}

export function logoutSession(raw: string): Promise<void> {
  return db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hashRefreshToken(raw)), isNull(refreshTokens.revokedAt)))
    .then(() => undefined);
}