import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

import {
  AccessTokenClaimsSchema,
  type AccessTokenClaims,
  type User,
} from '@ecommerce/schemas';
import env from '../config/env.js';

const ISSUER = 'ecommerce-api';
const AUDIENCE = 'ecommerce-clients';
const ALGORITHM = 'HS256';
const FALLBACK_LIFETIME_SECONDS = 900;

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    return FALLBACK_LIFETIME_SECONDS;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return amount * multiplier;
}

export function accessTokenLifetimeSeconds(): number {
  return parseDurationSeconds(env.ACCESS_TOKEN_TTL);
}

export async function signAccessToken(user: User): Promise<string> {
  return new SignJWT({ role: user.role, typ: 'access', ver: user.tokenVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  return AccessTokenClaimsSchema.parse({
    ...payload,
    aud: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
  });
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashRefreshToken(raw) };
}
