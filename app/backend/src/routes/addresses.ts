import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  AddressIdSchema,
  CreateAddressSchema,
  UpdateAddressSchema,
  UserIdSchema,
  type Address,
} from '@ecommerce/schemas';
import { store, nowIso } from '../store';
import validate from 'express-zod-safe';

export const addressesRouter = Router();

addressesRouter.get('/', validate({ query: { userId: UserIdSchema } }), (req, res) => {
  const userId = req.query.userId;
  const addresses = [...store.addresses.values()].filter(
    (address) => userId === undefined || address.userId === userId,
  );
  res.json({ addresses });
});

addressesRouter.get('/:id', validate({ params: { id: AddressIdSchema } }), (req, res) => {
  const address = store.addresses.get(req.params.id);
  if (!address) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }
  res.json({ address });
});

addressesRouter.post('/', validate({ body: CreateAddressSchema }), (req, res) => {
  const address: Address = {
    id: randomUUID(),
    ...req.body,
    createdAt: nowIso(),
    lastUpdated: nowIso(),
  };
  store.addresses.set(address.id, address);
  res.status(201).json({ address });
});

addressesRouter.patch('/:id', validate({ params: { id: AddressIdSchema }, body: UpdateAddressSchema }), (req, res) => {
  const existing = store.addresses.get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }

  const updated: Address = {
    ...existing,
    ...req.body,
    lastUpdated: nowIso(),
  };
  store.addresses.set(updated.id, updated);
  res.json({ address: updated });
});
