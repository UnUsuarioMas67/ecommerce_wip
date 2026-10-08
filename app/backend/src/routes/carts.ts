import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  CartIdSchema,
  CartItemIdSchema,
  CreateCartItemSchema,
  CreateCartSchema,
  UpdateCartItemSchema,
  type Cart,
  type CartItem,
} from '@ecommerce/schemas';
import { db } from '../db/index.js';
import { mapCart, mapCartItem } from '../db/mappers.js';
import { cartItems, carts, products } from '../db/schema.js';
import { ownsResource, type AuthPrincipal } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { nowIso } from '../lib/time.js';
import validate from 'express-zod-safe';

export const cartsRouter = Router();

async function findCartItems(cartId: string): Promise<CartItem[]> {
  const rows = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.createdAt);
  return rows.map(mapCartItem);
}

async function accessibleCart(
  cartId: string,
  auth: AuthPrincipal,
): Promise<typeof carts.$inferSelect | undefined> {
  const [cart] = await db.select().from(carts).where(eq(carts.id, cartId)).limit(1);
  if (cart === undefined || !ownsResource(auth, cart.userId)) {
    return undefined;
  }
  return cart;
}

cartsRouter.post('/', requireAuth, validate({ body: CreateCartSchema }), async (req, res, next) => {
  try {
    const now = nowIso();
    const cart: Cart = {
      id: randomUUID(),
      userId: req.auth.userId,
      status: 'active',
      createdAt: now,
      lastUpdated: now,
    };
    const [row] = await db.insert(carts).values({
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      createdAt: new Date(cart.createdAt),
      lastUpdated: new Date(cart.lastUpdated),
    }).returning();
    res.status(201).json({ cart: mapCart(row) });
  } catch (error) {
    next(error);
  }
});

cartsRouter.get(
  '/:id',
  requireAuth,
  validate({ params: { id: CartIdSchema } }),
  async (req, res, next) => {
    try {
      const cart = await accessibleCart(req.params.id, req.auth);
      if (!cart) {
        res.status(404).json({ error: 'Cart not found' });
        return;
      }
      res.json({ cart: mapCart(cart), items: await findCartItems(cart.id) });
    } catch (error) {
      next(error);
    }
  },
);

cartsRouter.get(
  '/:id/items',
  requireAuth,
  validate({ params: { id: CartIdSchema } }),
  async (req, res, next) => {
    try {
      const cart = await accessibleCart(req.params.id, req.auth);
      if (!cart) {
        res.status(404).json({ error: 'Cart not found' });
        return;
      }
      res.json({ items: await findCartItems(cart.id) });
    } catch (error) {
      next(error);
    }
  },
);

cartsRouter.post(
  '/:id/items',
  requireAuth,
  validate({ params: { id: CartIdSchema }, body: CreateCartItemSchema }),
  async (req, res, next) => {
    try {
      const cart = await accessibleCart(req.params.id, req.auth);
      if (!cart) {
        res.status(404).json({ error: 'Cart not found' });
        return;
      }
      if (cart.status !== 'active') {
        res.status(409).json({ error: 'Cart is already checked out' });
        return;
      }

      const [productRow] = await db
        .select()
        .from(products)
        .where(eq(products.id, req.body.productId))
        .limit(1);
      if (productRow === undefined) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const now = nowIso();
      const [existing] = await db
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, req.body.productId)),
        )
        .limit(1);

      if (existing !== undefined) {
        const [row] = await db
          .update(cartItems)
          .set({
            quantity: existing.quantity + req.body.quantity,
            lastUpdated: new Date(),
          })
          .where(eq(cartItems.id, existing.id))
          .returning();
        await db.update(carts).set({ lastUpdated: new Date() }).where(eq(carts.id, cart.id));
        res.json({ item: mapCartItem(row) });
        return;
      }

      const item: CartItem = {
        id: randomUUID(),
        cartId: cart.id,
        productId: productRow.id,
        quantity: req.body.quantity,
        unitPriceCents: productRow.priceCents,
        createdAt: now,
        lastUpdated: now,
      };
      const [row] = await db.insert(cartItems).values({
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        createdAt: new Date(item.createdAt),
        lastUpdated: new Date(item.lastUpdated),
      }).returning();
      await db.update(carts).set({ lastUpdated: new Date() }).where(eq(carts.id, cart.id));
      res.status(201).json({ item: mapCartItem(row) });
    } catch (error) {
      next(error);
    }
  },
);

cartsRouter.patch(
  '/:id/items/:itemId',
  requireAuth,
  validate({ params: { id: CartIdSchema, itemId: CartItemIdSchema }, body: UpdateCartItemSchema }),
  async (req, res, next) => {
    try {
      const cart = await accessibleCart(req.params.id, req.auth);
      const [item] = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, req.params.itemId))
        .limit(1);
      if (!cart || item === undefined || item.cartId !== cart.id) {
        res.status(404).json({ error: 'Cart item not found' });
        return;
      }

      const [row] = await db
        .update(cartItems)
        .set({
          ...req.body,
          lastUpdated: new Date(),
        })
        .where(eq(cartItems.id, item.id))
        .returning();
      res.json({ item: mapCartItem(row) });
    } catch (error) {
      next(error);
    }
  },
);

cartsRouter.delete(
  '/:id/items/:itemId',
  requireAuth,
  validate({ params: { id: CartIdSchema, itemId: CartItemIdSchema } }),
  async (req, res, next) => {
    try {
      const cart = await accessibleCart(req.params.id, req.auth);
      const [item] = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, req.params.itemId))
        .limit(1);
      if (!cart || item === undefined || item.cartId !== cart.id) {
        res.status(404).json({ error: 'Cart item not found' });
        return;
      }
      await db.delete(cartItems).where(eq(cartItems.id, item.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);