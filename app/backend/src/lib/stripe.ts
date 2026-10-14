import Stripe from 'stripe';

import type { Order, OrderItem } from '@ecommerce/schemas';

import env from '../config/env.js';

const STRIPE_API_VERSION = '2026-09-30.endive';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return client;
}

export function buildLineItems(
  items: Pick<OrderItem, 'name' | 'quantity' | 'unitPriceCents'>[],
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items
    .filter((item) => item.unitPriceCents > 0)
    .map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: env.STRIPE_CURRENCY,
        unit_amount: item.unitPriceCents,
        product_data: { name: item.name },
      },
    }));
}

export async function createOrderCheckoutSession(
  order: Order,
  items: OrderItem[],
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      client_reference_id: order.id,
      metadata: { orderId: order.id },
      line_items: buildLineItems(items),
      success_url: `${env.STRIPE_SUCCESS_URL}?orderId=${order.id}`,
      cancel_url: `${env.STRIPE_CANCEL_URL}?orderId=${order.id}`,
    },
    { idempotencyKey: `order-${order.id}-checkout` },
  );
}

export function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return getStripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
}
