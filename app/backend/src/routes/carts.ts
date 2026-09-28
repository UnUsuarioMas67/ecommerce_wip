import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CartIdSchema,
  CartItemIdSchema,
  CreateCartItemSchema,
  CreateCartSchema,
  UpdateCartItemSchema,
  type Cart,
  type CartItem,
} from '@ecommerce/schemas';
import { ownsResource, type AuthPrincipal } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { store, nowIso } from '../store.js';
import validate from 'express-zod-safe';

export const cartsRouter = Router();

function findCartItems(cartId: string): CartItem[] {
  return [...store.cartItems.values()].filter((item) => item.cartId === cartId);
}

function accessibleCart(cartId: string, auth: AuthPrincipal): Cart | undefined {
  const cart = store.carts.get(cartId);
  if (cart === undefined || !ownsResource(auth, cart.userId)) {
    return undefined;
  }
  return cart;
}

cartsRouter.post(
  '/',
  requireAuth,
  validate({ body: CreateCartSchema }),
  (req, res) => {
    const now = nowIso();
    const cart: Cart = {
      id: randomUUID(),
      userId: req.auth.userId,
      status: 'active',
      createdAt: now,
      lastUpdated: now,
    };
    store.carts.set(cart.id, cart);
    res.status(201).json({ cart });
  },
);

cartsRouter.get(
  '/:id',
  requireAuth,
  validate({ params: { id: CartIdSchema } }),
  (req, res) => {
    const cart = accessibleCart(req.params.id, req.auth);
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }
    res.json({ cart, items: findCartItems(cart.id) });
  },
);

cartsRouter.get(
  '/:id/items',
  requireAuth,
  validate({ params: { id: CartIdSchema } }),
  (req, res) => {
    const cart = accessibleCart(req.params.id, req.auth);
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }
    res.json({ items: findCartItems(cart.id) });
  },
);

cartsRouter.post(
  '/:id/items',
  requireAuth,
  validate({ params: { id: CartIdSchema }, body: CreateCartItemSchema }),
  (req, res) => {
    const cart = accessibleCart(req.params.id, req.auth);
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }
    if (cart.status !== 'active') {
      res.status(409).json({ error: 'Cart is already checked out' });
      return;
    }

    const product = store.products.get(req.body.productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const now = nowIso();
    const existing = findCartItems(cart.id).find((item) => item.productId === product.id);

    if (existing) {
      const updated: CartItem = {
        ...existing,
        quantity: existing.quantity + req.body.quantity,
        lastUpdated: now,
      };
      store.cartItems.set(updated.id, updated);
      store.carts.set(cart.id, { ...cart, lastUpdated: now });
      res.json({ item: updated });
      return;
    }

    const item: CartItem = {
      id: randomUUID(),
      cartId: cart.id,
      productId: product.id,
      quantity: req.body.quantity,
      unitPriceCents: product.priceCents,
      createdAt: now,
      lastUpdated: now,
    };
    store.cartItems.set(item.id, item);
    store.carts.set(cart.id, { ...cart, lastUpdated: now });
    res.status(201).json({ item });
  },
);

cartsRouter.patch(
  '/:id/items/:itemId',
  requireAuth,
  validate({ params: { id: CartIdSchema, itemId: CartItemIdSchema }, body: UpdateCartItemSchema }),
  (req, res) => {
    const cart = accessibleCart(req.params.id, req.auth);
    const item = store.cartItems.get(req.params.itemId);
    if (!cart || !item || item.cartId !== cart.id) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    const updated: CartItem = {
      ...item,
      ...req.body,
      lastUpdated: nowIso(),
    };
    store.cartItems.set(updated.id, updated);
    res.json({ item: updated });
  },
);

cartsRouter.delete(
  '/:id/items/:itemId',
  requireAuth,
  validate({ params: { id: CartIdSchema, itemId: CartItemIdSchema } }),
  (req, res) => {
    const cart = accessibleCart(req.params.id, req.auth);
    const item = store.cartItems.get(req.params.itemId);
    if (!cart || !item || item.cartId !== cart.id) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }
    store.cartItems.delete(item.id);
    res.status(204).end();
  },
);
