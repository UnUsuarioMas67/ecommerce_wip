process.loadEnvFile('.env');

import z from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
});

const env = EnvSchema.parse(process.env);
export default env;
