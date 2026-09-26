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
import { store, nowIso } from '../store.js';
import validate from 'express-zod-safe';

export const cartsRouter = Router();

function findCartItems(cartId: string): CartItem[] {
  return [...store.cartItems.values()].filter((item) => item.cartId === cartId);
}

cartsRouter.post('/', validate({ body: CreateCartSchema }), (req, res) => {
  const cart: Cart = {
    id: randomUUID(),
    userId: req.body.userId ?? null,
    sessionId: req.body.sessionId ?? null,
    status: 'active',
    createdAt: nowIso(),
    lastUpdated: nowIso(),
  };
  store.carts.set(cart.id, cart);
  res.status(201).json({ cart });
});

cartsRouter.get('/:id', validate({ params: { id: CartIdSchema } }), (req, res) => {
  const cart = store.carts.get(req.params.id);
  if (!cart) {
    res.status(404).json({ error: 'Cart not found' });
    return;
  }
  res.json({ cart, items: findCartItems(cart.id) });
});

cartsRouter.get('/:id/items', validate({ params: { id: CartIdSchema } }), (req, res) => {
  if (!store.carts.has(req.params.id)) {
    res.status(404).json({ error: 'Cart not found' });
    return;
  }
  res.json({ items: findCartItems(req.params.id) });
});

cartsRouter.post(
  '/:id/items',
  validate({ params: { id: CartIdSchema }, body: CreateCartItemSchema }),
  (req, res) => {
    const cart = store.carts.get(req.params.id);
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
  validate({ params: { id: CartIdSchema, itemId: CartItemIdSchema }, body: UpdateCartItemSchema }),
  (req, res) => {
    const item = store.cartItems.get(req.params.itemId);
    if (!item || item.cartId !== req.params.id) {
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
  validate({ params: { id: CartIdSchema, itemId: CartItemIdSchema } }),
  (req, res) => {
    const item = store.cartItems.get(req.params.itemId);
    if (!item || item.cartId !== req.params.id) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }
    store.cartItems.delete(item.id);
    res.status(204).end();
  },
);