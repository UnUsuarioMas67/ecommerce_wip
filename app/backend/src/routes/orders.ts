import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CreateOrderSchema,
  OrderIdSchema,
  type Order,
  type OrderItem,
} from '@ecommerce/schemas';
import { ownsResource } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { store, nowIso } from '../store.js';
import validate from 'express-zod-safe';

export const ordersRouter = Router();

ordersRouter.get(
  '/:id',
  requireAuth,
  validate({ params: { id: OrderIdSchema } }),
  (req, res) => {
    const order = store.orders.get(req.params.id);
    if (!order || !ownsResource(req.auth, order.userId)) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const items = [...store.orderItems.values()].filter((item) => item.orderId === order.id);
    res.json({ order, items });
  },
);

ordersRouter.post(
  '/',
  requireAuth,
  validate({ body: CreateOrderSchema }),
  (req, res) => {
    const cart = store.carts.get(req.body.cartId);
    if (!cart || !ownsResource(req.auth, cart.userId)) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }
    if (cart.status !== 'active') {
      res.status(409).json({ error: 'Cart is already checked out' });
      return;
    }

    const cartItems = [...store.cartItems.values()].filter((item) => item.cartId === cart.id);
    if (cartItems.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    for (const item of cartItems) {
      if (!store.products.has(item.productId)) {
        res.status(409).json({ error: `Product ${item.productId} no longer exists` });
        return;
      }
    }

    const orderId = randomUUID();
    const subtotalCents = cartItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
    const totalCents = subtotalCents + req.body.taxCents + req.body.shippingCents;
    const now = nowIso();

    const order: Order = {
      id: orderId,
      ...req.body,
      userId: req.auth.userId,
      status: 'pending',
      subtotalCents,
      totalCents,
      createdAt: now,
      lastUpdated: now,
    };

    const items: OrderItem[] = cartItems.map((item) => ({
      id: randomUUID(),
      orderId,
      productId: item.productId,
      name: store.products.get(item.productId)?.name ?? 'Unknown product',
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      createdAt: now,
    }));

    store.orders.set(order.id, order);
    for (const item of items) {
      store.orderItems.set(item.id, item);
    }
    store.carts.set(cart.id, { ...cart, status: 'checkedOut', lastUpdated: now });

    res.status(201).json({ order, items });
  },
);
