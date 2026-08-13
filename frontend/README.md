# Quiz Builder frontend

The frontend uses React 19, Vite, strict TypeScript, TanStack Query, React Router, and Vitest.
Vite was selected as the smallest conventional build tool for this client-rendered React app; the
project does not currently require server rendering or a full-stack frontend framework.

## Commands

Run from `frontend/`:

- `npm run dev` — start Vite on port 5173
- `npm run build` — type-check and produce the production bundle in `dist/`
- `npm run preview` — serve a production build locally
- `npm run typecheck` — run strict TypeScript checks
- `npm run lint` — run type-aware ESLint checks
- `npm test` / `npm run test:watch` — run Vitest once or in watch mode
- `npm run format:check` / `npm run format` — check or apply Prettier formatting

Run the backend separately from `backend/` with `npm run dev`. During frontend development, calls
to `/api/*` are proxied to `http://localhost:3000/*`.

## Architecture decisions

- API access lives in `src/api/`. The shared `fetch` wrapper applies configuration and translates
  the backend's standard error envelope into `ApiError`; endpoint modules own response types.
- TanStack Query owns server state. Local UI state should remain in components until a broader
  client-state need is demonstrated.
- Routes are declared in `src/app/router.tsx` and render inside the shared application layout.
- Render failures are caught by the application boundary. Query failures are represented by each
  page in context, as the home page's API status demonstrates.
- `VITE_API_BASE_URL` is the only current public setting. Copy `.env.example` to `.env.local` to
  override it. Vite exposes `VITE_*` values to browser code, so they must never contain secrets.

## OpenAPI client decision

Do not generate a client yet. The API currently exposes only health and root endpoints, so a
generator would add build coupling without removing meaningful maintenance. Keep the HTTP boundary
centralized and revisit generation when the backend adds its first stable quiz endpoints. At that
point, generating TypeScript types (and optionally request functions) from the backend's generated
OpenAPI document should replace duplicate endpoint types in `src/api/` and run as an explicit
generation/check step rather than at browser build time.

## Layout conventions

Use semantic HTML, responsive spacing, a centered 72rem content boundary, and the tokens in
`src/styles.css`. Pages own feature composition; reusable application chrome belongs in `src/app/`.
Prefer accessible native controls and visible text states before adding a component library.
