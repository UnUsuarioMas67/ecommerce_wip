import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db/index.js';
import {
  addresses,
  cartItems,
  carts,
  categories,
  orderItems,
  orders,
  productImages,
  products,
  refreshTokens,
  users,
} from '../../src/db/schema.js';
import { pgErrorCode } from '../../src/lib/errors.js';
import {
  createAddress,
  createCart,
  createCartItem,
  createCategory,
  createOrder,
  createOrderItem,
  createProduct,
  createProductImage,
  createUser,
} from '../helpers.js';

async function expectForeignKeyViolation(operation: PromiseLike<unknown>): Promise<void> {
  const error = await operation.then(
    () => undefined,
    (cause: unknown) => cause,
  );
  expect(error).toBeDefined();
  expect(pgErrorCode(error)).toBe('23503');
}

function refreshTokenValues(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    userId,
    tokenHash: randomUUID(),
    familyId: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

describe('foreign key constraints', () => {
  it('should reject a cart item whose cart does not exist', async () => {
    const product = await createProduct();

    await expectForeignKeyViolation(
      db.insert(cartItems).values({
        id: randomUUID(),
        cartId: randomUUID(),
        productId: product.id,
        quantity: 1,
        unitPriceCents: 100,
      }),
    );
  });

  it('should reject a cart item whose product does not exist', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);

    await expectForeignKeyViolation(
      db.insert(cartItems).values({
        id: randomUUID(),
        cartId: cart.id,
        productId: randomUUID(),
        quantity: 1,
        unitPriceCents: 100,
      }),
    );
  });

  it('should reject a product image whose product does not exist', async () => {
    await expectForeignKeyViolation(
      db.insert(productImages).values({
        id: randomUUID(),
        productId: randomUUID(),
        url: 'https://test.supabase.co/storage/v1/object/public/product-images/orphan.jpg',
        storagePath: `${randomUUID()}/orphan.jpg`,
        position: 1,
      }),
    );
  });

  it('should reject an order item whose order does not exist', async () => {
    const product = await createProduct();

    await expectForeignKeyViolation(
      db.insert(orderItems).values({
        id: randomUUID(),
        orderId: randomUUID(),
        productId: product.id,
        name: 'Orphan item',
        quantity: 1,
        unitPriceCents: 100,
      }),
    );
  });

  it('should delete cart lines and images when a product is deleted', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    await createCartItem(cart.id, product.id);
    await createProductImage(product.id);

    await db.delete(products).where(eq(products.id, product.id));

    const remainingCartItems = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));
    const remainingImages = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    expect(remainingCartItems).toHaveLength(0);
    expect(remainingImages).toHaveLength(0);
  });

  it('should refuse to delete a product referenced by an order item', async () => {
    const user = await createUser();
    const product = await createProduct();
    const order = await createOrder(user.id);
    await createOrderItem(order.id, product.id);

    await expectForeignKeyViolation(db.delete(products).where(eq(products.id, product.id)));

    const [storedProduct] = await db
      .select()
      .from(products)
      .where(eq(products.id, product.id));
    expect(storedProduct?.id).toBe(product.id);
  });

  it('should delete a user with their carts, addresses and refresh tokens', async () => {
    const user = await createUser();
    const cart = await createCart(user.id);
    const product = await createProduct();
    await createCartItem(cart.id, product.id);
    await createAddress(user.id);
    await db.insert(refreshTokens).values(refreshTokenValues(user.id));

    await db.delete(users).where(eq(users.id, user.id));

    const remainingCarts = await db.select().from(carts).where(eq(carts.userId, user.id));
    const remainingCartItems = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));
    const remainingAddresses = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, user.id));
    const remainingTokens = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, user.id));
    expect(remainingCarts).toHaveLength(0);
    expect(remainingCartItems).toHaveLength(0);
    expect(remainingAddresses).toHaveLength(0);
    expect(remainingTokens).toHaveLength(0);
  });

  it('should refuse to delete a user referenced by an order', async () => {
    const user = await createUser();
    await createOrder(user.id);

    await expectForeignKeyViolation(db.delete(users).where(eq(users.id, user.id)));

    const remainingOrders = await db.select().from(orders).where(eq(orders.userId, user.id));
    expect(remainingOrders).toHaveLength(1);
  });

  it('should detach children and products when a category is deleted', async () => {
    const parent = await createCategory();
    const child = await createCategory({ parentId: parent.id });
    const product = await createProduct({ categoryId: parent.id });

    await db.delete(categories).where(eq(categories.id, parent.id));

    const [storedChild] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, child.id));
    const [storedProduct] = await db
      .select()
      .from(products)
      .where(eq(products.id, product.id));
    expect(storedChild?.parentId).toBeNull();
    expect(storedProduct?.categoryId).toBeNull();
  });

  it('should null the rotation pointer when the replaced token is deleted', async () => {
    const user = await createUser();
    const first = refreshTokenValues(user.id);
    await db.insert(refreshTokens).values(first);
    const second = refreshTokenValues(user.id, { replacedById: first.id });
    await db.insert(refreshTokens).values(second);

    await db.delete(refreshTokens).where(eq(refreshTokens.id, first.id));

    const [storedSecond] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, second.id));
    expect(storedSecond?.replacedById).toBeNull();
  });
});
