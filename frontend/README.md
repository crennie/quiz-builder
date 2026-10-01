# Quiz Builder frontend

The frontend uses React 19, Vite, strict TypeScript, TanStack Query, TanStack Router, and Vitest.
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

On a fresh checkout, run `npm ci` and `npm run build:shared` at the repository root before
frontend checks or builds, then run `npm ci` in `frontend/`.

Run the backend separately from `backend/` with `npm run dev`. During frontend development, calls
to `/api/*` are proxied to `http://localhost:3000`. The `/api/health` client call maps to the
unversioned backend `/health` endpoint; `/api/v1/*` paths retain their prefix.

Browser tests use the local Supabase stack by default. For an isolated, disposable project already
configured in both applications' ignored `.env.local` files, run
`E2E_USE_APP_ENV=true npm run test:e2e`. This mode creates test users and content in that project;
apply the current migrations there before running it. The backend reads `backend/.env.local`, and
Vite reads `frontend/.env.local`.

## Architecture decisions

The [Architecture & Implementation Plan](../architecture-plan.md) defines the target architecture.
Phase 7 adds Supabase Auth, shared Zod contracts, and question management UI. Phase 8 adds quiz management UI. Phase 9 adds learner attempts, results, history, and feedback submission.

- API access lives in `src/api/`. The shared `fetch` wrapper applies configuration and translates
  the backend's standard error envelope into `ApiError`. Protected calls attach the current
  Supabase access token, and question, quiz, attempt, and feedback responses are parsed with shared Zod contracts.
- TanStack Query owns server state. Local UI state should remain in components until a broader
  client-state need is demonstrated.
- Routes are declared in `src/app/router.tsx` and render inside the shared application layout.
- Render failures are caught by the application boundary. Query failures are represented by each
  page in context, as the home page's API status demonstrates.
- Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` to the same project used by the backend. `VITE_API_BASE_URL`
  defaults to `/api`. Vite exposes `VITE_*` values to browser code, so they must never contain
  secrets. The publishable key is intended for browser use.

## Question management

Sign in or create an account, then open **Questions**. The bank supports tag, prompt, visibility,
and status filters. Prompt, visibility, and status filters apply to the current page of results.
Create tags in the bank and assign them on a question's detail page. The editor supports exact
text, single choice, and multiple choice answers; it validates content with the same shared schema
as the backend. Saving an existing question creates a new version. Visibility, status, and tags
can be changed separately without creating a content version. Archived questions cannot be revised.

Use **Import question batch** in the question bank to upload a versioned JSON batch, inspect its
topic and questions, and retain the artifact. The separate **Create private drafts** action
materializes all questions and their tags. Open a draft or submit its original version for review
from the batch screen. The [REST example batch](../docs/examples/rest-endpoints-batch.json) shows
the file format. Import does not require a configured question provider.

## Quiz management

Open **Quizzes** to list, create, and edit quizzes. The editor chooses exact question versions,
sets points and time limits, reorders questions, and configures attempt settings. Content saves
create a new quiz version only when content changes. Visibility, lifecycle status, and tags are
managed separately on the quiz detail page. Published quizzes require at least one question.

## Quiz taking and feedback

Open a published quiz to start an attempt. The attempt URL loads saved progress after a refresh;
**Attempts** also lists recent attempts so unfinished quizzes can be resumed. Answer exact-text,
single-choice, and multiple-choice questions one at a time, then complete the quiz after all
required questions are answered. Results show points and a per-question review. Correct answers
and explanations appear only when the quiz's saved setting permits them. Feedback can be sent for
an attempt question or the quiz from the result page.

## OpenAPI client decision

The frontend uses small hand-written API clients and the shared Zod contracts. OpenAPI client
generation remains optional as more feature UIs are added.

## Layout conventions

Use semantic HTML, responsive spacing, a centered 72rem content boundary, and the tokens in
`src/styles.css`. Pages own feature composition; reusable application chrome belongs in `src/app/`.
Prefer accessible native controls and visible text states before adding a component library.
