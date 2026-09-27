import { z } from 'zod';
import { CartIdSchema } from './carts.js';
import { ProductIdSchema } from './products.js';
import { UserIdSchema } from './users.js';
import { AddressSnapshotSchema } from './addresses.js';
import { MoneyCentsSchema } from './money.js';

export const OrderIdSchema = z.uuid();
export type OrderId = z.infer<typeof OrderIdSchema>;

export const OrderItemIdSchema = z.uuid();
export type OrderItemId = z.infer<typeof OrderItemIdSchema>;

export const OrderStatusSchema = z.enum([
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.strictObject({
  id: OrderIdSchema,
  userId: UserIdSchema,
  status: OrderStatusSchema,
  subtotalCents: MoneyCentsSchema,
  taxCents: MoneyCentsSchema,
  shippingCents: MoneyCentsSchema,
  totalCents: MoneyCentsSchema,
  billingAddress: AddressSnapshotSchema,
  shippingAddress: AddressSnapshotSchema,
  paymentRef: z.string().min(1).max(100).optional(),
  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderItemSchema = z.strictObject({
  id: OrderItemIdSchema,
  orderId: OrderIdSchema,
  productId: ProductIdSchema,
  name: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  unitPriceCents: MoneyCentsSchema,
  createdAt: z.iso.datetime(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const CreateOrderSchema = z.strictObject({
  cartId: CartIdSchema,
  billingAddress: AddressSnapshotSchema,
  shippingAddress: AddressSnapshotSchema,
  taxCents: MoneyCentsSchema.default(0),
  shippingCents: MoneyCentsSchema.default(0),
  paymentRef: z.string().min(1).max(100).optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const UpdateOrderSchema = z
  .strictObject({
    status: OrderStatusSchema,
    paymentRef: z.string().min(1).max(100),
  })
  .partial()
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;