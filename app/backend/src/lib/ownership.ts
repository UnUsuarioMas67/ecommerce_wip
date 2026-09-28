import type { UserId, UserRole } from '@ecommerce/schemas';

export interface AuthPrincipal {
  userId: UserId;
  role: UserRole;
  tokenVersion: number;
}

export function ownsResource(auth: AuthPrincipal, ownerId: UserId): boolean {
  return auth.role === 'admin' || auth.userId === ownerId;
}
