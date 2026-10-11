import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  CreateOrderSchema,
  OrderIdSchema,
  type Order,
  type OrderItem,
} from '@ecommerce/schemas';
import { db } from '../db/index.js';
import { mapCartItem, mapOrder, mapOrderItem } from '../db/mappers.js';
import { cartItems, carts, orderItems, orders, products } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { ownsResource } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { nowIso } from '../lib/time.js';
import validate from 'express-zod-safe';

export const ordersRouter = Router();

ordersRouter.get(
  '/:id',
  requireAuth,
  validate({ params: { id: OrderIdSchema } }),
  async (req, res, next) => {
    try {
      const [orderRow] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, req.params.id))
        .limit(1);
      const order = orderRow === undefined ? undefined : mapOrder(orderRow);
      if (!order || !ownsResource(req.auth, order.userId)) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const itemRows = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(orderItems.createdAt);
      res.json({ order, items: itemRows.map(mapOrderItem) });
    } catch (error) {
      next(error);
    }
  },
);

ordersRouter.post(
  '/',
  requireAuth,
  validate({ body: CreateOrderSchema }),
  async (req, res, next) => {
    try {
      const result = await db.transaction(async (tx) => {
        const [cart] = await tx
          .select()
          .from(carts)
          .where(eq(carts.id, req.body.cartId))
          .for('update')
          .limit(1);
        if (cart === undefined || !ownsResource(req.auth, cart.userId)) {
          throw new HttpError(404, 'Cart not found');
        }
        if (cart.status !== 'active') {
          throw new HttpError(409, 'Cart is already checked out');
        }

        const itemRows = await tx
          .select()
          .from(cartItems)
          .where(eq(cartItems.cartId, cart.id))
          .orderBy(cartItems.createdAt);
        if (itemRows.length === 0) {
          throw new HttpError(400, 'Cart is empty');
        }

        const productNames = new Map<string, string>();
        for (const item of itemRows) {
          const [product] = await tx
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);
          if (product === undefined) {
            throw new HttpError(409, `Product ${item.productId} no longer exists`);
          }
          productNames.set(item.productId, product.name);
        }

        const cartItemsList = itemRows.map(mapCartItem);
        const orderId = randomUUID();
        const subtotalCents = cartItemsList.reduce(
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

        const items: OrderItem[] = cartItemsList.map((item) => ({
          id: randomUUID(),
          orderId,
          productId: item.productId,
          name: productNames.get(item.productId) ?? 'Unknown product',
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          createdAt: now,
        }));

        const [orderRow] = await tx.insert(orders).values({
          id: order.id,
          userId: order.userId,
          status: order.status,
          subtotalCents: order.subtotalCents,
          taxCents: order.taxCents,
          shippingCents: order.shippingCents,
          totalCents: order.totalCents,
          billingAddress: order.billingAddress,
          shippingAddress: order.shippingAddress,
          paymentRef: null,
          createdAt: new Date(order.createdAt),
          lastUpdated: new Date(order.lastUpdated),
        }).returning();
        const inserted: typeof orderItems.$inferSelect[] = [];
        for (const item of items) {
          const [row] = await tx.insert(orderItems).values({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            createdAt: new Date(item.createdAt),
          }).returning();
          inserted.push(row);
        }
        await tx
          .update(carts)
          .set({ status: 'checkedOut', lastUpdated: new Date() })
          .where(eq(carts.id, cart.id));

        return { orderRow, inserted };
      });

      res.status(201).json({
        order: mapOrder(result.orderRow),
        items: result.inserted.map(mapOrderItem),
      });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  },
);