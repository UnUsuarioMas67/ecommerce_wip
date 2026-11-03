# AGENTS.md

Project memory for this repo. Loaded automatically at the start of every opencode
session — keep it accurate so agents do not have to re-explore the tree.

## Environment

- **OS: Windows.** The shell is **PowerShell 5.1**.
  - Use PowerShell syntax, not bash. Use `;` or `cmd1; if ($?) { cmd2 }` to chain
    commands. Do **not** use `&&`.
  - Prefer cmdlets (`Get-ChildItem`, `Test-Path`, `Remove-Item -LiteralPath ...`).
  - Quote paths with spaces and use the call operator `& "path\to\exe" args`.
- Node.js >= 20 (uses `process.loadEnvFile`).
- Package manager: **npm** (npm workspaces).
- Everything is **ESM** (`"type": "module"`). Relative imports must use the
  `.js` extension (NodeNext resolution).

## Layout

```
ecommerce/                 npm workspace root
  package.json             workspaces: app/*, packages/*
  tsconfig.base.json       shared strict TS config (ES2022, NodeNext, verbatimModuleSyntax)
  packages/schemas/        @ecommerce/schemas  — shared Zod schemas (see below)
  app/backend/             @ecommerce/backend  — Express 5 API
  app/frontend/            currently EMPTY (no frontend yet)
```

### packages/schemas (`@ecommerce/schemas`)

Shared Zod v4 validation schemas consumed by the backend and (eventually) the
frontend. Source in `src/`: `money.ts`, `users.ts`, `categories.ts`,
`addresses.ts`, `products.ts`, `carts.ts`, `orders.ts`, `payments.ts`; barrel
is `src/index.ts` (also exports `treeifyError`). `products.ts` also defines the
product image schemas (`ProductImageSchema`, `ProductImagesSchema`,
`UpdateProductImageSchema`, `UploadProductImagesSchema`) and
`MAX_PRODUCT_IMAGES` (6). Built with `tsc` to `dist/`.

**Build this package before the backend** — the backend imports schemas from
`schema`'s `dist/`.

### app/backend (`@ecommerce/backend`)

Express 5 + Drizzle ORM + PostgreSQL API.

- `src/index.ts` — entrypoint: seeds an admin user, then listens on `env.PORT`.
- `src/app.ts` — builds the Express app, mounts routers, JSON error handler.
- `src/config/env.ts` — Zod-validated env; loads
  `app/backend/.env.<NODE_ENV>` (`development` when unset) via
  `process.loadEnvFile`, walking up from the module until the file is found so it
  works both from `src/config/` and from the compiled `dist/src/config/`. The
  file cannot override `NODE_ENV`, which is set by the npm scripts via
  `cross-env`. Falls back to a generated `JWT_SECRET` in dev. `DB_POOL_MAX`
  (default 10) sizes the connection pool.
- `src/db/` — `schema.ts` (Drizzle tables), `index.ts` (`pg` Pool + Drizzle
  client, 10s connect timeout), `mappers.ts`.
- `src/routes/` — `auth`, `products`, `categories`, `addresses`, `carts`,
  `orders`, `payments`, all mounted in `app.ts`. Product images live in
  `product-images.ts`, mounted under `/products/:productId/images`. The Stripe
  webhook (`POST /payments/webhook`) is mounted with `express.raw({ type:
  'application/json' })` **before** the global `express.json()` so the raw body
  survives signature verification.
- `src/middleware/auth.ts` — auth middleware. `src/middleware/upload.ts` —
  multer memory upload (`images` field, up to 6 files, 5 MB each, JPEG/PNG/WebP).
- `src/lib/stripe.ts` — Stripe client, Checkout Session builder, webhook
  signature verification (pinned API version). Checkout is `mode: 'payment'`;
  line items itemize the order products (subtotal only, no tax/shipping).
- `src/lib/supabase.ts` — lazy Supabase client (secret key) for Storage.
- `src/services/auth.ts`, `src/services/product-images.ts` (upload/remove
  Storage objects, product image queries), `lib/` (`errors`, `ownership`,
  `password`, `time`, `tokens`), `types/express.d.ts`.
