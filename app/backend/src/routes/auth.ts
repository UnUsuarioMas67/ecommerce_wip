import { Router } from 'express';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import validate from 'express-zod-safe';

import {
  CreateUserSchema,
  LoginSchema,
  RefreshTokenSchema,
} from '@ecommerce/schemas';

import { db } from '../db/index.js';
import { mapUser } from '../db/mappers.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  toPublicUser,
} from '../services/auth.js';

export const authRouter = Router();

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later', code: 'RATE_LIMITED' },
});

authRouter.post(
  '/register',
  credentialsLimiter,
  validate({ body: CreateUserSchema }),
  async (req, res) => {
    const { user, tokens } = await registerUser(req.body, req.get('user-agent'));
    res.status(201).json({ user, ...tokens });
  },
);

authRouter.post(
  '/login',
  credentialsLimiter,
  validate({ body: LoginSchema }),
  async (req, res) => {
    const { user, tokens } = await loginUser(req.body, req.get('user-agent'));
    res.json({ user, ...tokens });
  },
);

authRouter.post(
  '/refresh',
  validate({ body: RefreshTokenSchema }),
  async (req, res) => {
    const tokens = await refreshSession(req.body.refreshToken, req.get('user-agent'));
    res.json(tokens);
  },
);

authRouter.post('/logout', validate({ body: RefreshTokenSchema }), async (req, res, next) => {
  try {
    await logoutSession(req.body.refreshToken);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.auth.userId))
      .limit(1);
    const user = row === undefined ? undefined : mapUser(row);
    if (user === undefined) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});
