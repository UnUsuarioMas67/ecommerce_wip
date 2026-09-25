import { z } from 'zod';

export {
  money,
  MoneyCentsSchema,
  centsToDecimal,
  formatMoney,
  type MoneyCents,
} from './money';
export * from './users';
export * from './categories';
export * from './addresses';
export * from './products';
export * from './carts';
export * from './orders';

export function treeifyError(err: z.ZodError) {
  return z.treeifyError(err);
}