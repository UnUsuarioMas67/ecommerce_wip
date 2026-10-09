import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import app from '../../src/app.js';
import {
  DEFAULT_BIRTH_DATE,
  DEFAULT_PASSWORD,
  DEFAULT_PHONE_NUMBER,
} from '../helpers.js';

function validRegisterBody() {
  return {
    firstName: 'Rate',
    lastName: 'Limited',
    email: `rate-${randomUUID()}@example.com`,
    password: DEFAULT_PASSWORD,
    confirmPassword: DEFAULT_PASSWORD,
    phoneNumber: DEFAULT_PHONE_NUMBER,
    birthDate: DEFAULT_BIRTH_DATE,
  };
}

describe('auth credentials rate limiting', () => {
  it('should return 401 for the first 10 login attempts and 429 afterwards', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });
      expect(response.statusCode).toBe(401);
    }

    const blocked = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('should share the limiter with the register endpoint', async () => {
    const blocked = await request(app).post('/auth/register').send(validRegisterBody());

    expect(blocked.statusCode).toBe(429);
  });
});
