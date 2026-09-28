import { randomUUID } from 'node:crypto';
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
import { AuthError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  accessTokenLifetimeSeconds,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../lib/tokens.js';
import { nowIso, store, type RefreshTokenRecord } from '../store.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

let dummyHash: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomUUID());
  return dummyHash;
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _hash, tokenVersion: _version, ...rest } = user;
  return rest;
}

function createRefreshRecord(
  userId: UserId,
  familyId: string,
  userAgent: string | null,
): { record: RefreshTokenRecord; raw: string } {
  const { raw, hash } = generateRefreshToken();
  const record: RefreshTokenRecord = {
    id: randomUUID(),
    userId,
    tokenHash: hash,
    familyId,
    expiresAt: dayjs().add(env.REFRESH_TOKEN_TTL_DAYS, 'day').toISOString(),
    revokedAt: null,
    replacedById: null,
    userAgent,
    createdAt: nowIso(),
  };
  store.refreshTokens.set(hash, record);
  return { record, raw };
}

async function issueTokens(
  user: User,
  userAgent: string | null,
  familyId: string = randomUUID(),
): Promise<{ tokens: TokenResponse; record: RefreshTokenRecord }> {
  const accessToken = await signAccessToken(user);
  const { record, raw } = createRefreshRecord(user.id, familyId, userAgent);
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

function revokeFamily(familyId: string): void {
  const now = nowIso();
  for (const record of store.refreshTokens.values()) {
    if (record.familyId === familyId && record.revokedAt === null) {
      record.revokedAt = now;
    }
  }
}

export async function registerUser(
  input: CreateUserInput,
  userAgent: string | null = null,
): Promise<{ user: PublicUser; tokens: TokenResponse }> {
  if (store.usersByEmail.has(input.email)) {
    throw new AuthError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }

  const now = nowIso();
  const user: User = {
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
    createdAt: now,
    lastUpdated: now,
  };

  store.users.set(user.id, user);
  store.usersByEmail.set(user.email, user.id);

  const { tokens } = await issueTokens(user, userAgent);
  return { user: toPublicUser(user), tokens };
}

export async function loginUser(
  input: LoginInput,
  userAgent: string | null = null,
): Promise<{ user: PublicUser; tokens: TokenResponse }> {
  const userId = store.usersByEmail.get(input.email);
  const user = userId === undefined ? undefined : store.users.get(userId);

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
  const current = store.refreshTokens.get(hashRefreshToken(raw));
  if (current === undefined) {
    throw new AuthError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  if (current.revokedAt !== null) {
    revokeFamily(current.familyId);
    throw new AuthError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token has already been used');
  }

  if (dayjs(current.expiresAt).isBefore(dayjs())) {
    throw new AuthError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
  }

  const user = store.users.get(current.userId);
  if (user === undefined || !user.isActive) {
    throw new AuthError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const { tokens, record } = await issueTokens(user, userAgent, current.familyId);
  current.revokedAt = nowIso();
  current.replacedById = record.id;
  return tokens;
}

export function logoutSession(raw: string): void {
  const record = store.refreshTokens.get(hashRefreshToken(raw));
  if (record !== undefined && record.revokedAt === null) {
    record.revokedAt = nowIso();
  }
}
