import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../../src/app.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

describe('CORS', () => {
  it('should answer a preflight from an allowed origin', async () => {
    const response = await request(app)
      .options('/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toMatch(/authorization/i);
    expect(response.headers['access-control-max-age']).toBe('600');
    expect(response.headers.vary).toContain('Origin');
  });

  it('should allow any localhost port outside production', async () => {
    const origin = 'http://localhost:5199';

    const response = await request(app).options('/health').set('Origin', origin);

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('should add the allow-origin header to normal requests', async () => {
    const response = await request(app).get('/health').set('Origin', ALLOWED_ORIGIN);

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('should omit CORS headers for a disallowed origin', async () => {
    const response = await request(app).get('/health').set('Origin', 'http://evil.example');

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should not add CORS headers when the request has no origin', async () => {
    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
