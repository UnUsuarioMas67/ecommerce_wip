import { z } from 'zod';

export {
  money,
  MoneyCentsSchema,
  centsToDecimal,
  formatMoney,
  type MoneyCents,
} from './money.js';
export * from './users.js';
export * from './categories.js';
export * from './addresses.js';
export * from './products.js';
export * from './carts.js';
export * from './orders.js';

export function treeifyError(err: z.ZodError) {
  return z.treeifyError(err);
}