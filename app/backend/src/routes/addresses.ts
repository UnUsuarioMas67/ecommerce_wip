import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  AddressIdSchema,
  CreateAddressSchema,
  UpdateAddressSchema,
  type Address,
} from '@ecommerce/schemas';
import { ownsResource } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { store, nowIso } from '../store.js';
import validate from 'express-zod-safe';

export const addressesRouter = Router();

addressesRouter.get('/', requireAuth, (req, res) => {
  const addresses = [...store.addresses.values()].filter(
    (address) => address.userId === req.auth.userId,
  );
  res.json({ addresses });
});

addressesRouter.get(
  '/:id',
  requireAuth,
  validate({ params: { id: AddressIdSchema } }),
  (req, res) => {
    const address = store.addresses.get(req.params.id);
    if (!address || !ownsResource(req.auth, address.userId)) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }
    res.json({ address });
  },
);

addressesRouter.post(
  '/',
  requireAuth,
  validate({ body: CreateAddressSchema }),
  (req, res) => {
    const now = nowIso();
    const address: Address = {
      id: randomUUID(),
      ...req.body,
      userId: req.auth.userId,
      createdAt: now,
      lastUpdated: now,
    };
    store.addresses.set(address.id, address);
    res.status(201).json({ address });
  },
);

addressesRouter.patch(
  '/:id',
  requireAuth,
  validate({ params: { id: AddressIdSchema }, body: UpdateAddressSchema }),
  (req, res) => {
    const existing = store.addresses.get(req.params.id);
    if (!existing || !ownsResource(req.auth, existing.userId)) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    const updated: Address = {
      ...existing,
      ...req.body,
      userId: existing.userId,
      lastUpdated: nowIso(),
    };
    store.addresses.set(updated.id, updated);
    res.json({ address: updated });
  },
);
