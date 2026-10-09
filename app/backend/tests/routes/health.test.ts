import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';

import app from '../../src/app.js';

const HealthResponseSchema = z.object({ status: z.literal('ok') });

describe('GET /health', () => {
  it('should return 200 with the health schema', async () => {
    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(200);
    expect(() => HealthResponseSchema.parse(response.body)).not.toThrow();
  });
});
