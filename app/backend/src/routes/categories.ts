import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  CategoryIdSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  type Category,
} from '@ecommerce/schemas';
import { db } from '../db/index.js';
import { mapCategory } from '../db/mappers.js';
import { categories } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { nowIso } from '../lib/time.js';
import validate from 'express-zod-safe';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await db.select().from(categories).orderBy(categories.createdAt);
    res.json({ categories: rows.map(mapCategory) });
  } catch (error) {
    next(error);
  }
});

categoriesRouter.get(
  '/:id',
  validate({ params: { id: CategoryIdSchema } }),
  async (req, res, next) => {
    try {
      const [row] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, req.params.id))
        .limit(1);
      if (row === undefined) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      res.json({ category: mapCategory(row) });
    } catch (error) {
      next(error);
    }
  },
);

categoriesRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: CreateCategorySchema }),
  async (req, res, next) => {
    try {
      const now = nowIso();
      const category: Category = {
        id: randomUUID(),
        ...req.body,
        parentId: req.body.parentId ?? null,
        createdAt: now,
        lastUpdated: now,
      };
      const [row] = await db.insert(categories).values({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        createdAt: new Date(category.createdAt),
        lastUpdated: new Date(category.lastUpdated),
      }).returning();
      res.status(201).json({ category: mapCategory(row) });
    } catch (error) {
      next(error);
    }
  },
);

categoriesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ params: { id: CategoryIdSchema }, body: UpdateCategorySchema }),
  async (req, res, next) => {
    try {
      const [existing] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, req.params.id))
        .limit(1);
      if (existing === undefined) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const updated: Category = {
        ...mapCategory(existing),
        ...req.body,
        parentId:
          req.body.parentId === undefined ? existing.parentId : (req.body.parentId ?? null),
        lastUpdated: nowIso(),
      };
      const [row] = await db
        .update(categories)
        .set({
          name: updated.name,
          slug: updated.slug,
          parentId: updated.parentId,
          lastUpdated: new Date(updated.lastUpdated),
        })
        .where(eq(categories.id, existing.id))
        .returning();
      res.json({ category: mapCategory(row) });
    } catch (error) {
      next(error);
    }
  },
);