import dayjs from 'dayjs';

import type {
  Address,
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
  Product,
  User,
  UserId,
} from '@ecommerce/schemas';

export interface RefreshTokenRecord {
  id: string;
  userId: UserId;
  tokenHash: string;
  familyId: string;
  expiresAt: string;
  revokedAt: string | null;
  replacedById: string | null;
  userAgent: string | null;
  createdAt: string;
}

export const store = {
  products: new Map<string, Product>(),
  categories: new Map<string, Category>(),
  carts: new Map<string, Cart>(),
  cartItems: new Map<string, CartItem>(),
  addresses: new Map<string, Address>(),
  orders: new Map<string, Order>(),
  orderItems: new Map<string, OrderItem>(),
  users: new Map<string, User>(),
  usersByEmail: new Map<string, string>(),
  refreshTokens: new Map<string, RefreshTokenRecord>(),
};

export function resetStore(): void {
  for (const collection of Object.values(store)) {
    collection.clear();
  }
}

export function nowIso(): string {
  return dayjs().toISOString();
}
