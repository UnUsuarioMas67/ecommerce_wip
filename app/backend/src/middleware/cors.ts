import type { CorsOptions } from 'cors';
import cors from 'cors';

import env from '../config/env.js';

// Any localhost port is allowed outside production because Vite falls back to
// 5174/5175 when 5173 is taken.
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowedOrigins = new Set(env.CORS_ORIGINS);

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) {
    return true;
  }
  return env.NODE_ENV !== 'production' && LOCALHOST_ORIGIN.test(origin);
}

const options: CorsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (Stripe webhooks, curl) are not CORS.
    if (origin === undefined || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    // Deny by omitting the headers instead of throwing: the response is still
    // valid, and the browser is the one that blocks the caller.
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Auth is a bearer token stored in localStorage, not a cookie.
  credentials: false,
  maxAge: 600,
};

export const corsMiddleware = cors(options);
