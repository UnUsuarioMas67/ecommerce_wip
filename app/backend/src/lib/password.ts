import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import env from '../config/env.js';

const ALGORITHM = 'scrypt';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

function maxmemFor(N: number, r: number): number {
  return Math.max(64 * 1024 * 1024, 256 * N * r);
}

function defaultParams(): ScryptParams {
  if (env.NODE_ENV === 'test') {
    return { N: 16384, r: 8, p: 1 };
  }
  return { N: 32768, r: 8, p: 3 };
}

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: params.N,
        r: params.r,
        p: params.p,
        maxmem: maxmemFor(params.N, params.r),
      },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const params = defaultParams();
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, params);
  return [
    ALGORITHM,
    params.N,
    params.r,
    params.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    return false;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) {
    return false;
  }
  if (N <= 1 || r <= 0 || p <= 0 || N > MAX_N || r > MAX_R || p > MAX_P) {
    return false;
  }

  const expected = Buffer.from(parts[5], 'base64');
  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = await derive(password, Buffer.from(parts[4], 'base64'), { N, r, p });
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
