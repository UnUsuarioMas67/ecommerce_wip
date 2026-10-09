import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { ProductSchema } from '@ecommerce/schemas';

import app from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { products } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import {
  ValidationErrorResponseSchema,
  authHeader,
  createAdmin,
  createCategory,
  createProduct,
  createUser,
} from '../helpers.js';

const ProductResponseSchema = z.object({ product: ProductSchema });
const ProductListResponseSchema = z.object({ products: z.array(ProductSchema) });
const ErrorSchema = z.object({ error: z.string() });

const validProductBody = () => ({
  name: 'Keyboard',
  sku: `SKU-${randomUUID()}`,
  description: 'Mechanical keyboard',
  price: 49.99,
  stock: 7,
});

describe('GET /products', () => {
  it('should return 200 with an empty list', async () => {
    const response = await request(app).get('/products');

    expect(response.statusCode).toBe(200);
    expect(() => ProductListResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.products).toEqual([]);
  });

  it('should return 200 with every product', async () => {
    await createProduct();
    await createProduct();

    const response = await request(app).get('/products');

    expect(response.statusCode).toBe(200);
    expect(() => ProductListResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.products).toHaveLength(2);
  });
});

describe('GET /products/:id', () => {
  it('should return 200 with the product', async () => {
    const product = await createProduct();

    const response = await request(app).get(`/products/${product.id}`);

    expect(response.statusCode).toBe(200);
    expect(() => ProductResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.product.id).toBe(product.id);
  });

  it('should return 404 when the product does not exist', async () => {
    const response = await request(app).get(`/products/${randomUUID()}`);

    expect(response.statusCode).toBe(404);
    expect(() => ErrorSchema.parse(response.body)).not.toThrow();
  });

  it('should return 400 when the id is not a uuid', async () => {
    const response = await request(app).get('/products/not-a-uuid');

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /products', () => {
  it('should return 401 without authentication', async () => {
    const response = await request(app).post('/products').send(validProductBody());

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });

  it('should return 403 for a non-admin user', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/products')
      .set('Authorization', await authHeader(user))
      .send(validProductBody());

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should return 400 when the body is invalid', async () => {
    const admin = await createAdmin();

    const response = await request(app)
      .post('/products')
      .set('Authorization', await authHeader(admin))
      .send({ name: 'Missing everything else' });

    expect(response.statusCode).toBe(400);
    expect(() => ValidationErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('should return 201 and create the product for an admin', async () => {
    const admin = await createAdmin();
    const category = await createCategory();
    const body = { ...validProductBody(), categoryId: category.id };

    const response = await request(app)
      .post('/products')
      .set('Authorization', await authHeader(admin))
      .send(body);

    expect(response.statusCode).toBe(201);
    expect(() => ProductResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.product.name).toBe(body.name);
    expect(response.body.product.priceCents).toBe(4999);
    expect(response.body.product.stock).toBe(7);
    expect(response.body.product.categoryId).toBe(category.id);

    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.id, response.body.product.id))
      .limit(1);
    expect(row).toBeDefined();
    expect(row.priceCents).toBe(4999);
  });

  it('should default the stock to 0 when omitted', async () => {
    const admin = await createAdmin();
    const { stock, ...body } = validProductBody();

    const response = await request(app)
      .post('/products')
      .set('Authorization', await authHeader(admin))
      .send(body);

    expect(response.statusCode).toBe(201);
    expect(response.body.product.stock).toBe(0);
  });

  it('should reject a directly supplied priceCents field', async () => {
    const admin = await createAdmin();
    const { price, ...body } = validProductBody();

    const response = await request(app)
      .post('/products')
      .set('Authorization', await authHeader(admin))
      .send({ ...body, priceCents: 1000 });

    expect(response.statusCode).toBe(400);
  });
});
