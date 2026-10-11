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
is `src/index.ts` (also exports `treeifyError`). Built with `tsc` to `dist/`.

**Build this package before the backend** — the backend imports schemas from
`schema`'s `dist/`.

### app/backend (`@ecommerce/backend`)

Express 5 + Drizzle ORM + PostgreSQL API.

- `src/index.ts` — entrypoint: seeds an admin user, then listens on `env.PORT`.
- `src/app.ts` — builds the Express app, mounts routers, JSON error handler.
- `src/config/env.ts` — Zod-validated env; loads `app/backend/.env` via
  `process.loadEnvFile`. Falls back to a generated `JWT_SECRET` in dev.
- `src/db/` — `schema.ts` (Drizzle tables), `index.ts` (client), `mappers.ts`.
- `src/routes/` — `auth`, `products`, `categories`, `addresses`, `carts`,
  `orders`, `payments`, all mounted in `app.ts`. The Stripe webhook
  (`POST /payments/webhook`) is mounted with `express.raw({ type:
  'application/json' })` **before** the global `express.json()` so the raw body
  survives signature verification.
- `src/middleware/auth.ts` — auth middleware.
- `src/lib/stripe.ts` — Stripe client, Checkout Session builder, webhook
  signature verification (pinned API version). Checkout is `mode: 'payment'`;
  line items itemize order products plus a single `Tax & shipping` adjustment.
- `src/services/auth.ts`, `lib/` (`errors`, `ownership`, `password`, `time`,
  `tokens`), `types/express.d.ts`.
- `drizzle.config.ts` — dialect postgresql, schema `./src/db/schema.ts`, out
  `./drizzle/`. Loads `.env` itself.
- `tests/` — Vitest. `vitest.config.ts` sets `DATABASE_URL` to a separate
  `ecommerce_test` DB, runs `global-setup.ts` + `setup.ts`, `fileParallelism:
  false`. Tests live under `tests/routes/` and `tests/lib/`.

Key dependencies: `express@5`, `express-zod-safe`, `drizzle-orm`, `pg`, `zod@4`,
`jose` (JWT), `dayjs`, `express-rate-limit`, `stripe`. Tests: `vitest`,
`supertest`.

## Commands (run from repo root unless noted)

```powershell
npm run build          # builds schemas, then backend
npm run dev            # tsx watch backend

# per-package (use -w)
npm run test -w @ecommerce/backend
npm run db:generate -w @ecommerce/backend
npm run db:migrate -w @ecommerce/backend
npm run db:studio -w @ecommerce/backend
```

There is **no lint script and no typecheck script** defined. To typecheck,
run `npx tsc --noEmit` inside the relevant workspace (`packages/schemas` or
`app/backend`) using its own `tsconfig.json`.

## Environment variables

See `app/backend/.env.example`. Notable: `DATABASE_URL`, `JWT_SECRET` (min 32
chars; ephemeral in dev if unset), `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CURRENCY` (default `usd`), `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`. In
`NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are all
required (enforced in `env.ts`). The default admin password policy: 8–64 chars
with upper, lower, digit, and special character.

Payments: creating an order (`POST /orders`) leaves it `pending` and checks out
the cart. The client then POSTs `{ orderId }` to `/payments/checkout-sessions`
to obtain a Stripe Checkout `url`. Stripe's signed `checkout.session.completed`
webhook is the only thing that flips an order to `paid` (idempotent; verifies
`amount_total === totalCents`). `paymentRef`/`stripePaymentIntentId` are
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
