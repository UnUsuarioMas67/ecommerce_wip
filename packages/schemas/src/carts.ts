import { z } from 'zod';
import { ProductIdSchema } from './products';
import { UserIdSchema } from './users';
import { MoneyCentsSchema } from './money';

export const CartIdSchema = z.uuid();
export type CartId = z.infer<typeof CartIdSchema>;

export const CartItemIdSchema = z.uuid();
export type CartItemId = z.infer<typeof CartItemIdSchema>;

export const CartStatusSchema = z.enum(['active', 'checkedOut']);
export type CartStatus = z.infer<typeof CartStatusSchema>;

export const CartSchema = z.strictObject({
  id: CartIdSchema,
  userId: UserIdSchema.nullish(),
  sessionId: z.string().min(1).max(200).nullish(),
  status: CartStatusSchema,
  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});
export type Cart = z.infer<typeof CartSchema>;

export const CreateCartSchema = z
  .strictObject({
    userId: UserIdSchema.optional(),
    sessionId: z.string().min(1).max(200).optional(),
  })
  .refine((val) => val.userId !== undefined || val.sessionId !== undefined, {
    message: 'Either "userId" or "sessionId" must be provided',
  });
export type CreateCartInput = z.infer<typeof CreateCartSchema>;

export const CartItemSchema = z.strictObject({
  id: CartItemIdSchema,
  cartId: CartIdSchema,
  productId: ProductIdSchema,
  quantity: z.number().int().positive(),
  unitPriceCents: MoneyCentsSchema,
  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CreateCartItemSchema = z.strictObject({
  productId: ProductIdSchema,
  quantity: z.number().int().positive(),
});
export type CreateCartItemInput = z.infer<typeof CreateCartItemSchema>;

export const UpdateCartItemSchema = z
  .strictObject({
    quantity: z.number().int().positive(),
  })
  .partial()
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;