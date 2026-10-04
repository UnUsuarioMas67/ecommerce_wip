import { describe, expect, it } from 'vitest';
import { ownsResource, type AuthPrincipal } from '../../src/lib/ownership.js';
import { randomUUID } from 'node:crypto';

describe('ownsResource function', () => {
  it('should return true if userId matches ownerId', () => {
    const id = randomUUID();

    const auth: AuthPrincipal = {
      userId: id,
      role: 'client',
      tokenVersion: 0,
    };

    expect(ownsResource(auth, id)).toBe(true);
  });

  it('should return false if userId does not match ownerID', () => {
    const ownerId = randomUUID();

    const auth: AuthPrincipal = {
      userId: randomUUID(),
      role: 'client',
      tokenVersion: 0,
    };

    expect(ownsResource(auth, ownerId)).toBe(false);
  });

  it('should not care about id match if the user has the "admin" role', () => {
    const ownerId = randomUUID();

    const auth: AuthPrincipal = {
      userId: randomUUID(),
      role: 'admin',
      tokenVersion: 0,
    };

    expect(ownsResource(auth, ownerId)).toBe(true);
  });
});
