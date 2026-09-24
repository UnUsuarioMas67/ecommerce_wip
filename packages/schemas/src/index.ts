import { z } from "zod";

export const ProductSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  stock: z.number().int().nonnegative().default(0),
});

export const CreateProductSchema = ProductSchema.omit({ id: true });

export type Product = z.infer<typeof ProductSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export function treeifyError(err: z.ZodError) {
  return z.treeifyError(err)
}