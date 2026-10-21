# Quiz Builder

The [Architecture & Implementation Plan](architecture-plan.md) defines the target system and phase
order. `frontend/` and `backend/` are the applications; `shared/` contains runtime domain contracts;
`supabase/migrations/` is the source of database schema truth.

Quiz archiving adds `20261021120000_quiz_archive.sql` after the V1 baseline. Apply pending
migrations before running the updated API; do not rebuild application data for this change.
It preserves quizzes, questions and attempt history, and supports restoring archived quizzes.

The [architecture documentation](docs/architecture/README.md) maps the current system structure,
runtime flows, decisions, and quality constraints.

The [use-case checklist](docs/use-cases.md) tracks implemented and open behaviors by epic and
feature, with stable IDs mapped to automated tests.

V1 stores direct personal questions/quizzes and public courses/lessons. Used question content and
attempted quizzes stay locked; historical attempts load immutable snapshots. Private batch import,
tags, deterministic grading and feedback remain available. Public authoring is deferred.

Existing databases require the [explicit account-preserving application rebuild](docs/plans/v1-schema-rebuild.md).
Replacing migration files is not an upgrade, and the established Auth/profile account must survive.

## Local database workflow

Use Node.js 24 and npm. From the repository root, run `npm ci`. A Docker-compatible runtime must
be installed and running for the Supabase local stack. Then run:

```sh
npm run db:start
npm run db:test
npm run db:types
```

For a brand-new disposable local stack, `npm run db:reset` recreates its database from the clean baseline.
Do not reset a database containing the preserved test account. `db:types` generates
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
hosted database and is a separate approved step. If the hosted project already has the old application
schema, use the explicit V1 rebuild procedure; do not push the baseline on top of it. Do not use `db reset --linked` for this workflow.
When the local stack is unavailable, run `npm run db:types -- --linked` from the authenticated CLI
environment after the hosted migration is applied. This generates types from the hosted schema.
With a configured database URL in ignored `backend/.env.local`, use
`node --env-file-if-exists=backend/.env.local scripts/generate-db-types.mjs --db-url` instead of a
linked CLI project. The generator trims trailing whitespace from CLI output before writing types.
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
with `npx playwright install chromium` if it is not already available. CI checks committed table, relationship and enum type shapes against generated Supabase types.
When Docker is unavailable, `node scripts/generate-embedded-db-types.mjs` generates compatible public
row types from the fresh PGlite schema; Supabase parity remains an environment check.

The [V1 restructure plan](docs/plans/v1-domain-restructure.md) records implementation and validation.
Backend PostgreSQL race tests use `TEST_DATABASE_URL` only for a fresh, disposable local database
named `quiz_builder_test`; they reject other targets. PGlite tests never connect to the hosted database.
