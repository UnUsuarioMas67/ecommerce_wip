export const TEST_DATABASE_NAME = 'ecommerce_test';

const BASE_URL = 'postgresql://postgres:12345678@localhost:5432/ecommerce';

export function getTestDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? BASE_URL);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}