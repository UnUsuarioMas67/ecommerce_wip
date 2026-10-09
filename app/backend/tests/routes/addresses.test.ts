import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { AddressSchema } from '@ecommerce/schemas';

import app from '../../src/app.js';
import {
  ValidationErrorResponseSchema,
  authHeader,
  createAddress,
  createAdmin,
  createUser,
} from '../helpers.js';

const AddressResponseSchema = z.object({ address: AddressSchema });
const AddressListResponseSchema = z.object({ addresses: z.array(AddressSchema) });
const ErrorSchema = z.object({ error: z.string() });

const validAddressBody = () => ({
  label: 'Home',
  recipient: 'Jane Doe',
  line1: '1 Main St',
  city: 'Springfield',
  region: 'IL',
  postalCode: '62704',
  country: 'US',
});

describe('GET /addresses', () => {
  it('should return 401 without authentication', async () => {
    const response = await request(app).get('/addresses');

    expect(response.statusCode).toBe(401);
  });

  it('should return 200 with an empty list', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/addresses')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(200);
    expect(() => AddressListResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.addresses).toEqual([]);
  });

  it('should only return the addresses owned by the caller', async () => {
    const user = await createUser();
    const other = await createUser();
    await createAddress(user.id);
    await createAddress(user.id);
    await createAddress(other.id);

    const response = await request(app)
      .get('/addresses')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(200);
    expect(response.body.addresses).toHaveLength(2);
    for (const address of response.body.addresses) {
      expect(address.userId).toBe(user.id);
    }
  });
});

describe('GET /addresses/:id', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const address = await createAddress(user.id);

    const response = await request(app).get(`/addresses/${address.id}`);

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the id is not a uuid', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/addresses/not-a-uuid')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the address does not exist', async () => {
    const user = await createUser();

    const response = await request(app)
      .get(`/addresses/${randomUUID()}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
    expect(() => ErrorSchema.parse(response.body)).not.toThrow();
  });

  it("should return 404 when the address belongs to another user", async () => {
    const user = await createUser();
    const other = await createUser();
    const address = await createAddress(other.id);

    const response = await request(app)
      .get(`/addresses/${address.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
  });

  it('should return 200 for the owner', async () => {
    const user = await createUser();
    const address = await createAddress(user.id);

    const response = await request(app)
      .get(`/addresses/${address.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(200);
    expect(() => AddressResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.address.id).toBe(address.id);
  });

  it("should return 200 for an admin reading another user's address", async () => {
    const admin = await createAdmin();
    const other = await createUser();
    const address = await createAddress(other.id);

    const response = await request(app)
      .get(`/addresses/${address.id}`)
      .set('Authorization', await authHeader(admin));

    expect(response.statusCode).toBe(200);
    expect(response.body.address.id).toBe(address.id);
  });
});

describe('POST /addresses', () => {
  it('should return 401 without authentication', async () => {
    const response = await request(app).post('/addresses').send(validAddressBody());

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the body is invalid', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/addresses')
      .set('Authorization', await authHeader(user))
      .send({ ...validAddressBody(), country: 'USA' });

    expect(response.statusCode).toBe(400);
    expect(() => ValidationErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('should return 201 and apply defaults derived from the schema', async () => {
    const user = await createUser();
    const { label, ...body } = validAddressBody();

    const response = await request(app)
      .post('/addresses')
      .set('Authorization', await authHeader(user))
      .send(body);

    expect(response.statusCode).toBe(201);
    expect(() => AddressResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.address.label).toBe('Default');
    expect(response.body.address.isDefault).toBe(false);
    expect(response.body.address.userId).toBe(user.id);
  });

  it('should return 201 and ignore a spoofed userId (rejected as unknown field)', async () => {
    const user = await createUser();
    const other = await createUser();

    const response = await request(app)
      .post('/addresses')
      .set('Authorization', await authHeader(user))
      .send({ ...validAddressBody(), userId: other.id });

    expect(response.statusCode).toBe(400);
  });
});

describe('PATCH /addresses/:id', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const address = await createAddress(user.id);

    const response = await request(app)
      .patch(`/addresses/${address.id}`)
      .send({ city: 'New City' });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the id is not a uuid', async () => {
    const user = await createUser();

    const response = await request(app)
      .patch('/addresses/not-a-uuid')
      .set('Authorization', await authHeader(user))
      .send({ city: 'New City' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when the body has no fields', async () => {
    const user = await createUser();
    const address = await createAddress(user.id);

    const response = await request(app)
      .patch(`/addresses/${address.id}`)
      .set('Authorization', await authHeader(user))
      .send({});

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the address does not exist', async () => {
    const user = await createUser();

    const response = await request(app)
      .patch(`/addresses/${randomUUID()}`)
      .set('Authorization', await authHeader(user))
      .send({ city: 'New City' });

    expect(response.statusCode).toBe(404);
  });

  it("should return 404 when the address belongs to another user", async () => {
    const user = await createUser();
    const other = await createUser();
    const address = await createAddress(other.id);

    const response = await request(app)
      .patch(`/addresses/${address.id}`)
      .set('Authorization', await authHeader(user))
      .send({ city: 'New City' });

    expect(response.statusCode).toBe(404);
  });

  it('should return 200 and update the address for the owner', async () => {
    const user = await createUser();
    const address = await createAddress(user.id, {
      lastUpdated: dayjs().subtract(1, 'hour').toISOString(),
    });

    const response = await request(app)
      .patch(`/addresses/${address.id}`)
      .set('Authorization', await authHeader(user))
      .send({ city: 'New City', isDefault: true });

    expect(response.statusCode).toBe(200);
    expect(() => AddressResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.address.city).toBe('New City');
    expect(response.body.address.isDefault).toBe(true);
    expect(response.body.address.userId).toBe(user.id);
    expect(new Date(response.body.address.lastUpdated).getTime()).toBeGreaterThan(
      new Date(address.lastUpdated).getTime(),
    );
  });

  it("should return 200 when an admin updates another user's address", async () => {
    const admin = await createAdmin();
    const other = await createUser();
    const address = await createAddress(other.id);

    const response = await request(app)
      .patch(`/addresses/${address.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ city: 'Admin City' });

    expect(response.statusCode).toBe(200);
    expect(response.body.address.city).toBe('Admin City');
    expect(response.body.address.userId).toBe(other.id);
  });
});
