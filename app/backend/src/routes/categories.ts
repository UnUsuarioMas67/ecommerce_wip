import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CategoryIdSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  type Category,
} from '@ecommerce/schemas';
import { store, nowIso } from '../store';
import validate from 'express-zod-safe';

export const categoriesRouter = Router();

categoriesRouter.get('/', (_req, res) => {
  res.json({ categories: [...store.categories.values()] });
});

categoriesRouter.get('/:id', validate({ params: { id: CategoryIdSchema } }), (req, res) => {
  const category = store.categories.get(req.params.id);
  if (!category) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  res.json({ category });
});

categoriesRouter.post('/', validate({ body: CreateCategorySchema }), (req, res) => {
  const category: Category = {
    id: randomUUID(),
    ...req.body,
    parentId: req.body.parentId ?? null,
    createdAt: nowIso(),
    lastUpdated: nowIso(),
  };
  store.categories.set(category.id, category);
  res.status(201).json({ category });
});

categoriesRouter.patch(
  '/:id',
  validate({ params: { id: CategoryIdSchema }, body: UpdateCategorySchema }),
  (req, res) => {
    const existing = store.categories.get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const updated: Category = {
      ...existing,
      ...req.body,
      parentId: req.body.parentId === undefined ? existing.parentId : (req.body.parentId ?? null),
      lastUpdated: nowIso(),
    };
    store.categories.set(updated.id, updated);
    res.json({ category: updated });
  },
);