import { randomBytes } from 'node:crypto';
import { z } from 'zod';

// `NODE_ENV` selects the file: `.env.development` by default, `.env.test` under
// Vitest, `.env.production` in production. This module runs from `src/config/`
// in dev and from `dist/src/config/` after a build, so the depth to
// `app/backend/` is not fixed. Walk up until the file is found instead of
// hard-coding a relative path (a wrong path left DATABASE_URL undefined and
// fell back to a password-less localhost URL).
const NODE_ENV = z
  .enum(['development', 'production', 'test'])
  .default('development')
  .parse(process.env.NODE_ENV);

function loadBackendEnv(): void {
  const fileName = `.env.${NODE_ENV}`;
  let directory = new URL('.', import.meta.url);
  for (let depth = 0; depth < 5; depth += 1) {
    try {
      process.loadEnvFile(new URL(fileName, directory));
      break;
    } catch {
      directory = new URL('../', directory);
    }
  }

  process.env.NODE_ENV = NODE_ENV;
}

loadBackendEnv();

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgresql://postgres@localhost:5432/ecommerce'),
    // Supabase session poolers cap client connections per project, so the pool
    // size is configurable instead of hard-coded.
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    JWT_SECRET: z.string().min(32).optional(),
    ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_CURRENCY: z.string().length(3).default('usd'),
    STRIPE_SUCCESS_URL: z.url().default('http://localhost:3000/checkout/success'),
    STRIPE_CANCEL_URL: z.url().default('http://localhost:3000/checkout/cancel'),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    SUPABASE_PRODUCT_IMAGES_BUCKET: z.string().min(1).default('product-images'),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV !== 'production') return;
    const missing = (
      [
        'DATABASE_URL',
        'JWT_SECRET',
        'ADMIN_EMAIL',
        'ADMIN_PASSWORD',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'SUPABASE_URL',
        'SUPABASE_SECRET_KEY',
      ] as const
    ).filter((key) => !values[key]);
    for (const key of missing) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required when NODE_ENV=production`,
      });
    }
  });

const parsed = EnvSchema.parse(process.env);

if (!parsed.JWT_SECRET) {
  console.warn(
    '[env] JWT_SECRET is not set; generated an ephemeral secret. Access tokens will not survive a restart.',
  );
}

const env = {
  ...parsed,
  JWT_SECRET: parsed.JWT_SECRET ?? randomBytes(32).toString('hex'),
  ADMIN_EMAIL: parsed.ADMIN_EMAIL ?? 'admin@ecommerce.test',
  ADMIN_PASSWORD: parsed.ADMIN_PASSWORD ?? 'ChangeMe1234!',
};

export default env;
