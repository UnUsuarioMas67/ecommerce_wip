import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  CreateProductSchema,
  ProductIdSchema,
  UpdateProductSchema,
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
      const body = req.body as Product & { priceCents: number };
      const product: Product = {
        id: randomUUID(),
        name: body.name,
        sku: body.sku,
        description: body.description,
        priceCents: body.priceCents,
        stock: body.stock ?? 0,
        categoryId: body.categoryId ?? null,
        createdAt: now,
        lastUpdated: now,
      };
      const [row] = await db
        .insert(products)
        .values({
          id: product.id,
          name: product.name,
          sku: product.sku,
          description: product.description ?? null,
          priceCents: product.priceCents,
          stock: product.stock,
          categoryId: product.categoryId ?? null,
          createdAt: new Date(product.createdAt),
          lastUpdated: new Date(product.lastUpdated),
        })
        .returning();
      res.status(201).json({ product: mapProduct(row) });
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: { id: ProductIdSchema }, body: UpdateProductSchema }),
  async (req, res, next) => {
    try {
      const [existing] = await db
        .select()
        .from(products)
        .where(eq(products.id, req.params.id))
        .limit(1);
      if (existing === undefined) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const existingMapped = mapProduct(existing);
      const body = req.body as Partial<Product>;
      const updated: Product = {
        ...existingMapped,
        ...body,
        description:
          body.description === undefined
            ? existing.description ?? undefined
            : body.description ?? undefined,
        categoryId:
          body.categoryId === undefined
            ? existingMapped.categoryId
            : body.categoryId === null
              ? null
              : body.categoryId ?? undefined,
        lastUpdated: nowIso(),
      };
      const [row] = await db
        .update(products)
        .set({
          name: updated.name,
          sku: updated.sku,
          description: updated.description ?? null,
          priceCents: updated.priceCents,
          stock: updated.stock,
          categoryId: updated.categoryId === null ? null : updated.categoryId ?? null,
          lastUpdated: new Date(updated.lastUpdated),
        })
        .where(eq(products.id, existing.id))
        .returning();
      res.json({ product: mapProduct(row) });
    } catch (error) {
      next(error);
    }
  },
);
