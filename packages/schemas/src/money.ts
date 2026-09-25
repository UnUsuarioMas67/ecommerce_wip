import { z } from 'zod';

const DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;

export const MoneyCentsSchema = z.number().int().nonnegative();
export type MoneyCents = z.infer<typeof MoneyCentsSchema>;

function toCents(amount: number, ctx: z.RefinementCtx): number | typeof z.NEVER {
  if (!Number.isFinite(amount)) {
    ctx.addIssue({ code: 'custom', message: 'Amount must be a finite number' });
    return z.NEVER;
  }

  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) {
    ctx.addIssue({ code: 'custom', message: 'Amount must have at most 2 decimal places' });
    return z.NEVER;
  }

  if (!Number.isSafeInteger(cents)) {
    ctx.addIssue({ code: 'custom', message: 'Amount is too large' });
    return z.NEVER;
  }

  return cents;
}

export function money(options: { positive?: boolean } = {}) {
  const centsSchema = options.positive
    ? z.number().int().positive('Amount must be greater than zero')
    : z.number().int().nonnegative('Amount must be non-negative');

  return z
    .union([
      z.number(),
      z.string().regex(DECIMAL_REGEX, 'Amount must have at most 2 decimal places'),
    ])
    .transform((value, ctx) => {
      const amount = typeof value === 'string' ? Number(value) : value;
      return toCents(amount, ctx);
    })
    .pipe(centsSchema);
}

export function centsToDecimal(cents: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}