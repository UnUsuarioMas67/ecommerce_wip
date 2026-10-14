import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import { z } from 'zod';
import type {
  Address,
  AddressSnapshot,
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
  Product,
  User,
} from '@ecommerce/schemas';

import { db } from '../src/db/index.js';
import {
  addresses,
  cartItems,
  carts,
  categories,
  orderItems,
  orders,
  products,
  users,
} from '../src/db/schema.js';
import { hashPassword } from '../src/lib/password.js';
import { signAccessToken } from '../src/lib/tokens.js';

export const ValidationErrorResponseSchema = z.array(
  z.object({
    type: z.enum(['params', 'query', 'body']),
    errors: z.array(
      z.object({
        code: z.string(),
        message: z.string(),
      }),
    ),
  }),
);

export const DEFAULT_PASSWORD = 'Password123!';
export const DEFAULT_PHONE_NUMBER = '+15550100000';
export const DEFAULT_BIRTH_DATE = '1990-01-01';

export interface CreateUserOptions extends Partial<Omit<User, 'passwordHash'>> {
  password?: string;
}

export async function createUser(options: CreateUserOptions = {}): Promise<User> {
  const { password = DEFAULT_PASSWORD, ...overrides } = options;
  const now = dayjs().toISOString();
  const user: User = {
    id: randomUUID(),
    firstName: 'Test',
    lastName: 'User',
    email: `user-${randomUUID()}@example.com`,
    passwordHash: await hashPassword(password),
    role: 'client',
    isActive: true,
    tokenVersion: 0,
    phoneNumber: DEFAULT_PHONE_NUMBER,
    birthDate: DEFAULT_BIRTH_DATE,
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  };

  await db.insert(users).values({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    isActive: user.isActive,
    tokenVersion: user.tokenVersion,
    phoneNumber: user.phoneNumber,
    birthDate: user.birthDate,
    createdAt: new Date(user.createdAt),
    lastUpdated: new Date(user.lastUpdated),
  });

  return user;
}

export function createAdmin(options: CreateUserOptions = {}): Promise<User> {
  return createUser({ ...options, role: 'admin' });
}

export async function authHeader(user: User): Promise<string> {
  return `Bearer ${await signAccessToken(user)}`;
}

export async function createCategory(overrides: Partial<Category> = {}): Promise<Category> {
  const now = dayjs().toISOString();
  const category: Category = {
    id: randomUUID(),
    name: `Category ${randomUUID().slice(0, 8)}`,
    slug: `category-${randomUUID()}`,
    parentId: null,
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  };

  await db.insert(categories).values({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    createdAt: new Date(category.createdAt),
    lastUpdated: new Date(category.lastUpdated),
  });

  return category;
}

export async function createProduct(overrides: Partial<Product> = {}): Promise<Product> {
  const now = dayjs().toISOString();
  const product: Product = {
    id: randomUUID(),
    name: `Product ${randomUUID().slice(0, 8)}`,
    sku: `SKU-${randomUUID()}`,
    priceCents: 1000,
    stock: 10,
    categoryId: undefined,
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  };

  await db.insert(products).values({
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description ?? null,
    priceCents: product.priceCents,
    stock: product.stock,
    categoryId: product.categoryId ?? null,
    createdAt: new Date(product.createdAt),
    lastUpdated: new Date(product.lastUpdated),
  });

  return product;
}

export async function createCart(userId: string, overrides: Partial<Cart> = {}): Promise<Cart> {
  const now = dayjs().toISOString();
  const cart: Cart = {
    id: randomUUID(),
    userId,
    status: 'active',
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  };

  await db.insert(carts).values({
    id: cart.id,
    userId: cart.userId,
    status: cart.status,
    createdAt: new Date(cart.createdAt),
    lastUpdated: new Date(cart.lastUpdated),
  });

  return cart;
}

export async function createCartItem(
  cartId: string,
  productId: string,
  overrides: Partial<CartItem> = {},
): Promise<CartItem> {
  const now = dayjs().toISOString();
  const item: CartItem = {
    id: randomUUID(),
    cartId,
    productId,
    quantity: 1,
    unitPriceCents: 1000,
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  };

  await db.insert(cartItems).values({
    id: item.id,
    cartId: item.cartId,
    productId: item.productId,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    createdAt: new Date(item.createdAt),
    lastUpdated: new Date(item.lastUpdated),
  });

  return item;
}

export async function createAddress(
  userId: string,
  overrides: Partial<Address> = {},
): Promise<Address> {
  const now = dayjs().toISOString();
  const address: Address = {
    id: randomUUID(),
    userId,
    label: 'Home',
    recipient: 'Test User',
    line1: '123 Main St',
    line2: undefined,
    city: 'Springfield',
    region: 'IL',
    postalCode: '62704',
    country: 'US',
    phoneNumber: undefined,
    isDefault: false,
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  };

  await db.insert(addresses).values({
    id: address.id,
    userId: address.userId,
    label: address.label,
    recipient: address.recipient,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    phoneNumber: address.phoneNumber ?? null,
    isDefault: address.isDefault,
    createdAt: new Date(address.createdAt),
    lastUpdated: new Date(address.lastUpdated),
  });

  return address;
}

export const addressSnapshot: AddressSnapshot = {
  recipient: 'Test User',
  line1: '123 Main St',
  line2: 'Apt 4',
  city: 'Springfield',
  region: 'IL',
  postalCode: '62704',
  country: 'US',
  phoneNumber: DEFAULT_PHONE_NUMBER,
};

export async function createOrder(userId: string, overrides: Partial<Order> = {}): Promise<Order> {
  const now = dayjs().toISOString();
  const order: Order = {
    id: randomUUID(),
    userId,
    status: 'pending',
    subtotalCents: 0,
    shippingAddress: addressSnapshot,
    paymentRef: undefined,
    createdAt: now,
    lastUpdated: now,
    ...overrides,
  };

  await db.insert(orders).values({
    id: order.id,
    userId: order.userId,
    status: order.status,
    subtotalCents: order.subtotalCents,
    shippingAddress: order.shippingAddress,
    paymentRef: order.paymentRef ?? null,
    createdAt: new Date(order.createdAt),
    lastUpdated: new Date(order.lastUpdated),
  });

  return order;
}

export async function createOrderItem(
  orderId: string,
  productId: string,
  overrides: Partial<OrderItem> = {},
): Promise<OrderItem> {
  const now = dayjs().toISOString();
  const item: OrderItem = {
    id: randomUUID(),
    orderId,
    productId,
    name: 'Test product',
    quantity: 1,
    unitPriceCents: 1000,
    createdAt: now,
    ...overrides,
  };

  await db.insert(orderItems).values({
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    createdAt: new Date(item.createdAt),
  });

  return item;
}
