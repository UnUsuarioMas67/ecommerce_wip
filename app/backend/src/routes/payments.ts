import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { CreateCheckoutSessionSchema } from '@ecommerce/schemas';
import validate from 'express-zod-safe';

import { db } from '../db/index.js';
import { mapOrder, mapOrderItem } from '../db/mappers.js';
import { orderItems, orders } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { ownsResource } from '../lib/ownership.js';
import { constructWebhookEvent, createOrderCheckoutSession } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';

export const paymentsRouter = Router();

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) {
    console.warn(`[stripe] session ${session.id} has no order reference`);
    return;
  }

  const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (orderRow === undefined) {
    console.warn(`[stripe] session ${session.id} references unknown order ${orderId}`);
    return;
  }
  if (orderRow.status !== 'pending') {
    return;
  }
  if (session.payment_status !== 'paid') {
    console.warn(`[stripe] session ${session.id} completed with payment_status=${session.payment_status}`);
    return;
  }
  if (session.amount_total !== orderRow.totalCents) {
    console.error(
      `[stripe] amount mismatch for order ${orderId}: expected ${orderRow.totalCents}, got ${session.amount_total}`,
    );
    return;
  }
  
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await db
    .update(orders)
    .set({
      status: 'paid',
      paymentRef: paymentIntentId ?? session.id,
      stripePaymentIntentId: paymentIntentId,
      paidAt: new Date(),
      lastUpdated: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));
}

paymentsRouter.post(
  '/checkout-sessions',
  requireAuth,
  validate({ body: CreateCheckoutSessionSchema }),
  async (req, res, next) => {
    try {
      const [orderRow] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, req.body.orderId))
        .limit(1);
      if (orderRow === undefined || !ownsResource(req.auth, orderRow.userId)) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      const order = mapOrder(orderRow);
      if (order.status !== 'pending') {
        res.status(409).json({ error: 'Order is not awaiting payment' });
        return;
      }

      const itemRows = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(orderItems.createdAt);
      const session = await createOrderCheckoutSession(order, itemRows.map(mapOrderItem));
      if (!session.url) {
        throw new HttpError(502, 'Stripe did not return a checkout URL');
      }

      await db
        .update(orders)
        .set({ stripeCheckoutSessionId: session.id, lastUpdated: new Date() })
        .where(eq(orders.id, order.id));

      res.status(201).json({ sessionId: session.id, url: session.url });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  },
);

paymentsRouter.post('/webhook', async (req, res, next) => {
  let event: Stripe.Event;
  try {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'Invalid Stripe webhook request' });
      return;
    }
    event = constructWebhookEvent(req.body, signature);
  } catch {
    res.status(400).json({ error: 'Invalid Stripe webhook signature' });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});
