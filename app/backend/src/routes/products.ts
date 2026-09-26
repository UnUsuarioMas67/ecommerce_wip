import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CreateProductSchema,
  ProductIdSchema,
  type Product,
} from '@ecommerce/schemas';
import { store, nowIso } from '../store.js';
import validate from 'express-zod-safe';

export const productsRouter = Router();

productsRouter.get('/', (_req, res) => {
  res.json({ products: [...store.products.values()] });
});

productsRouter.get('/:id', validate({ params: { id: ProductIdSchema } }), (req, res) => {
  const product = store.products.get(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ product });
});

productsRouter.post('/', validate({ body: CreateProductSchema }), (req, res) => {
  const product: Product = {
    id: randomUUID(),
    ...req.body,
    createdAt: nowIso(),
    lastUpdated: nowIso(),
  };
  store.products.set(product.id, product);
  res.status(201).json({ product });
});