-- Hand-written migration (drizzle-kit generate --custom). Drizzle does not model
-- RLS or grants, so `npm run db:generate` will never reproduce or revert this.
--
-- Supabase exposes the `public` schema through the Data API (PostgREST) and
-- grants `anon` / `authenticated` access to new tables by default. This backend
-- talks to Postgres directly as `postgres` instead, so the Data API must not be
-- able to read password hashes, refresh tokens or customer addresses.
--
-- The backend connects as the table owner, which bypasses RLS, so enabling it
-- only affects the Data API roles. New tables need their own
-- `ENABLE ROW LEVEL SECURITY` statement; the default privilege changes below
-- keep future tables from being granted to the Data API roles automatically.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- `anon` and `authenticated` only exist on Supabase, so the revokes are guarded
-- to keep the migration runnable against a plain local Postgres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
  END IF;
END $$;--> statement-breakpoint

-- Tables created by later migrations must not be re-exposed by the default
-- grants Supabase installs for the `postgres` role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;
