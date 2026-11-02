import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { CartItemSchema, CartSchema } from '@ecommerce/schemas';

import app from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { cartItems, carts } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import {
  ValidationErrorResponseSchema,
  authHeader,
  createAdmin,
  createCart,
  createCartItem,
  createProduct,
  createUser,
} from '../helpers.js';

const CartResponseSchema = z.object({ cart: CartSchema });
const CartWithItemsSchema = z.object({ cart: CartSchema, items: z.array(CartItemSchema) });
const CartItemsResponseSchema = z.object({ items: z.array(CartItemSchema) });
const CartItemResponseSchema = z.object({ item: CartItemSchema });
const ErrorSchema = z.object({ error: z.string() });

describe('POST /carts', () => {
  it('should return 401 without authentication', async () => {
    const response = await request(app).post('/carts').send({});

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the body has unknown fields', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/carts')
      .set('Authorization', await authHeader(user))
      .send({ userId: randomUUID() });

    expect(response.statusCode).toBe(400);
  });

  it('should return 201 and create an active cart owned by the caller', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/carts')
      .set('Authorization', await authHeader(user))
      .send({});

    expect(response.statusCode).toBe(201);
    expect(() => CartResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.cart.userId).toBe(user.id);
    expect(response.body.cart.status).toBe('active');
  });
});

describe('GET /carts/:id', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);

    const response = await request(app).get(`/carts/${cart.id}`);

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the id is not a uuid', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/carts/not-a-uuid')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the cart does not exist', async () => {
    const user = await createUser();

    const response = await request(app)
      .get(`/carts/${randomUUID()}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
    expect(() => ErrorSchema.parse(response.body)).not.toThrow();
  });

  it("should return 404 when the cart belongs to another user", async () => {
    const user = await createUser();
    const other = await createUser();
    const cart = await createCart(other.id);

    const response = await request(app)
      .get(`/carts/${cart.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
  });

  it('should return 200 with the cart and its items', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct({ priceCents: 1500 });
    await createCartItem(cart.id, product.id, { quantity: 2, unitPriceCents: 1500 });

    const response = await request(app)
      .get(`/carts/${cart.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(200);
    expect(() => CartWithItemsSchema.parse(response.body)).not.toThrow();
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].quantity).toBe(2);
  });

  it("should return 200 when an admin reads another user's cart", async () => {
    const admin = await createAdmin();
    const other = await createUser();
    const cart = await createCart(other.id);

    const response = await request(app)
      .get(`/carts/${cart.id}`)
      .set('Authorization', await authHeader(admin));

    expect(response.statusCode).toBe(200);
    expect(response.body.cart.id).toBe(cart.id);
  });
});

describe('GET /carts/:id/items', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);

    const response = await request(app).get(`/carts/${cart.id}/items`);

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the id is not a uuid', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/carts/not-a-uuid/items')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the cart does not exist', async () => {
    const user = await createUser();

    const response = await request(app)
      .get(`/carts/${randomUUID()}/items`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
  });

  it('should return 200 with the cart items', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    await createCartItem(cart.id, product.id);

    const response = await request(app)
      .get(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(200);
    expect(() => CartItemsResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.items).toHaveLength(1);
  });
});

describe('POST /carts/:id/items', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();

    const response = await request(app)
      .post(`/carts/${cart.id}/items`)
      .send({ productId: product.id, quantity: 1 });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the body is invalid', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);

    const response = await request(app)
      .post(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: randomUUID(), quantity: 0 });

    expect(response.statusCode).toBe(400);
    expect(() => ValidationErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('should return 404 when the cart does not exist', async () => {
    const user = await createUser();
    const product = await createProduct();

    const response = await request(app)
      .post(`/carts/${randomUUID()}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: product.id, quantity: 1 });

    expect(response.statusCode).toBe(404);
  });

  it("should return 404 when the cart belongs to another user", async () => {
    const user = await createUser();
    const other = await createUser();
    const cart = await createCart(other.id);
    const product = await createProduct();

    const response = await request(app)
      .post(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: product.id, quantity: 1 });

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 when the product does not exist', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);

    const response = await request(app)
      .post(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: randomUUID(), quantity: 1 });

    expect(response.statusCode).toBe(404);
  });

  it('should return 409 when the cart is already checked out', async () => {
    const user = await createUser();
    const cart = await createCart(user.id, { status: 'checkedOut' });
    const product = await createProduct();

    const response = await request(app)
      .post(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: product.id, quantity: 1 });

    expect(response.statusCode).toBe(409);
  });

  it('should return 201 and snapshot the product price for a new item', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct({ priceCents: 2599 });

    const response = await request(app)
      .post(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: product.id, quantity: 3 });

    expect(response.statusCode).toBe(201);
    expect(() => CartItemResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.item.productId).toBe(product.id);
    expect(response.body.item.quantity).toBe(3);
    expect(response.body.item.unitPriceCents).toBe(2599);
  });

  it('should return 200 and increment the quantity of an existing item', async () => {
    const user = await createUser();
    const cart = await createCart(user.id, {
      lastUpdated: dayjs().subtract(1, 'hour').toISOString(),
    });
    const product = await createProduct({ priceCents: 2599 });

    await request(app)
      .post(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: product.id, quantity: 2 });

    const response = await request(app)
      .post(`/carts/${cart.id}/items`)
      .set('Authorization', await authHeader(user))
      .send({ productId: product.id, quantity: 5 });

    expect(response.statusCode).toBe(200);
    expect(response.body.item.quantity).toBe(7);

    const [updatedCart] = await db.select().from(carts).where(eq(carts.id, cart.id)).limit(1);
    expect(updatedCart.lastUpdated.getTime()).toBeGreaterThan(new Date(cart.lastUpdated).getTime());
  });
});

