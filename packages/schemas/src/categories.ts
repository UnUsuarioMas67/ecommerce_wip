import { z } from 'zod';

export const CategoryIdSchema = z.uuid();
export type CategoryId = z.infer<typeof CategoryIdSchema>;

const NameSchema = z.string().min(1).max(100);
const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case');

export const CategorySchema = z.strictObject({
  id: CategoryIdSchema,
  name: NameSchema,
  slug: SlugSchema,
  parentId: CategoryIdSchema.nullable(),
  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategorySchema = z.strictObject({
  name: NameSchema,
  slug: SlugSchema,
  parentId: CategoryIdSchema.nullable().optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .strictObject({
    name: NameSchema,
    slug: SlugSchema,
    parentId: CategoryIdSchema.nullable().optional(),
  })
  .partial()
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;