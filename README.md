# ecommerce

A full-stack ecommerce API and web app: Express 5 + Drizzle/PostgreSQL backend,
shared Zod validation schemas, and a React 19 + Vite frontend.

**Status: work in progress.** The API is feature-complete for catalog, carts,
orders, Stripe payments, and product images. The frontend is still a thin shell
(login plus a signed-in home screen) — storefront, cart, and checkout UI are not
built yet.

## Stack

| Layer | Technology |
| --- | --- |
| Backend | Express 5, Drizzle ORM, `pg`, Zod 4, `jose` (JWT), Stripe, Supabase Storage |
| Frontend | React 19, Vite 8, TanStack React Query 5, Tailwind CSS 4 |
| Database | PostgreSQL (developed against Supabase) |
| Tests | Vitest + Supertest |
| Language | TypeScript (strict, ESM) |

## Layout

```
app/backend/       Express API, Drizzle schema + migrations, tests
app/frontend/      React SPA (login flow and app shell)
packages/schemas/  @ecommerce/schemas — Zod schemas shared by API and app
```

## Getting started

Requires **Node.js 20+** and a PostgreSQL database. npm workspaces are used, so
run commands from the repository root.

```powershell
npm install
npm run build -w @ecommerce/schemas
```

`packages/schemas` must be built before the backend or frontend typecheck,
because both consume it from `dist/`.

### Configure the backend

Copy the example env file and fill in the values:

```powershell
Copy-Item app/backend/.env.example app/backend/.env.development
```

The app loads `app/backend/.env.<NODE_ENV>` (`.env.development` when unset).
`JWT_SECRET` is required in every environment and must be at least 32
characters. Then apply the migrations, create the admin user, and start the API:

```powershell
npm run db:migrate -w @ecommerce/backend
npm run seed:admin -w @ecommerce/backend
npm run dev
```

The API listens on `http://localhost:3000`; `GET /health` should return
`{"status":"ok"}`. `seed:admin` creates the admin from `ADMIN_EMAIL` and
`ADMIN_PASSWORD`, or resets that user's password and role when it already
exists, so it is safe to re-run. Seeding is not part of app startup.

### Start the frontend

In a second terminal:

```powershell
npm run dev:frontend
```

The SPA runs on `http://localhost:5173` and calls the API directly. The backend
requires the browser origin to be in `CORS_ORIGINS`; development and test
defaults already admit any localhost port.

## Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Build schemas, then backend, then frontend |
| `npm run dev` | Backend in watch mode |
| `npm run dev:frontend` | Vite dev server |
| `npm run test -w @ecommerce/backend` | Run the API test suite |
| `npm run db:generate -w @ecommerce/backend` | Generate a Drizzle migration |
| `npm run db:migrate -w @ecommerce/backend` | Apply pending migrations |
| `npm run db:studio -w @ecommerce/backend` | Open Drizzle Studio |
| `npm run seed:admin -w @ecommerce/backend` | Create or reset the bootstrap admin from `.env.development` |
| `npm run seed:admin:prod -w @ecommerce/backend` | Same, using `.env.production` |
| `npm run typecheck -w @ecommerce/frontend` | Typecheck the SPA |

## Environment variables

See `app/backend/.env.example` for the annotated list. The main ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (required in production) |
| `JWT_SECRET` | Access token signing secret, 32+ chars, required everywhere |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL_DAYS` | Token lifetimes (defaults `15m` / `30`) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap admin, created by `seed:admin` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe API and webhook signing |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | Checkout redirect targets |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Storage access for product images |
| `DB_POOL_MAX` | Connection pool size (default 10) |

The frontend reads `VITE_API_BASE_URL` (see `app/frontend/.env.example`); it
defaults to `http://localhost:3000` in development and same-origin `/api` in
production. Only `VITE_`-prefixed variables reach the browser bundle.

Never commit `.env` files or keys — `.env*` is gitignored except the examples.

## API overview

All responses are JSON. Errors use `{ "error": "message", "code": "CODE" }`.
Money is always integer cents.

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/health` | Public |
| `POST` | `/auth/register` | Public (rate limited) |
| `POST` | `/auth/login` | Public (rate limited) |
| `POST` | `/auth/refresh` | Public |
| `POST` | `/auth/logout` | Public |
| `GET` | `/auth/me` | Signed in |
| `GET` | `/products`, `/products/:id` | Public |
| `POST` | `/products` | Admin |
| `PATCH` | `/products/:id` | Admin |
| `POST` | `/products/:productId/images` | Admin (multipart `images`) |
| `PATCH` | `/products/:productId/images/:imageId` | Admin |
| `DELETE` | `/products/:productId/images/:imageId` | Admin |
| `GET` | `/categories`, `/categories/:id` | Public |
| `POST` | `/categories` | Admin |
| `PATCH` | `/categories/:id` | Admin |
| `GET` | `/addresses`, `/addresses/:id` | Signed in |
| `POST` | `/addresses` | Signed in |
| `PATCH` | `/addresses/:id` | Signed in |
| `POST` | `/carts` | Signed in |
| `GET` | `/carts/:id`, `/carts/:id/items` | Signed in (owner) |
| `POST` | `/carts/:id/items` | Signed in (owner) |
| `PATCH` | `/carts/:id/items/:itemId` | Signed in (owner) |
| `DELETE` | `/carts/:id/items/:itemId` | Signed in (owner) |
| `POST` | `/orders` | Signed in |
| `GET` | `/orders/:id` | Signed in (owner) |
| `POST` | `/payments/checkout-sessions` | Signed in |
| `POST` | `/payments/webhook` | Stripe signature |

### Checkout flow

1. `POST /orders` checks out the cart and creates an order in `pending`.
2. `POST /payments/checkout-sessions` with `{ orderId }` returns a Stripe
   Checkout URL.
3. Stripe's signed `checkout.session.completed` webhook marks the order `paid`
   (idempotent; verifies the paid total equals the order subtotal).

Payment references are managed by Stripe and never accepted from clients.

## Database

Drizzle Kit owns the schema: migrations live in `app/backend/drizzle/` and are
applied to whatever `DATABASE_URL` the current env file points at. Row level
security is enabled on the public tables by a custom migration, and the Supabase
Data API roles are revoked — the backend is the only access path.

## Tests

```powershell
Copy-Item app/backend/.env.example app/backend/.env.test  # point DATABASE_URL at a dedicated test DB
npm run test -w @ecommerce/backend
```

The suite truncates every table before each test, so `.env.test` must **not**
point at the development database; `tests/test-db.ts` refuses to run if it does.
Against a remote Supabase project a full run takes a few minutes; against local
Postgres it takes well under a minute.

## License

[MIT](./LICENSE)
