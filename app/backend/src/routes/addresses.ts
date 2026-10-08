import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  AddressIdSchema,
  CreateAddressSchema,
  UpdateAddressSchema,
  type Address,
} from '@ecommerce/schemas';
import { db } from '../db/index.js';
import { mapAddress } from '../db/mappers.js';
import { addresses } from '../db/schema.js';
import { ownsResource } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { nowIso } from '../lib/time.js';
import validate from 'express-zod-safe';

export const addressesRouter = Router();

addressesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, req.auth.userId))
      .orderBy(addresses.createdAt);
    res.json({ addresses: rows.map(mapAddress) });
  } catch (error) {
    next(error);
  }
});

addressesRouter.get(
  '/:id',
  requireAuth,
  validate({ params: { id: AddressIdSchema } }),
  async (req, res, next) => {
    try {
      const [row] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, req.params.id))
        .limit(1);
      const address = row === undefined ? undefined : mapAddress(row);
      if (address === undefined || !ownsResource(req.auth, address.userId)) {
        res.status(404).json({ error: 'Address not found' });
        return;
      }
      res.json({ address });
    } catch (error) {
      next(error);
    }
  },
);

addressesRouter.post(
  '/',
  requireAuth,
  validate({ body: CreateAddressSchema }),
  async (req, res, next) => {
    try {
      const now = nowIso();
      const address: Address = {
        id: randomUUID(),
        ...req.body,
        userId: req.auth.userId,
        createdAt: now,
        lastUpdated: now,
      };
      const [row] = await db.insert(addresses).values({
        id: address.id,
        userId: address.userId,
        label: address.label,
        recipient: address.recipient,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        country: address.country,
        phoneNumber: address.phoneNumber,
        isDefault: address.isDefault,
        createdAt: new Date(address.createdAt),
        lastUpdated: new Date(address.lastUpdated),
      }).returning();
      res.status(201).json({ address: mapAddress(row) });
    } catch (error) {
      next(error);
    }
  },
);

addressesRouter.patch(
  '/:id',
  requireAuth,
  validate({ params: { id: AddressIdSchema }, body: UpdateAddressSchema }),
  async (req, res, next) => {
    try {
      const [existing] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, req.params.id))
        .limit(1);
      const address = existing === undefined ? undefined : mapAddress(existing);
      if (address === undefined || !ownsResource(req.auth, address.userId)) {
        res.status(404).json({ error: 'Address not found' });
        return;
      }

      const [row] = await db
        .update(addresses)
        .set({
          ...req.body,
          userId: existing.userId,
          lastUpdated: new Date(),
        })
        .where(and(eq(addresses.id, existing.id), eq(addresses.userId, existing.userId)))
        .returning();
      res.json({ address: mapAddress(row) });
    } catch (error) {
      next(error);
    }
  },
);