describe('PATCH /carts/:id/items/:itemId', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(cart.id, product.id);

    const response = await request(app)
      .patch(`/carts/${cart.id}/items/${item.id}`)
      .send({ quantity: 5 });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the body has no fields', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(cart.id, product.id);

    const response = await request(app)
      .patch(`/carts/${cart.id}/items/${item.id}`)
      .set('Authorization', await authHeader(user))
      .send({});

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when the ids are not uuids', async () => {
    const user = await createUser();

    const response = await request(app)
      .patch('/carts/not-a-uuid/items/also-not-a-uuid')
      .set('Authorization', await authHeader(user))
      .send({ quantity: 5 });

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the cart does not exist', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(cart.id, product.id);

    const response = await request(app)
      .patch(`/carts/${randomUUID()}/items/${item.id}`)
      .set('Authorization', await authHeader(user))
      .send({ quantity: 5 });

    expect(response.statusCode).toBe(404);
  });

  it("should return 404 when the item belongs to another user's cart", async () => {
    const user = await createUser();
    const other = await createUser();
    const otherCart = await createCart(other.id);
    const product = await createProduct();
    const item = await createCartItem(otherCart.id, product.id);

    const response = await request(app)
      .patch(`/carts/${otherCart.id}/items/${item.id}`)
      .set('Authorization', await authHeader(user))
      .send({ quantity: 5 });

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 when the item belongs to a different cart', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const otherCart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(otherCart.id, product.id);

    const response = await request(app)
      .patch(`/carts/${cart.id}/items/${item.id}`)
      .set('Authorization', await authHeader(user))
      .send({ quantity: 5 });

    expect(response.statusCode).toBe(404);
  });

  it('should return 200 and update the quantity', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(cart.id, product.id, { quantity: 1 });

    const response = await request(app)
      .patch(`/carts/${cart.id}/items/${item.id}`)
      .set('Authorization', await authHeader(user))
      .send({ quantity: 9 });

    expect(response.statusCode).toBe(200);
    expect(() => CartItemResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.item.quantity).toBe(9);
  });
});

describe('DELETE /carts/:id/items/:itemId', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(cart.id, product.id);

    const response = await request(app).delete(`/carts/${cart.id}/items/${item.id}`);

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the ids are not uuids', async () => {
    const user = await createUser();

    const response = await request(app)
      .delete('/carts/not-a-uuid/items/also-not-a-uuid')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the cart does not exist', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(cart.id, product.id);

    const response = await request(app)
      .delete(`/carts/${randomUUID()}/items/${item.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 when the item belongs to a different cart', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const otherCart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(otherCart.id, product.id);

    const response = await request(app)
      .delete(`/carts/${cart.id}/items/${item.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
  });

  it('should return 204 and delete the item', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    const item = await createCartItem(cart.id, product.id);

    const response = await request(app)
      .delete(`/carts/${cart.id}/items/${item.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(204);

    const rows = await db.select().from(cartItems).where(eq(cartItems.id, item.id));
    expect(rows).toHaveLength(0);
  });
});
