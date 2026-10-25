import type {
  Address,
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
  Product,
  User,
  AddressSnapshot,
} from '@ecommerce/schemas';

import type { RefreshTokenRecord } from './schema.js';
import type * as s from './schema.js';

export function mapUser(row: typeof s.users.$inferSelect): User {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: row.isActive,
    tokenVersion: row.tokenVersion,
    phoneNumber: row.phoneNumber,
    birthDate: row.birthDate,
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export function mapCategory(row: typeof s.categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export function mapProduct(row: typeof s.products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description ?? undefined,
    priceCents: row.priceCents,
    stock: row.stock,
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  } as Product;
}

export function mapCart(row: typeof s.carts.$inferSelect): Cart {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export function mapCartItem(row: typeof s.cartItems.$inferSelect): CartItem {
  return {
    id: row.id,
    cartId: row.cartId,
    productId: row.productId,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export function mapAddress(row: typeof s.addresses.$inferSelect): Address {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    recipient: row.recipient,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    country: row.country,
    phoneNumber: row.phoneNumber ?? undefined,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export function mapAddressToSnapshot(
  row: typeof s.addresses.$inferSelect,
): AddressSnapshot {
  return {
    recipient: row.recipient,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    country: row.country,
    phoneNumber: row.phoneNumber ?? undefined,
  };
}

export function mapOrder(row: typeof s.orders.$inferSelect): Order {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    subtotalCents: row.subtotalCents,
    shippingAddress: row.shippingAddress as AddressSnapshot,
    paymentRef: row.paymentRef ?? undefined,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? undefined,
    stripePaymentIntentId: row.stripePaymentIntentId ?? undefined,
    paidAt: row.paidAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export function mapOrderItem(row: typeof s.orderItems.$inferSelect): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    name: row.name,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapRefreshToken(row: typeof s.refreshTokens.$inferSelect): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    familyId: row.familyId,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    replacedById: row.replacedById,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}