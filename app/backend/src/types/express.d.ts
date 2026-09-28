import type { Request } from 'express';

import type { AuthPrincipal } from '../lib/ownership.js';

export type AuthenticatedRequest = Request & { auth: AuthPrincipal };

declare module 'express-serve-static-core' {
  interface Request {
    auth: AuthPrincipal;
  }
}
