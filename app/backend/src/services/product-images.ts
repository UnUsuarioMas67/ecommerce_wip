import { inArray } from 'drizzle-orm';

import { MAX_PRODUCT_IMAGES } from '@ecommerce/schemas';

import env from '../config/env.js';
import { db } from '../db/index.js';
import { productImages } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { supabase } from '../lib/supabase.js';

export type ProductImageRow = typeof productImages.$inferSelect;

export { MAX_PRODUCT_IMAGES };

// Vercel Functions reject request bodies over 4.5 MB, so the transport caps
// this endpoint well below what Postgres or Storage could hold. Six images at
// 512 KB keep a full multipart upload at 3 MB, safely under that limit.
// Raise it again only once uploads go straight from the browser to Supabase
// Storage through signed URLs and stop passing through the function.
export const MAX_PRODUCT_IMAGE_BYTES = 512 * 1024;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isAllowedImageMimeType(mimeType: string): boolean {
  return mimeType in EXTENSION_BY_MIME_TYPE;
}

function bucket(): string {
  return env.SUPABASE_PRODUCT_IMAGES_BUCKET;
}

function objectPath(productId: string, imageId: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType];
  if (extension === undefined) {
    throw new HttpError(400, 'Unsupported image type');
  }
  return `${productId}/${imageId}.${extension}`;
}

export interface UploadedProductImage {
  url: string;
  storagePath: string;
}

export async function uploadProductImage(
  productId: string,
  imageId: string,
  file: Express.Multer.File,
): Promise<UploadedProductImage> {
  const storagePath = objectPath(productId, imageId, file.mimetype);
  const storage = supabase().storage.from(bucket());
  const { error } = await storage.upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error !== null) {
    throw new HttpError(502, 'Failed to upload image to storage');
  }
  return {
    url: storage.getPublicUrl(storagePath).data.publicUrl,
    storagePath,
  };
}

/** Best-effort cleanup of storage objects; failures are logged, not thrown. */
export async function removeProductImageObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  try {
    const { error } = await supabase().storage.from(bucket()).remove(paths);
    if (error !== null) {
      console.error('[product-images] failed to remove storage objects', error);
    }
  } catch (error) {
    console.error('[product-images] failed to remove storage objects', error);
  }
}

export async function productImagesByProductIds(
  productIds: string[],
): Promise<Map<string, ProductImageRow[]>> {
  const imagesByProduct = new Map<string, ProductImageRow[]>();
  if (productIds.length === 0) {
    return imagesByProduct;
  }

  const rows = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(productImages.position, productImages.createdAt);

  for (const row of rows) {
    const images = imagesByProduct.get(row.productId);
    if (images === undefined) {
      imagesByProduct.set(row.productId, [row]);
    } else {
      images.push(row);
    }
  }
  return imagesByProduct;
}
