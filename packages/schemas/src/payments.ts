import { z } from 'zod';
import { OrderIdSchema } from './orders.js';

export const CreateCheckoutSessionSchema = z.strictObject({
  orderId: OrderIdSchema,
});
export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionSchema>;

export const CheckoutSessionSchema = z.strictObject({
  sessionId: z.string().min(1).max(255),
  url: z.url(),
});
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;
