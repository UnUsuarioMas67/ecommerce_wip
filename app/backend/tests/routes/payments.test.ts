import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type Stripe from 'stripe';

vi.mock('../../src/lib/stripe.js', () => ({
  createOrderCheckoutSession: vi.fn(),
  constructWebhookEvent: vi.fn(),
}));

import app from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { orders } from '../../src/db/schema.js';
import { constructWebhookEvent, createOrderCheckoutSession } from '../../src/lib/stripe.js';
import {
  ValidationErrorResponseSchema,
  addressSnapshot,
  authHeader,
  createOrder,
  createOrderItem,
  createProduct,
  createUser,
} from '../helpers.js';

const mockedCreateSession = vi.mocked(createOrderCheckoutSession);
const mockedConstructEvent = vi.mocked(constructWebhookEvent);

function checkoutSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    ...overrides,
  } as Stripe.Checkout.Session;
}

function completedEvent(
  orderId: string,
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Event {
  return {
    id: 'evt_test_123',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        object: 'checkout.session',
        client_reference_id: orderId,
        metadata: { orderId },
        payment_status: 'paid',
        amount_total: 7000,
        payment_intent: 'pi_test_123',
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

function sendWebhook(event: Stripe.Event, signature = 'sig_test') {
  return request(app)
    .post('/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', signature)
    .send(Buffer.from(JSON.stringify(event)));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /payments/checkout-sessions', () => {
  it('should return 401 without authentication', async () => {
    const user = await createUser();
    const order = await createOrder(user.id);

    const response = await request(app)
      .post('/payments/checkout-sessions')
      .send({ orderId: order.id });

    expect(response.statusCode).toBe(401);
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it('should return 400 when the body is invalid', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/payments/checkout-sessions')
      .set('Authorization', await authHeader(user))
      .send({ orderId: 'not-a-uuid' });

    expect(response.statusCode).toBe(400);
    expect(() => ValidationErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('should return 404 when the order does not exist', async () => {
    const user = await createUser();

    const response = await request(app)
      .post('/payments/checkout-sessions')
      .set('Authorization', await authHeader(user))
      .send({ orderId: randomUUID() });

    expect(response.statusCode).toBe(404);
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it("should return 404 when the order belongs to another user", async () => {
    const user = await createUser();
    const other = await createUser();
    const order = await createOrder(other.id);

    const response = await request(app)
      .post('/payments/checkout-sessions')
      .set('Authorization', await authHeader(user))
      .send({ orderId: order.id });

    expect(response.statusCode).toBe(404);
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it('should return 409 when the order is not awaiting payment', async () => {
    const user = await createUser();
    const order = await createOrder(user.id, { status: 'paid' });

    const response = await request(app)
      .post('/payments/checkout-sessions')
      .set('Authorization', await authHeader(user))
      .send({ orderId: order.id });

    expect(response.statusCode).toBe(409);
    expect(mockedCreateSession).not.toHaveBeenCalled();
  });

  it('should return 201 with the session url and persist the session id', async () => {
    const user = await createUser();
    const product = await createProduct({ name: 'Widget', priceCents: 2000 });
    const order = await createOrder(user.id, { subtotalCents: 2000, totalCents: 2000 });
    await createOrderItem(order.id, product.id, { name: 'Widget', quantity: 1 });
    mockedCreateSession.mockResolvedValue(checkoutSession());

    const response = await request(app)
      .post('/payments/checkout-sessions')
      .set('Authorization', await authHeader(user))
      .send({ orderId: order.id });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    expect(mockedCreateSession).toHaveBeenCalledTimes(1);

    const [stored] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    expect(stored.stripeCheckoutSessionId).toBe('cs_test_123');
  });
});

describe('POST /payments/webhook', () => {
  it('should return 400 when the signature header is missing', async () => {
    const event = completedEvent(randomUUID());

    const response = await request(app)
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(event)));

    expect(response.statusCode).toBe(400);
    expect(mockedConstructEvent).not.toHaveBeenCalled();
  });

  it('should return 400 when the signature is invalid', async () => {
    const event = completedEvent(randomUUID());
    mockedConstructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const response = await sendWebhook(event);

    expect(response.statusCode).toBe(400);
  });

  it('should mark the order paid on checkout.session.completed', async () => {
    const user = await createUser();
    const order = await createOrder(user.id, { totalCents: 7000 });
    const event = completedEvent(order.id);
    mockedConstructEvent.mockReturnValue(event);

    const response = await sendWebhook(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ received: true });

    const [stored] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    expect(stored.status).toBe('paid');
    expect(stored.paymentRef).toBe('pi_test_123');
    expect(stored.stripePaymentIntentId).toBe('pi_test_123');
    expect(stored.paidAt).not.toBeNull();
  });

  it('should be idempotent when the same event is delivered twice', async () => {
    const user = await createUser();
    const order = await createOrder(user.id, { totalCents: 7000 });
    const event = completedEvent(order.id);
    mockedConstructEvent.mockReturnValue(event);

    await sendWebhook(event);
    const [first] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    const second = await sendWebhook(event);

    expect(second.statusCode).toBe(200);
    const [stored] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    expect(stored.status).toBe('paid');
    expect(stored.lastUpdated.toISOString()).toBe(first.lastUpdated.toISOString());
  });

  it('should not mark the order paid when the amount does not match', async () => {
    const user = await createUser();
    const order = await createOrder(user.id, { totalCents: 7000 });
    const event = completedEvent(order.id, { amount_total: 100 });
    mockedConstructEvent.mockReturnValue(event);

    const response = await sendWebhook(event);

    expect(response.statusCode).toBe(200);
    const [stored] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    expect(stored.status).toBe('pending');
  });

  it('should not mark the order paid when payment_status is not paid', async () => {
    const user = await createUser();
    const order = await createOrder(user.id, { totalCents: 7000 });
    const event = completedEvent(order.id, { payment_status: 'unpaid' });
    mockedConstructEvent.mockReturnValue(event);

    const response = await sendWebhook(event);

    expect(response.statusCode).toBe(200);
    const [stored] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    expect(stored.status).toBe('pending');
  });

  it('should ignore unrelated event types', async () => {
    const user = await createUser();
    const order = await createOrder(user.id, { totalCents: 7000 });
    const event = { ...completedEvent(order.id), type: 'payment_intent.created' } as Stripe.Event;
    mockedConstructEvent.mockReturnValue(event);

    const response = await sendWebhook(event);

    expect(response.statusCode).toBe(200);
    const [stored] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    expect(stored.status).toBe('pending');
  });
});
