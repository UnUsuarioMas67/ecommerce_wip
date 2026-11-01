import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  MAX_PRODUCT_IMAGES,
  ProductIdSchema,
  ProductImageIdSchema,
  UpdateProductImageSchema,
  UploadProductImagesSchema,
} from '@ecommerce/schemas';

import { db } from '../db/index.js';
import { mapProductImage } from '../db/mappers.js';
import { productImages, products } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadProductImages } from '../middleware/upload.js';
import {
  removeProductImageObjects,
  uploadProductImage,
  type UploadedProductImage,
} from '../services/product-images.js';
import validate from 'express-zod-safe';

export const productImagesRouter = Router({ mergeParams: true });

productImagesRouter.use(requireAuth, requireRole('admin'));

async function productExists(productId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return row !== undefined;
}

productImagesRouter.post(
  '/',
  validate({ params: { productId: ProductIdSchema } }),
  uploadProductImages,
  async (req, res, next) => {
    const uploaded: UploadedProductImage[] = [];
    try {
      const { productId } = req.params;
      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        throw new HttpError(400, 'At least one image is required');
      }

      const parsedFields = UploadProductImagesSchema.safeParse(req.body ?? {});
      if (!parsedFields.success) {
        throw new HttpError(
          400,
          `primaryIndex must be an integer between 0 and ${MAX_PRODUCT_IMAGES - 1}`,
        );
      }
      const { primaryIndex } = parsedFields.data;
      if (primaryIndex !== undefined && primaryIndex >= files.length) {
        throw new HttpError(400, 'primaryIndex must refer to one of the uploaded images');
      }

      if (!(await productExists(productId))) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const existing = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, productId));

      if (existing.length + files.length > MAX_PRODUCT_IMAGES) {
        throw new HttpError(
          400,
          `A product can have at most ${MAX_PRODUCT_IMAGES} images`,
        );
      }

      const currentPrimary = existing.find((image) => image.isPrimary);
      const maxPosition = existing.reduce(
        (max, image) => Math.max(max, image.position),
        0,
      );

      const pending = files.map((file, index) => ({
        id: randomUUID(),
        file,
        position: maxPosition + index + 1,
      }));

      for (const item of pending) {
        uploaded.push(await uploadProductImage(productId, item.id, item.file));
      }

      const created = await db.transaction(async (tx) => {
        await tx.insert(productImages).values(
          pending.map((item, index) => ({
            id: item.id,
            productId,
            url: uploaded[index]!.url,
            storagePath: uploaded[index]!.storagePath,
            position: item.position,
            isPrimary: false,
          })),
        );

        const newPrimaryId =
          primaryIndex !== undefined
            ? pending[primaryIndex]!.id
            : currentPrimary === undefined
              ? pending[0]!.id
              : undefined;

        if (newPrimaryId !== undefined) {
          if (currentPrimary !== undefined) {
            await tx
              .update(productImages)
              .set({ isPrimary: false })
              .where(eq(productImages.id, currentPrimary.id));
          }
          await tx
            .update(productImages)
            .set({ isPrimary: true })
            .where(eq(productImages.id, newPrimaryId));
        }

        return tx
          .select()
          .from(productImages)
          .where(
            inArray(
              productImages.id,
              pending.map((item) => item.id),
            ),
          )
          .orderBy(productImages.position);
      });

      uploaded.length = 0;
      res.status(201).json({ images: created.map(mapProductImage) });
    } catch (error) {
      await removeProductImageObjects(uploaded.map((image) => image.storagePath));
      next(error);
    }
  },
);

productImagesRouter.patch(
  '/:imageId',
  validate({
    params: { productId: ProductIdSchema, imageId: ProductImageIdSchema },
    body: UpdateProductImageSchema,
  }),
  async (req, res, next) => {
    try {
      const { productId, imageId } = req.params;

      if (!(await productExists(productId))) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const [image] = await db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.id, imageId),
            eq(productImages.productId, productId),
          ),
        )
        .limit(1);
      if (image === undefined) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      const { position, isPrimary } = req.body as {
        position?: number;
        isPrimary?: true;
      };

      const [row] = await db.transaction(async (tx) => {
        if (isPrimary === true && !image.isPrimary) {
          await tx
            .update(productImages)
            .set({ isPrimary: false })
            .where(
              and(
                eq(productImages.productId, productId),
                eq(productImages.isPrimary, true),
              ),
            );
        }

        return tx
          .update(productImages)
          .set({
            ...(position !== undefined ? { position } : {}),
            ...(isPrimary === true ? { isPrimary: true } : {}),
          })
          .where(eq(productImages.id, image.id))
          .returning();
      });

      res.json({ image: mapProductImage(row!) });
    } catch (error) {
      next(error);
    }
  },
);

productImagesRouter.delete(
  '/:imageId',
  validate({
    params: { productId: ProductIdSchema, imageId: ProductImageIdSchema },
  }),
  async (req, res, next) => {
    try {
      const { productId, imageId } = req.params;

      if (!(await productExists(productId))) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const [image] = await db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.id, imageId),
            eq(productImages.productId, productId),
          ),
        )
        .limit(1);
      if (image === undefined) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      await db.transaction(async (tx) => {
        await tx.delete(productImages).where(eq(productImages.id, image.id));

        if (image.isPrimary) {
          const [nextImage] = await tx
            .select()
            .from(productImages)
            .where(eq(productImages.productId, productId))
            .orderBy(productImages.position, productImages.createdAt)
            .limit(1);
          if (nextImage !== undefined) {
            await tx
              .update(productImages)
              .set({ isPrimary: true })
              .where(eq(productImages.id, nextImage.id));
          }
        }
      });

      await removeProductImageObjects([image.storagePath]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
