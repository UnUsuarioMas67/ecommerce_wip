import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import validate from 'express-zod-safe';

import {
  CreateUserSchema,
  LoginSchema,
  RefreshTokenSchema,
} from '@ecommerce/schemas';

import { requireAuth } from '../middleware/auth.js';
import {
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  toPublicUser,
} from '../services/auth.js';
import { store } from '../store.js';

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

authRouter.post('/logout', validate({ body: RefreshTokenSchema }), (req, res) => {
  logoutSession(req.body.refreshToken);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = store.users.get(req.auth.userId);
  if (user === undefined) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: toPublicUser(user) });
});
