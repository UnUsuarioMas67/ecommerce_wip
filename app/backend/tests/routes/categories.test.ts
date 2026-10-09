import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { CategorySchema } from '@ecommerce/schemas';

import app from '../../src/app.js';
import {
  ValidationErrorResponseSchema,
  authHeader,
  createAdmin,
  createCategory,
  createUser,
} from '../helpers.js';

const CategoryResponseSchema = z.object({ category: CategorySchema });
const CategoryListResponseSchema = z.object({ categories: z.array(CategorySchema) });
const ErrorSchema = z.object({ error: z.string() });

const validCategoryBody = () => ({
  name: 'Peripherals',
  slug: `peripherals-${randomUUID().slice(0, 8)}`,
});

describe('GET /categories', () => {
  it('should return 200 with an empty list', async () => {
    const response = await request(app).get('/categories');

    expect(response.statusCode).toBe(200);
    expect(() => CategoryListResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.categories).toEqual([]);
  });

  it('should return 200 with every category', async () => {
    await createCategory();
    await createCategory();

    const response = await request(app).get('/categories');

    expect(response.statusCode).toBe(200);
    expect(() => CategoryListResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.categories).toHaveLength(2);
  });
});

describe('GET /categories/:id', () => {
  it('should return 200 with the category', async () => {
    const category = await createCategory();

    const response = await request(app).get(`/categories/${category.id}`);

    expect(response.statusCode).toBe(200);
    expect(() => CategoryResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.category.id).toBe(category.id);
  });

  it('should return 404 when the category does not exist', async () => {
    const response = await request(app).get(`/categories/${randomUUID()}`);

    expect(response.statusCode).toBe(404);
    expect(() => ErrorSchema.parse(response.body)).not.toThrow();
  });

  it('should return 400 when the id is not a uuid', async () => {
    const response = await request(app).get('/categories/not-a-uuid');

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /categories', () => {
  it('should return 401 without authentication', async () => {
    const response = await request(app).post('/categories').send(validCategoryBody());

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 for a non-admin user', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/categories')
      .set('Authorization', await authHeader(user))
      .send(validCategoryBody());

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should return 400 when the slug is invalid', async () => {
    const admin = await createAdmin();

    const response = await request(app)
      .post('/categories')
      .set('Authorization', await authHeader(admin))
      .send({ name: 'Invalid slug', slug: 'Not A Slug' });

    expect(response.statusCode).toBe(400);
    expect(() => ValidationErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('should return 201 and default parentId to null', async () => {
    const admin = await createAdmin();
    const body = validCategoryBody();

    const response = await request(app)
      .post('/categories')
      .set('Authorization', await authHeader(admin))
      .send(body);

    expect(response.statusCode).toBe(201);
    expect(() => CategoryResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.category.parentId).toBeNull();
    expect(response.body.category.slug).toBe(body.slug);
  });

  it('should return 201 with a parent category', async () => {
    const admin = await createAdmin();
    const parent = await createCategory();

    const response = await request(app)
      .post('/categories')
      .set('Authorization', await authHeader(admin))
      .send({ ...validCategoryBody(), parentId: parent.id });

    expect(response.statusCode).toBe(201);
    expect(response.body.category.parentId).toBe(parent.id);
  });
});

describe('PATCH /categories/:id', () => {
  it('should return 401 without authentication', async () => {
    const category = await createCategory();

    const response = await request(app).patch(`/categories/${category.id}`).send({ name: 'New' });

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 for a non-admin user', async () => {
    const user = await createUser();
    const category = await createCategory();

    const response = await request(app)
      .patch(`/categories/${category.id}`)
      .set('Authorization', await authHeader(user))
      .send({ name: 'New' });

    expect(response.statusCode).toBe(403);
  });

  it('should return 400 when the id is not a uuid', async () => {
    const admin = await createAdmin();

    const response = await request(app)
      .patch('/categories/not-a-uuid')
      .set('Authorization', await authHeader(admin))
      .send({ name: 'New' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when the body has no fields', async () => {
    const admin = await createAdmin();
    const category = await createCategory();

    const response = await request(app)
      .patch(`/categories/${category.id}`)
      .set('Authorization', await authHeader(admin))
      .send({});

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the category does not exist', async () => {
    const admin = await createAdmin();

    const response = await request(app)
      .patch(`/categories/${randomUUID()}`)
      .set('Authorization', await authHeader(admin))
      .send({ name: 'New' });

    expect(response.statusCode).toBe(404);
  });

  it('should return 200 and only update the provided fields', async () => {
    const admin = await createAdmin();
    const original = await createCategory({
      name: 'Original',
      lastUpdated: dayjs().subtract(1, 'hour').toISOString(),
    });

    const response = await request(app)
      .patch(`/categories/${original.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ name: 'Updated' });

    expect(response.statusCode).toBe(200);
    expect(() => CategoryResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.category.name).toBe('Updated');
    expect(response.body.category.slug).toBe(original.slug);
    expect(response.body.category.parentId).toBe(original.parentId);
    expect(new Date(response.body.category.lastUpdated).getTime()).toBeGreaterThan(
      new Date(original.lastUpdated).getTime(),
    );
  });

  it('should return 200 and clear the parent when parentId is null', async () => {
    const admin = await createAdmin();
    const parent = await createCategory();
    const child = await createCategory({ parentId: parent.id });

    const response = await request(app)
      .patch(`/categories/${child.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ parentId: null });

    expect(response.statusCode).toBe(200);
    expect(response.body.category.parentId).toBeNull();
  });

  it('should return 400 when an unknown field is provided', async () => {
    const admin = await createAdmin();
    const category = await createCategory();

    const response = await request(app)
      .patch(`/categories/${category.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ name: 'Updated', id: randomUUID() });

    expect(response.statusCode).toBe(400);
  });
});
