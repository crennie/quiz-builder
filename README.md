# Quiz Builder

The [Architecture & Implementation Plan](architecture-plan.md) defines the target system and phase
order. `frontend/` and `backend/` are the applications; `shared/` contains runtime domain contracts;
`supabase/migrations/` is the source of database schema truth.

The [architecture documentation](docs/architecture/README.md) maps the current system structure,
runtime flows, decisions, and quality constraints.

The [use-case checklist](docs/use-cases.md) tracks implemented and open behaviors by epic and
feature, with stable IDs mapped to automated tests.

## Local database workflow

Use Node.js 24 and npm. From the repository root, run `npm ci`. A Docker-compatible runtime must
be installed and running for the Supabase local stack. Then run:

```sh
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
```

`db:reset` recreates **only the local** database from the SQL migrations. `db:types` generates
`shared/src/database.types.ts` from that database. Commit the generated file after reviewing it.
`npm run db:check-schema` applies migrations to an in-memory PostgreSQL engine and checks key
constraints without Docker. It is useful for fast feedback but does not replace `db:reset` and
`db:test` against Supabase.

Copy `backend/.env.example` to `backend/.env.local` for local backend development. The example URL
uses the local Supabase database; confirm the current URL with `npx supabase status`. The backend
`dev` and `db:check` commands load `.env.local` when it exists. For a hosted database, put its
connection URL in that ignored file or provide `DATABASE_URL` through your environment. For this
long-running Express backend, the Session pooler connection from the Dashboard's Connect panel is
appropriate when direct IPv6 is unavailable. Copy its host and username exactly, and percent-encode
reserved characters in the password. With the current `pg` driver, append
`?sslmode=require&uselibpqcompat=true` to the Session pooler URI for encrypted transport using
standard libpq `require` behavior; this mode does not verify the server certificate. Verified TLS
requires the project CA certificate and `sslmode=verify-full`. Never put a hosted database password,
access token, or service role key in a tracked file or chat message.
The CLI's interactive login stores its access token outside this repository. `.env.local` files and
Supabase CLI temporary state are ignored by Git.

## Hosted development project

After reviewing and checking the migrations locally, authenticate and link the CLI interactively to
the **development** project:

```sh
npx supabase login
npx supabase link --project-ref <dev-project-ref>
npx supabase migration list
npx supabase db push --dry-run
```

Review the linked project and dry-run output before `npx supabase db push --skip-vault`. The push changes the
hosted database and is a separate approved step. If the hosted project already has application
schema, reconcile it with `db pull` before pushing. Do not use `db reset --linked` for this workflow.
When the local stack is unavailable, run `npm run db:types -- --linked` from the authenticated CLI
environment after the hosted migration is applied. This generates types from the hosted schema.
Run `npx supabase db query --linked --file scripts/check-hosted-schema.sql` for a read-only hosted
check of tables, key constraints, immutability triggers, and RLS. Every result column should be
`true`.

## Application checks

Run each application's documented commands from its directory: [frontend](frontend/README.md),
[backend](backend/README.md). The shared contracts use `npm run typecheck:shared`,
`npm run test:shared`, and `npm run build:shared` from the root.
Build shared contracts before running backend commands because the backend imports them as a local
package.

## Browser workflow checks

With Docker running, install dependencies in the root, `frontend/`, and `backend/`, then build the
shared contracts and start the local Supabase stack. From `frontend/`, run `npm run test:e2e`.
The Playwright tests start the API and Vite with the local Supabase URL, database URL, and anon key
reported by `supabase status`. They create their own local users and content. Install Chromium once
with `npx playwright install chromium` if it is not already available. CI also regenerates database
types from the local stack and checks the committed file for drift.

**Local validation status (2026-09-29):** A full CI-equivalent run is blocked in the agent
container because Docker is unavailable. The Supabase SQL tests, generated-type drift check,
live PostgreSQL transaction tests, and Playwright browser tests still need a Docker-enabled
environment. Docker-free checks passed.