- `drizzle.config.ts` — dialect postgresql, schema `./src/db/schema.ts`, out
  `./drizzle/`. Loads `.env.<NODE_ENV>` itself, throws when `DATABASE_URL` is
  unset, and logs the target host/database so a migration cannot silently hit the
  wrong DB.
- `tests/` — Vitest. `vitest.config.ts` loads `.env.test` and points
  `DATABASE_URL` at it, runs `global-setup.ts` + `setup.ts`,
  `fileParallelism: false`. Tests live under `tests/routes/` and `tests/lib/`.
  `global-setup.ts` applies `drizzle/` to the test database idempotently instead
  of creating it — hosted Postgres (Supabase) offers no `CREATE DATABASE`.
  `tests/test-db.ts` refuses to run when `DATABASE_URL` is missing or matches
  the one in `.env.development`, because `setup.ts` truncates every table before
  each test.

Key dependencies: `express@5`, `express-zod-safe`, `drizzle-orm`, `pg`, `zod@4`,
`jose` (JWT), `dayjs`, `express-rate-limit`, `stripe`. Tests: `vitest`,
`supertest`.

## Commands (run from repo root unless noted)

```powershell
npm run build          # builds schemas, then backend
npm run dev            # cross-env NODE_ENV=development, tsx watch backend

# per-package (use -w)
npm run test -w @ecommerce/backend   # cross-env NODE_ENV=test, loads .env.test
npm run db:generate -w @ecommerce/backend
npm run db:migrate -w @ecommerce/backend
npm run db:studio -w @ecommerce/backend
```

There is **no lint script and no typecheck script** defined. To typecheck,
run `npx tsc --noEmit` inside the relevant workspace (`packages/schemas` or
`app/backend`) using its own `tsconfig.json`.

The backend build cleans `dist/` first and emits into `dist/src/` (its
`tsconfig.json` includes `tests` and `drizzle.config.ts`), so `main` and
`npm start` point at `dist/src/index.js` — not `dist/index.js`.

`npm test` loads `.env.test`; its `DATABASE_URL` must point at the dedicated test
database and does not fall back to `.env.development`. `db:generate` /
`db:migrate` / `db:studio` load `.env.<NODE_ENV>` (default `.env.development`)
and operate on that file's `DATABASE_URL` (the log line printed by
`drizzle.config.ts` shows which host).

## Database (Supabase Postgres)

The database is hosted on Supabase; Drizzle + `pg` are the only access path.
The Supabase Data API (PostgREST) is **not** used by the backend and is disabled
in both projects; the grants revoked by `0006` are defense in depth.

- **Connection:** use the project's **Session pooler** URI
  (`...pooler.supabase.com:5432`, user `postgres.<ref>`), not the direct
  `db.<ref>.supabase.co` host — the direct host is IPv6-only and fails on many
  networks. Keep `?uselibpqcompat=true&sslmode=require`: `pg@8` otherwise treats
  `sslmode=require` as `verify-full` and rejects the Supabase certificate chain.
  (Alternative: pin the project CA with `sslmode=verify-full&sslrootcert=...`.)
- **Migrations:** only `drizzle-kit` (`drizzle/` + `__drizzle_migrations`). Do
  not also run `supabase db push`; never create migrations by hand except with
  `drizzle-kit generate --custom`.
- **Privileges:** `drizzle/0006_public_schema_hardening.sql` enables RLS on all
  app tables and revokes `anon` / `authenticated` grants in `public` (including
  default privileges for future tables). Every new public table needs its own
  `ENABLE ROW LEVEL SECURITY` statement — Drizzle cannot model it, so add a
  custom migration. The app connects as `postgres` (table owner), which bypasses
  RLS; revoking the Data API roles is what protects `users.password_hash`,
  `refresh_tokens` and address PII.
