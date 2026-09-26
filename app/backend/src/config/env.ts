import { z } from 'zod';

try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
});

const env = EnvSchema.parse(process.env);
export default env;
