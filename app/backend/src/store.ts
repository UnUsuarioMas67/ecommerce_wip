import dayjs from 'dayjs';

import type {
  Address,
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
  Product,
} from '@ecommerce/schemas';

export const store = {
  products: new Map<string, Product>(),
  categories: new Map<string, Category>(),
  carts: new Map<string, Cart>(),
  cartItems: new Map<string, CartItem>(),
  addresses: new Map<string, Address>(),
  orders: new Map<string, Order>(),
  orderItems: new Map<string, OrderItem>(),
};

export function nowIso(): string {
  return dayjs().toISOString();
}