- **Foreign keys:** every relation is a real FK (`drizzle/0007_*`). Deleting a
  user cascades to `carts`, `cart_items`, `addresses` and `refresh_tokens` but is
  blocked by `orders` (`restrict`). Deleting a product cascades to
  `product_images` and `cart_items` (it disappears from live carts) but is blocked
  by `order_items` (`restrict`), which keeps `name`/`unit_price_cents` history
  intact. `products.category_id` and `categories.parent_id` are `set null`;
  `refresh_tokens.replaced_by_id` is a self-FK with `set null`. Keep an index on
  any new FK column, and note that a product delete only removes image rows —
  Storage objects must be cleaned up via `removeProductImageObjects` first.
  `app.ts` maps Postgres `23503` to `409`.
- **Tests:** `.env.test`'s `DATABASE_URL` points at a second Supabase project (or
  a local Postgres offline). The suite truncates every table, hence the guard in
  `tests/test-db.ts`. `global-setup.ts` provisions the schema there on the first
  run. Free-tier projects pause after a week of inactivity, so the first test run
  after a pause needs the project resumed in the dashboard. Expect ~3 minutes
  against the remote test project (us-west-2) versus ~40 s against local Postgres.
- Free-tier projects also cap pooler clients: keep `DB_POOL_MAX` below the
  limit shown in the dashboard's connection settings.

## Environment variables

See `app/backend/.env.example`; copy it to `.env.development` for the app and
`.env.test` for Vitest. Notable: `DATABASE_URL` (Supabase session pooler; the
`.env.test` copy must target the dedicated test database), `DB_POOL_MAX`
(default 10), `JWT_SECRET` (min 32 chars; ephemeral in dev if unset),
`ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY` (default `usd`),
`STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `SUPABASE_PRODUCT_IMAGES_BUCKET` (default
`product-images`). In `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SUPABASE_URL`, and `SUPABASE_SECRET_KEY` are all required (enforced in
`env.ts`). The default admin password policy: 8–64 chars with upper, lower,
digit, and special character.

Product images: `product_images` stores `productId`, public `url`, the Supabase
`storagePath`, 1-based `position`, and `isPrimary` (partial unique index
enforces one primary per product). Files are uploaded to the public Supabase
bucket under `<productId>/<imageId>.<ext>`; uploads/deletes use
`SUPABASE_SECRET_KEY` (bucket RLS can stay closed to clients) and cleanups use
`storagePath` directly. `ProductSchema.images` is optional and derived
at read time: `thumbnailUrl` is the primary image, `galleryUrls` are the rest
ordered by position. Image endpoints require an admin: `POST /products/:productId/images`
(multipart `images`, optional `primaryIndex`), `PATCH .../images/:imageId`
(`position` and/or `isPrimary: true`), `DELETE .../images/:imageId` (promotes the
next image if the primary is removed).

Payments: creating an order (`POST /orders`) leaves it `pending` and checks out
the cart. The client then POSTs `{ orderId }` to `/payments/checkout-sessions`
to obtain a Stripe Checkout `url`. Stripe's signed `checkout.session.completed`
webhook is the only thing that flips an order to `paid` (idempotent; verifies
`amount_total === subtotalCents`). `paymentRef`/`stripePaymentIntentId` are
Stripe-managed and never accepted from clients.

## Conventions

- Strict TypeScript; `verbatimModuleSyntax` means type-only imports must use
  `import type`.
- Money is handled as integer cents (`MoneyCentsSchema`, `centsToDecimal`,
  `formatMoney` in `packages/schemas`).
- Validation is shared via `@ecommerce/schemas`; the backend uses
  `express-zod-safe` (`setGlobalOptions({ missingSchemaBehavior: 'any' })`).
- `.env` files are gitignored; never commit secrets. `.env.example` is tracked.
- Do not edit `dist/` or `node_modules/` outputs.

## Git

- Create a new branch when working on new features.
- When committing your work, split it into smaller, meaningful commits.
- Do **not** commit directly into `main` unless explicitly ordered to.
