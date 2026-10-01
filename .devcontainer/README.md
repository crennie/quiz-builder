A much shorter version:

# Devcontainer and Local Setup

## Devcontainer

This container is for trusted human development only.

It has host Docker access so Supabase can run from inside the devcontainer. Do not reuse this configuration for autonomous agent containers.

Verify:

```sh
docker version
docker info
```

## Install

From repo root:

```sh
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

## Local Supabase

The devcontainer must use:

```text
SUPABASE_SERVICES_HOSTNAME=host.docker.internal
```

Start and initialize:

```sh
npm run db:start
npm run db:reset
npm run db:types
```

Check status:

```sh
npx supabase status
```

Do not run `db:reset` during normal daily startup.

## Backend

Create:

```sh
cp backend/.env.example backend/.env.local
```

Configure `DATABASE_URL` as needed.

For hosted Supabase, ensure the connection string ends in `/postgres` and percent-encode reserved password characters.

Then:

```sh
npm run build:shared
npm --prefix backend run dev
```

## Frontend

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=/api
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Frontend and backend auth must use the same Supabase project.

Vite must listen outside container loopback:

```ts
server: {
  host: "0.0.0.0",
}
```

Run:

```sh
npm --prefix frontend run dev
```

Forward ports:

```text
3000 - backend
5173 - frontend
```

## Hosted Supabase

```sh
npx supabase login
npx supabase link --project-ref <dev-project-ref>
npx supabase migration list
npx supabase db push --dry-run
```

After review:

```sh
npx supabase db push --skip-vault
```

Do not use `db reset --linked`.

## Playwright

```sh
cd frontend
npx playwright install chromium
npm run test:e2e
```

## Common issues

- `Cannot connect to Docker daemon` → devcontainer does not have host Docker access.
- `ECONNREFUSED 127.0.0.1:54322` → set `SUPABASE_SERVICES_HOSTNAME=host.docker.internal`.
- Frontend hangs/unreachable → Vite must use `host: "0.0.0.0"`.
- API 401 → frontend and backend are using different Supabase projects.
- `database "<name>" does not exist` → malformed `DATABASE_URL`.

## Normal startup

```sh
npm run db:start
npm run build:shared
npm --prefix backend run dev
npm --prefix frontend run dev
```