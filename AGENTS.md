# Quiz Builder Agent Instructions

## Source of truth

Read [Architecture & Implementation Plan](architecture-plan.md) before architecture or feature
work. It defines the domain, technology choices, invariants, and implementation order. Inspect the
repository to determine what has actually been implemented; the plan describes the target state.

## Repository layout and state

- `frontend/` contains the React, Vite, TypeScript, TanStack Router, and TanStack Query shell.
- `backend/` contains the Express 5, TypeScript, Zod, Pino, OpenAPI, and `pg` foundations.
- Shared Zod contracts, Supabase-generated DB types, and the initial SQL migration are present.
- The backend has Supabase Auth token verification, a current-user profile endpoint, and the
  Phase 3 question bank/tag API. Quiz, attempt, and feedback features remain to be built.
- Keep frontend code in `frontend/`, backend code in `backend/`, and shared contracts in `shared/`.

## Development environment

Use Node.js 24 LTS, npm, and ECMAScript modules. The canonical container is defined in
`.devcontainer/Dockerfile` and `.devcontainer/devcontainer.json`.

From `frontend/`, available commands are `npm run dev`, `npm run typecheck`, `npm run lint`,
`npm test`, `npm run format:check`, and `npm run build`.

From `backend/`, available commands are `npm run dev`, `npm run typecheck`, `npm run lint`,
`npm test`, `npm run test:unit`, `npm run test:integration`, `npm run format:check`,
`npm run openapi:check`, `npm run build`, `npm run db:check`, and `npm start` after a build.
`npm run openapi:generate` writes `backend/dist/openapi.json`.

`DATABASE_URL` is required to start the backend or run `db:check`. Starting the API also requires
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Root commands for the local Supabase stack,
migrations, schema checks, and type generation are in [README.md](README.md). Regenerating database
types requires a running local stack or a linked development project.
Run `npm ci` and `npm run build:shared` from the repository root before backend checks or builds;
the backend imports the local shared contracts package.

## Engineering conventions

- Preserve working infrastructure that conforms to the architecture plan.
- Use SQL migrations as database truth, parameterized `pg` queries, and no ORM.
- Use Supabase Auth user UUIDs directly as profile and ownership IDs. Verify user access tokens
  through the existing Auth integration; do not accept unverified JWT payloads.
- Use Zod for API and JSONB runtime validation; generated Supabase types describe database rows.
- Enforce ownership and visibility when implementing each protected feature.
- Keep changes small and avoid speculative abstractions or unrelated cleanup.
- Run relevant available checks and inspect the final diff after changes.
- Do not push or modify remote Git resources without explicit authorization.
