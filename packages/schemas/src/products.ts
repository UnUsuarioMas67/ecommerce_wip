import { z } from 'zod';
import { CategoryIdSchema } from './categories.js';
import { money, MoneyCentsSchema } from './money.js';

export const ProductIdSchema = z.uuid();
export type ProductId = z.infer<typeof ProductIdSchema>;

export const ProductImageIdSchema = z.uuid();
export type ProductImageId = z.infer<typeof ProductImageIdSchema>;

const NameSchema = z.string().min(1).max(100);
const SkuSchema = z.string().min(1).max(50);
const DescriptionSchema = z.string().max(2000);
const PositionSchema = z.number().int().positive();

export const MAX_PRODUCT_IMAGES = 6;

export const ProductImageSchema = z.strictObject({
  id: ProductImageIdSchema,
  productId: ProductIdSchema,
  url: z.url(),
  position: PositionSchema,
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductImagesSchema = z.strictObject({
  thumbnailUrl: z.url(),
  galleryUrls: z.array(z.url()),
});
export type ProductImages = z.infer<typeof ProductImagesSchema>;

export const ProductSchema = z.strictObject({
  id: ProductIdSchema,
  name: NameSchema,
  sku: SkuSchema,
  description: DescriptionSchema.optional(),
  priceCents: MoneyCentsSchema.positive(),
  stock: z.number().int().nonnegative().default(0),
  categoryId: CategoryIdSchema.nullable(),
  images: ProductImagesSchema.optional(),
  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

export const UploadProductImagesSchema = z.object({
  primaryIndex: z.coerce.number().int().min(0).max(MAX_PRODUCT_IMAGES - 1).optional(),
});
export type UploadProductImagesInput = z.input<typeof UploadProductImagesSchema>;

export const UpdateProductImageSchema = z
  .strictObject({
    position: PositionSchema.optional(),
    isPrimary: z.literal(true).optional(),
  })
  .refine((val) => val.position !== undefined || val.isPrimary === true, {
    message: 'At least one field must be provided',
  });
export type UpdateProductImageInput = z.infer<typeof UpdateProductImageSchema>;

export const CreateProductSchema = z
  .strictObject({
    name: NameSchema,
    sku: SkuSchema,
    description: DescriptionSchema.optional(),
    price: money({ positive: true }),
    stock: z.number().int().nonnegative().default(0),
    categoryId: CategoryIdSchema.nullable().optional(),
  })
  .transform(({ price, ...rest }) => ({ ...rest, priceCents: price }));
export type CreateProductInput = z.input<typeof CreateProductSchema>;
export type CreateProduct = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z
  .strictObject({
    name: NameSchema,
    sku: SkuSchema,
    description: DescriptionSchema.optional(),
    priceCents: MoneyCentsSchema.positive(),
    stock: z.number().int().nonnegative(),
    categoryId: CategoryIdSchema.nullable().optional(),
  })
  .partial()
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;