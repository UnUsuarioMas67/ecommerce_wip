import { randomBytes } from 'node:crypto';
import { z } from 'zod';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {}

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgresql://postgres@localhost:5432/ecommerce'),
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
