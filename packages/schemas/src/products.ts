import { z } from 'zod';
import { CategoryIdSchema } from './categories.js';
import { money, MoneyCentsSchema } from './money.js';

export const ProductIdSchema = z.uuid();
export type ProductId = z.infer<typeof ProductIdSchema>;

const NameSchema = z.string().min(1).max(100);
const SkuSchema = z.string().min(1).max(50);
const DescriptionSchema = z.string().max(2000);

export const ProductSchema = z.strictObject({
  id: ProductIdSchema,
  name: NameSchema,
  sku: SkuSchema,
  description: DescriptionSchema.optional(),
  priceCents: MoneyCentsSchema.positive(),
  stock: z.number().int().nonnegative().default(0),
  categoryId: CategoryIdSchema.nullable(),
  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

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