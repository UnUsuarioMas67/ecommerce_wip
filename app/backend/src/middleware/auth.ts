import type { RequestHandler } from 'express';

import type { UserRole } from '@ecommerce/schemas';

import { verifyAccessToken } from '../lib/tokens.js';
import { store } from '../store.js';
import type { AuthenticatedRequest } from '../types/express.js';

function bearerToken(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (token === undefined || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = bearerToken(req.headers.authorization);
  if (token === null) {
    res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    return;
  }

  let userId: string;
  let role: UserRole;
  let tokenVersion: number;
  try {
    const claims = await verifyAccessToken(token);
    const user = store.users.get(claims.sub);
    if (user === undefined || !user.isActive) {
      res.status(401).json({ error: 'Invalid access token', code: 'INVALID_TOKEN' });
      return;
    }
    if (user.tokenVersion !== claims.ver) {
      res.status(401).json({ error: 'Access token has been revoked', code: 'REVOKED_TOKEN' });
      return;
    }
    userId = user.id;
    role = user.role;
    tokenVersion = user.tokenVersion;
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token', code: 'INVALID_TOKEN' });
    return;
  }

  (req as AuthenticatedRequest).auth = { userId, role, tokenVersion };
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
