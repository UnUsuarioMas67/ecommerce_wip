import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { OrderItemSchema, OrderSchema } from '@ecommerce/schemas';

import app from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { carts, products } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import {
  ValidationErrorResponseSchema,
  addressSnapshot,
  authHeader,
  createAdmin,
  createCart,
  createCartItem,
  createOrder,
  createOrderItem,
  createProduct,
  createUser,
} from '../helpers.js';

const OrderWithItemsSchema = z.object({
  order: OrderSchema,
  items: z.array(OrderItemSchema),
});
const ErrorSchema = z.object({ error: z.string() });

describe('GET /orders/:id', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const order = await createOrder(user.id);

    const response = await request(app).get(`/orders/${order.id}`);

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the id is not a uuid', async () => {
    const user = await createUser();

    const response = await request(app)
      .get('/orders/not-a-uuid')
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when the order does not exist', async () => {
    const user = await createUser();

    const response = await request(app)
      .get(`/orders/${randomUUID()}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
    expect(() => ErrorSchema.parse(response.body)).not.toThrow();
  });

  it("should return 404 when the order belongs to another user", async () => {
    const user = await createUser();
    const other = await createUser();
    const order = await createOrder(other.id);

    const response = await request(app)
      .get(`/orders/${order.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(404);
  });

  it('should return 200 with the order and its items', async () => {
    const user = await createUser();
    const product = await createProduct({ name: 'Widget' });
    const order = await createOrder(user.id, { subtotalCents: 1000 });
    await createOrderItem(order.id, product.id, { name: 'Widget', quantity: 1 });

    const response = await request(app)
      .get(`/orders/${order.id}`)
      .set('Authorization', await authHeader(user));

    expect(response.statusCode).toBe(200);
    expect(() => OrderWithItemsSchema.parse(response.body)).not.toThrow();
    expect(response.body.order.id).toBe(order.id);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe('Widget');
  });

  it("should return 200 when an admin reads another user's order", async () => {
    const admin = await createAdmin();
    const other = await createUser();
    const order = await createOrder(other.id);

    const response = await request(app)
      .get(`/orders/${order.id}`)
      .set('Authorization', await authHeader(admin));

    expect(response.statusCode).toBe(200);
    expect(response.body.order.id).toBe(order.id);
  });
});

describe('POST /orders', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);

    const response = await request(app)
      .post('/orders')
      .send({
        cartId: cart.id,
        shippingAddress: addressSnapshot,
      });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when the body is invalid', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/orders')
      .set('Authorization', await authHeader(user))
      .send({ cartId: randomUUID() });

    expect(response.statusCode).toBe(400);
    expect(() => ValidationErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('should return 404 when the cart does not exist', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/orders')
      .set('Authorization', await authHeader(user))
      .send({
        cartId: randomUUID(),
        shippingAddress: addressSnapshot,
      });

    expect(response.statusCode).toBe(404);
  });

  it("should return 404 when the cart belongs to another user", async () => {
    const user = await createUser();
    const other = await createUser();
    const cart = await createCart(other.id);
    const product = await createProduct();
    await createCartItem(cart.id, product.id);

    const response = await request(app)
      .post('/orders')
      .set('Authorization', await authHeader(user))
      .send({
        cartId: cart.id,
        shippingAddress: addressSnapshot,
      });

    expect(response.statusCode).toBe(404);
  });

  it('should return 409 when the cart is already checked out', async () => {
    const user = await createUser();
    const cart = await createCart(user.id, { status: 'checkedOut' });
    const product = await createProduct();
    await createCartItem(cart.id, product.id);

    const response = await request(app)
      .post('/orders')
      .set('Authorization', await authHeader(user))
      .send({
        cartId: cart.id,
        shippingAddress: addressSnapshot,
      });

    expect(response.statusCode).toBe(409);
  });

  it('should return 400 when the cart is empty', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);

    const response = await request(app)
      .post('/orders')
      .set('Authorization', await authHeader(user))
      .send({
        cartId: cart.id,
        shippingAddress: addressSnapshot,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Cart is empty');
  });

  it('should return 409 when a cart item references a product that no longer exists', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    await createCartItem(cart.id, product.id);
    await db.delete(products).where(eq(products.id, product.id));

    const response = await request(app)
      .post('/orders')
      .set('Authorization', await authHeader(user))
      .send({
        cartId: cart.id,
        shippingAddress: addressSnapshot,
      });

    expect(response.statusCode).toBe(409);
  });

  it('should return 201, compute the subtotal and check out the cart', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const first = await createProduct({ name: 'First', priceCents: 2000 });
    const second = await createProduct({ name: 'Second', priceCents: 1500 });
    await createCartItem(cart.id, first.id, { quantity: 2, unitPriceCents: 2000 });
    await createCartItem(cart.id, second.id, { quantity: 1, unitPriceCents: 1500 });

    const response = await request(app)
      .post('/orders')
      .set('Authorization', await authHeader(user))
      .send({
        cartId: cart.id,
        shippingAddress: addressSnapshot,
      });

    expect(response.statusCode).toBe(201);
    expect(() => OrderWithItemsSchema.parse(response.body)).not.toThrow();

    expect(response.body.order.userId).toBe(user.id);
    expect(response.body.order.status).toBe('pending');
    expect(response.body.order.subtotalCents).toBe(5500);
    expect(response.body.order.paymentRef).toBeUndefined();
    expect(response.body.items).toHaveLength(2);
    for (const item of response.body.items) {
      expect(item.orderId).toBe(response.body.order.id);
      expect(item.unitPriceCents).toBe(
        item.productId === first.id ? 2000 : 1500,
      );
      expect(item.name).toBe(item.productId === first.id ? 'First' : 'Second');
    }

    const [storedCart] = await db.select().from(carts).where(eq(carts.id, cart.id)).limit(1);
    expect(storedCart.status).toBe('checkedOut');
  });
});
