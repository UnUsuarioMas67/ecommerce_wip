import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  CreateProductSchema,
  ProductIdSchema,
  type Product,
} from '@ecommerce/schemas';
import { db } from '../db/index.js';
import { mapProduct } from '../db/mappers.js';
import { products } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { nowIso } from '../lib/time.js';
import validate from 'express-zod-safe';

export const productsRouter = Router();

productsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await db.select().from(products).orderBy(products.createdAt);
    res.json({ products: rows.map(mapProduct) });
  } catch (error) {
    next(error);
  }
});

productsRouter.get(
  '/:id',
  validate({ params: { id: ProductIdSchema } }),
  async (req, res, next) => {
    try {
      const [row] = await db
        .select()
        .from(products)
        .where(eq(products.id, req.params.id))
        .limit(1);
      if (row === undefined) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json({ product: mapProduct(row) });
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: CreateProductSchema }),
  async (req, res, next) => {
    try {
      const now = nowIso();
      const product: Product = {
        id: randomUUID(),
        ...req.body,
        createdAt: now,
        lastUpdated: now,
      };
      const [row] = await db.insert(products).values({
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        priceCents: product.priceCents,
        stock: product.stock,
        categoryId: product.categoryId ?? null,
        createdAt: new Date(product.createdAt),
        lastUpdated: new Date(product.lastUpdated),
      }).returning();
      res.status(201).json({ product: mapProduct(row) });
    } catch (error) {
      next(error);
    }
  },
);