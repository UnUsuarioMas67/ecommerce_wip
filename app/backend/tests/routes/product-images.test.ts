import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ProductSchema } from '@ecommerce/schemas';

const storage = vi.hoisted(() => {
  const uploaded = new Map<string, { buffer: Buffer; contentType?: string }>();
  const removed: string[][] = [];

  return {
    uploaded,
    removed,
    client: {
      storage: {
        from: () => ({
          upload: async (
            path: string,
            buffer: Buffer,
            options?: { contentType?: string },
          ) => {
            uploaded.set(path, { buffer, contentType: options?.contentType });
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            removed.push(paths);
            for (const path of paths) {
              uploaded.delete(path);
            }
            return { data: [], error: null };
          },
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://test.supabase.co/storage/v1/object/public/product-images/${path}`,
            },
          }),
        }),
      },
    },
  };
});

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: () => storage.client,
}));

import app from '../../src/app.js';
import { db } from '../../src/db/index.js';
import { productImages } from '../../src/db/schema.js';
import { MAX_PRODUCT_IMAGE_BYTES } from '../../src/services/product-images.js';
import {
  authHeader,
  createAdmin,
  createProduct,
  createProductImage,
  createUser,
} from '../helpers.js';

const ProductResponseSchema = z.object({ product: ProductSchema });
const ProductImageResponseSchema = z.object({
  image: z.object({
    id: z.uuid(),
    productId: z.uuid(),
    url: z.url(),
    position: z.number().int().positive(),
    isPrimary: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
});
const ProductImageListResponseSchema = z.object({
  images: z.array(ProductImageResponseSchema.shape.image),
});
const ErrorSchema = z.object({ error: z.string() });

const jpeg = (label = 'image') => ({
  filename: `${label}.jpg`,
  contentType: 'image/jpeg',
  body: Buffer.from(`fake-${label}`),
});

beforeEach(() => {
  storage.uploaded.clear();
  storage.removed.length = 0;
});

describe('POST /products/:productId/images', () => {
  it('should return 401 without authentication', async () => {
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .attach('images', jpeg().body, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('NO_TOKEN');
  });

  it('should return 403 for a non-admin user', async () => {
    const user = await createUser();
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(user))
      .attach('images', jpeg().body, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('should return 400 when no file is sent', async () => {
    const admin = await createAdmin();
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .field('primaryIndex', '0');

    expect(response.statusCode).toBe(400);
    expect(() => ErrorSchema.parse(response.body)).not.toThrow();
  });

  it('should return 404 when the product does not exist', async () => {
    const admin = await createAdmin();

    const response = await request(app)
      .post(`/products/${randomUUID()}/images`)
      .set('Authorization', await authHeader(admin))
      .attach('images', jpeg().body, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(404);
  });

  it('should return 400 when primaryIndex is out of range', async () => {
    const admin = await createAdmin();
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .field('primaryIndex', '1')
      .attach('images', jpeg().body, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 for an unsupported content type', async () => {
    const admin = await createAdmin();
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .attach('images', Buffer.from('hello'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when a file exceeds the size limit', async () => {
    const admin = await createAdmin();
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .attach('images', Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.statusCode).toBe(400);
  });

  it('should upload the images and use primaryIndex as the thumbnail', async () => {
    const admin = await createAdmin();
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .field('primaryIndex', '1')
      .attach('images', jpeg('one').body, {
        filename: 'one.jpg',
        contentType: 'image/jpeg',
      })
      .attach('images', jpeg('two').body, {
        filename: 'two.png',
        contentType: 'image/png',
      });

    expect(response.statusCode).toBe(201);
    expect(() => ProductImageListResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.images).toHaveLength(2);
    expect(response.body.images[0].position).toBe(1);
    expect(response.body.images[0].isPrimary).toBe(false);
    expect(response.body.images[1].position).toBe(2);
    expect(response.body.images[1].isPrimary).toBe(true);

    expect(storage.uploaded.size).toBe(2);
    const paths = [...storage.uploaded.keys()];
    expect(paths.every((path) => path.startsWith(`${product.id}/`))).toBe(true);
    expect(paths.some((path) => path.endsWith('.jpg'))).toBe(true);
    expect(paths.some((path) => path.endsWith('.png'))).toBe(true);

    const rows = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    expect(rows.map((row) => row.storagePath).sort()).toEqual(paths.sort());

    const productResponse = await request(app).get(`/products/${product.id}`);
    const productBody = ProductResponseSchema.parse(productResponse.body);
    expect(productBody.product.images?.thumbnailUrl).toBe(response.body.images[1].url);
    expect(productBody.product.images?.galleryUrls).toEqual([response.body.images[0].url]);
  });

  it('should make the first image primary when no primary exists', async () => {
    const admin = await createAdmin();
    const product = await createProduct();

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .attach('images', jpeg().body, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(201);
    expect(response.body.images[0].isPrimary).toBe(true);
  });

  it('should keep the existing primary and append positions', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    await createProductImage(product.id, { position: 1, isPrimary: true });
    await createProductImage(product.id, { position: 2 });

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .attach('images', jpeg('a').body, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('images', jpeg('b').body, { filename: 'b.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(201);
    expect(response.body.images.map((image: { position: number }) => image.position)).toEqual([
      3, 4,
    ]);
    expect(response.body.images.every((image: { isPrimary: boolean }) => !image.isPrimary)).toBe(
      true,
    );

    const rows = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1);
  });

  it('should demote the existing primary when a new one is chosen', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    await createProductImage(product.id, { position: 1, isPrimary: true });

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .field('primaryIndex', '0')
      .attach('images', jpeg('a').body, { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(201);
    expect(response.body.images[0].isPrimary).toBe(true);

    const rows = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1);
  });

  it('should return 400 when the product would exceed the image limit', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    for (let position = 1; position <= 5; position += 1) {
      await createProductImage(product.id, { position });
    }

    const response = await request(app)
      .post(`/products/${product.id}/images`)
      .set('Authorization', await authHeader(admin))
      .attach('images', jpeg('a').body, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .attach('images', jpeg('b').body, { filename: 'b.jpg', contentType: 'image/jpeg' });

    expect(response.statusCode).toBe(400);
    expect(storage.uploaded.size).toBe(0);
  });
});

describe('PATCH /products/:productId/images/:imageId', () => {
  it('should return 404 when the image belongs to another product', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const other = await createProduct();
    const image = await createProductImage(other.id);

    const response = await request(app)
      .patch(`/products/${product.id}/images/${image.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ position: 3 });

    expect(response.statusCode).toBe(404);
    expect(() => ErrorSchema.parse(response.body)).not.toThrow();
  });

  it('should update the position', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const image = await createProductImage(product.id, { position: 1 });

    const response = await request(app)
      .patch(`/products/${product.id}/images/${image.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ position: 4 });

    expect(response.statusCode).toBe(200);
    expect(response.body.image.position).toBe(4);
  });

  it('should promote an image and demote the previous primary', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const primary = await createProductImage(product.id, {
      position: 1,
      isPrimary: true,
    });
    const other = await createProductImage(product.id, { position: 2 });

    const response = await request(app)
      .patch(`/products/${product.id}/images/${other.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ isPrimary: true });

    expect(response.statusCode).toBe(200);
    expect(response.body.image.isPrimary).toBe(true);

    const rows = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    expect(rows.find((row) => row.id === primary.id)?.isPrimary).toBe(false);
    expect(rows.find((row) => row.id === other.id)?.isPrimary).toBe(true);
  });

  it('should return 400 when the body is empty', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const image = await createProductImage(product.id);

    const response = await request(app)
      .patch(`/products/${product.id}/images/${image.id}`)
      .set('Authorization', await authHeader(admin))
      .send({});

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when trying to clear the primary flag', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const image = await createProductImage(product.id, { isPrimary: true });

    const response = await request(app)
      .patch(`/products/${product.id}/images/${image.id}`)
      .set('Authorization', await authHeader(admin))
      .send({ isPrimary: false });

    expect(response.statusCode).toBe(400);
  });
});

describe('DELETE /products/:productId/images/:imageId', () => {
  it('should return 404 when the image belongs to another product', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const other = await createProduct();
    const image = await createProductImage(other.id);

    const response = await request(app)
      .delete(`/products/${product.id}/images/${image.id}`)
      .set('Authorization', await authHeader(admin));

    expect(response.statusCode).toBe(404);

    const [row] = await db
      .select()
      .from(productImages)
      .where(eq(productImages.id, image.id));
    expect(row).toBeDefined();
  });

  it('should delete a non-primary image and its storage object', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const image = await createProductImage(product.id, { position: 1 });
    const [stored] = await db
      .select()
      .from(productImages)
      .where(eq(productImages.id, image.id));

    const response = await request(app)
      .delete(`/products/${product.id}/images/${image.id}`)
      .set('Authorization', await authHeader(admin));

    expect(response.statusCode).toBe(204);

    const [row] = await db
      .select()
      .from(productImages)
      .where(eq(productImages.id, image.id));
    expect(row).toBeUndefined();
    expect(storage.removed.flat()).toEqual([stored!.storagePath]);
  });

  it('should promote the next image when deleting the primary one', async () => {
    const admin = await createAdmin();
    const product = await createProduct();
    const primary = await createProductImage(product.id, {
      position: 1,
      isPrimary: true,
    });
    const next = await createProductImage(product.id, { position: 2 });
    await createProductImage(product.id, { position: 3 });

    const response = await request(app)
      .delete(`/products/${product.id}/images/${primary.id}`)
      .set('Authorization', await authHeader(admin));

    expect(response.statusCode).toBe(204);

    const rows = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    expect(rows.find((row) => row.id === next.id)?.isPrimary).toBe(true);
    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1);
  });
});
