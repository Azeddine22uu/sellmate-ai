# SellMate AI

SellMate AI is a responsive sales assistant for online stores to manage products, customers, orders, and catalog-grounded sales conversations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `pnpm --filter @workspace/sellmate-ai run dev` — run the SellMate AI web app
- Optional cloud mode uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; without them, the app runs in browser-local demo mode.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Optional auth/data: Supabase Auth and the `sellmate_state` JSONB table defined in `artifacts/sellmate-ai/supabase/schema.sql`

## Where things live

- `artifacts/sellmate-ai/src/App.tsx` — SellMate AI routes, shell, pages, demo state, and local assistant
- `artifacts/sellmate-ai/src/lib/supabase.ts` — optional Supabase client and cloud state persistence
- `artifacts/sellmate-ai/supabase/schema.sql` — optional Supabase table and row-level security policies
- `artifacts/sellmate-ai/src/index.css` — shared Tailwind theme and visual tokens

## Architecture decisions

- Demo mode is the default so the full MVP is usable without credentials or paid APIs.
- Supabase is opt-in through Vite environment variables and uses per-user JSONB state with row-level security.
- The assistant is intentionally local and catalog-grounded for the first MVP; it never calls a paid model.
- Store data is seeded with a small Moroccan retail example so the dashboard is useful on first open.

## Product

- Landing, sign-up, and login flows
- Dashboard with revenue, orders, customers, products, and low-stock signals
- Product CRUD with image URL support
- Searchable customers and filterable orders
- Local AI assistant for product, pricing, stock, delivery, and reply-writing prompts
- Store settings for identity, currency, delivery, and assistant instructions

## User preferences

- The first MVP should avoid paid APIs and remain useful in demo mode.
- Moroccan Dirham (MAD) is the default currency.

## Gotchas

- Cloud mode requires both Supabase env values and the SQL in `artifacts/sellmate-ai/supabase/schema.sql`.
- The product is currently delivered as the workspace's React/Vite web artifact so the managed preview and build pipeline work reliably.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
