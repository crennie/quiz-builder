# Quiz Builder backend

## Validation

Run the normal development checks from `backend/` in this order:

```text
npm run typecheck
npm run lint
npm test
npm run openapi:check
npm run build
```

First run `npm ci` and `npm run build:shared` at the repository root. The backend imports the
local `@quiz-builder/contracts` package.

Use `npm run format:check` to verify formatting and `npm run format` to format backend
files. Formatting changes should stay scoped to files already being changed.

The build command compiles production source into the ignored `dist/` directory. Run that output
with `npm start`. Development continues to run TypeScript source directly with `npm run dev`.

## Agent question creation

`POST /api/v1/agent-questions` accepts a signed-in sponsor's `brief` (10–1000 characters) and a
UUID `requestKey`. It queues a private question creation item; the web interface provides the same
action. Run `npm run worker:content` alongside the API to process it, or `npm run start:worker` after
building. The API does not require provider configuration; the worker requires
`AGENT_PROVIDER_URL`, `AGENT_PROVIDER_TOKEN`, `AGENT_PROVIDER_NAME`, and `AGENT_PROVIDER_MODEL` in
its environment. Use HTTPS for a remote provider; loopback HTTP is accepted for local development.

The provider endpoint receives a bearer token and this JSON request:

```json
{
    "schemaVersion": 1,
    "task": "CREATE_QUESTION",
    "brief": "A question about planets",
    "model": "configured-model"
}
```

It must return HTTP 200 with `{ "schemaVersion": 1, "content": <QuestionVersionContent> }` and may
include a string `providerRunId`. `QuestionVersionContent` is the shared Zod question-content
contract. The worker rejects malformed output, times out after 90 seconds, and retries an item up
to three claims. It records successful provider/model provenance and atomically creates one private
draft plus one review item. The sponsor owns the draft; its agent-origin marker prevents
direct publication even after a human revision. Review and final publication approval default to human.
The provider receives no database credential and cannot call a machine completion endpoint.

## Question batch artifacts

The [REST endpoints example](../docs/examples/rest-endpoints-batch.json) is a complete uploadable
batch. It contains a UUID `batchKey`, topic, declared source, up to 10 tag names, and 1–20 questions
with stable keys and shared `QuestionVersionContent`. The declared source is attributed to the
uploader; it is not a verified agent run. Change `batchKey` when creating a different batch.

`POST /api/v1/question-batches` validates and retains the entire JSON artifact without creating
questions. The `(sponsor, batchKey)` pair is idempotent; a changed artifact with the same key is a
conflict. `GET /api/v1/question-batches` lists recent owned batches and
`GET /api/v1/question-batches/:batchId` returns the saved document and key mappings.
`POST /api/v1/question-batches/:batchId/materialize` with `{}` atomically creates all private
drafts, resolves or creates the sponsor's tags, and records stable keys and first version IDs. A
retry returns the same drafts. The materialized drafts remain unsubmitted until the sponsor sends
each exact version through `POST /api/v1/questions/:questionId/review-submissions` or uses the
question screen. Direct publication of imported questions is forbidden, even after revision.
Review and publication then use the existing work queue. No provider or content worker is needed
for this file ingestion path.

## Optional agent review, revision, and gate

Set `CONTENT_AGENT_REVIEW=true`, `CONTENT_AGENT_REVISION=true`, or `CONTENT_AGENT_GATE=true` on
both the API and creation worker to assign future submissions to the corresponding machine role. Keep these settings consistent across the two processes. The choice
is captured in each submission; changing the setting does not reroute existing items. Run a
separate `npm run worker:content` process for each enabled role with `AGENT_WORKER_ROLE` set to
`review`, `revision`, or `gate`. Each process needs its own
`AGENT_<ROLE>_PROVIDER_URL`, `_TOKEN`, `_NAME`, and `_MODEL` settings (for example,
`AGENT_REVIEW_PROVIDER_URL`). These workers use the same `DATABASE_URL` as the API. Provider
URLs require HTTPS except for loopback development URLs.

Each provider receives a JSON request with `schemaVersion: 1`, a `task` of `REVIEW_QUESTION`,
`REVISE_QUESTION`, or `APPROVE_PUBLICATION`, the exact `content`, prior `findings`, and the
configured `model`. Review responses require `decision` (`approved`, `changes_requested`, or
`rejected`) and `findings`; gate responses use `approve_and_publish`, `changes_requested`, or
`rejected`. Revision responses require `content` instead. Every response includes
`schemaVersion: 1` and may include `providerRunId`. Requests for changes require nonempty
findings. The worker validates responses, records provider provenance, and applies decisions
through the same application workflow service as human decisions. A gate decision does not
grant a provider direct database or publication access. After three review submissions,
additional change requests become manual revision tasks. A reviewer agent never reviews a
version generated by its own actor identity. The sponsor can hand a failed agent review,
revision, or gate item to the human queue from the work queue screen.

## Database

The backend uses a centralized `pg` connection pool. Copy `.env.example` to the Git-ignored
`.env.local` for local development, or set `DATABASE_URL` in the environment. The `dev` and
`db:check` commands load `.env.local` when it exists.

- `npm run db:check` verifies that the configured database accepts a connection.

The [Architecture & Implementation Plan](../architecture-plan.md) defines the schema. SQL
migrations live in `../supabase/migrations/`; the root [README](../README.md) documents the
Supabase CLI workflow. The shared runtime contracts and generated database types live in
`../shared/`.

The server closes both its HTTP listener and database pool on `SIGINT` or `SIGTERM`. Application
code should use the pool exported by `src/db/index.ts` rather than creating pools or connections
directly. Use `withTransaction` from `src/db/transaction.ts` for multi-statement transactions.
Queries must be parameterized.

## Supabase Auth

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in ignored `.env.local` or in the process
environment. For a hosted project, use its Project URL and publishable key from the Dashboard's
API settings. The publishable key identifies the project; it is not a service-role or secret key.
The local URL and key are available from `npx supabase status` when the local stack is running.

The backend accepts a Supabase Auth **user access token** as `Authorization: Bearer <token>`.
Protected routes verify it with Supabase `getClaims()` and ensure the profile exists before their
handler runs. `GET /api/v1/me` returns that profile. Profile IDs are the exact `auth.users.id` UUID.
Supabase Auth owns sign-up, sign-in,
sessions, and token refresh; the backend does not store passwords or issue tokens. The initial
display name and avatar may come from Auth user metadata; subsequent requests preserve profile
values already stored in the database. The current-user endpoint requires a reachable database.

The SDK verifies asymmetric tokens with the project's public JWKS and checks legacy symmetric
tokens with the Auth server. The backend also checks project issuer, authenticated audience and
role, user UUID, and session UUID. A signed access token remains usable until expiry even if its
Auth session is revoked; operations that require immediate revocation checks will need a live
Auth-server check when implemented. The `x-request-id` response header echoes a valid incoming
correlation ID or contains a new UUID.

Vitest supplies a test-only default URL whose database name is `quiz_builder_test`. Database
integration tests must run against a dedicated, disposable PostgreSQL database and may override
`DATABASE_URL` in CI. They must never point `DATABASE_URL` at a development or production database.
The automated backend suite mocks the Auth SDK for API boundary tests and uses an in-memory
PostgreSQL engine for question-bank and quiz persistence tests. It does not connect to the hosted dev
database. A live Auth/profile smoke test requires a test user and hosted dev configuration.

## Question bank API

Phase 3 endpoints live under `/api/v1`:

- `GET /questions` lists owned questions and published public questions. It accepts `tag` (slug),
  `limit` (1–100), and `offset`; `nextOffset` is null when there are no more results.
- `GET /questions/:questionId` returns an owned question or a published public/unlisted question.
  Published questions include their complete current version, including answer and grading
  configuration. Anonymous readers are allowed.
- `POST /questions` creates the identity and first version in one transaction.
- `POST /questions/:questionId/versions` creates the next immutable version; `GET` on the same
  path lists all versions for the owner, newest first.
- `PATCH /questions/:questionId` changes visibility/status without making a content version;
  `POST /questions/:questionId/archive` marks it archived.
- `GET /tags` and `POST /tags` manage the signed-in user's tags. `PUT` and `DELETE` on
  `/questions/:questionId/tags/:tagId` assign and remove owned tags.

Private, draft, and archived questions are visible only to their owner. Published unlisted
questions are accessible by ID but omitted from the public list. Mutations and version history
require ownership. Answer and grading JSONB is validated by shared Zod contracts on input and
when read from PostgreSQL. The [architecture plan](../architecture-plan.md) defines the durable
question and visibility rules.

## Quiz management API

Phase 4 endpoints live under `/api/v1`:

- `GET /quizzes` lists owned and published public quizzes, with `tag`, `limit`, and `offset`.
- `GET /quizzes/:quizId` returns an owned quiz or a published public/unlisted quiz. The response
  includes the current version's ordered questions and exact `questionVersionId` values, with
  full question content. It remains available even if an included source question later becomes
  private or archived.
- `POST /quizzes` creates a quiz and its first immutable version. Empty drafts are allowed;
  publishing requires at least one question.
- `PUT /quizzes/:quizId/content` saves attempt-relevant content. The backend compares the
  canonicalized content with the current version and returns the existing version for an
  equivalent save. Changes create a new version transactionally.
- `GET /quizzes/:quizId/versions` lists the owner's version history, newest first.
- `PATCH /quizzes/:quizId` updates visibility or status without a content version;
  `POST /quizzes/:quizId/publish` and `/archive` are lifecycle shortcuts.
- `PUT` and `DELETE` on `/quizzes/:quizId/tags/:tagId` assign and remove the owner's tags.

Quiz creation and content saves require question-version IDs that belong to the stated question.
Authors may include their own non-archived questions or published public/unlisted questions. Existing
membership remains usable after a source question's visibility changes. Only owners may edit,
tag, or inspect version history. Published unlisted quizzes are accessible by ID but omitted from
public lists. Quiz visibility is independent of source question visibility.

## Feedback API

Phase 6 endpoints live under `/api/v1` and require a verified user token:

- `POST /feedback` accepts a category, comment, and exactly one of `questionId`, `quizId`, or
  `quizAttemptQuestionId`. Questions and quizzes must be owned or published and accessible;
  attempted questions must belong to the submitting user's attempt.
- `GET /feedback/received` lists feedback about the user's questions and quizzes, including
  attempted questions in those quizzes. It accepts `limit` and `offset`.
- `PATCH /feedback/:feedbackId` changes review status for feedback about owned content.
  Marking feedback open again clears `reviewedAt`.

The database also rejects feedback rows with zero or multiple targets.

## Test conventions

Vitest is the test runner. Test files use the `*.test.ts` suffix and live under:

- `tests/unit/` for isolated functions, classes, and domain logic. Unit tests should avoid HTTP,
  filesystem, database, and other process boundaries.
- `tests/integration/` for interactions between application components. API integration tests use
  Supertest with the exported Express `app`; they do not bind a network port or start `server.ts`.
  Persistence integration tests apply the SQL migration to in-memory PostgreSQL with PGlite. The
  core workflow tests exercise Express, authentication middleware, domain operations, and SQL
  together using PGlite. `postgres-transactions.integration.test.ts` tests rollback and concurrent
  requests against a dedicated local PostgreSQL database when `TEST_DATABASE_URL` is set; CI
  supplies an ephemeral PostgreSQL service for this suite.

Run all tests with `npm test`, only unit tests with `npm run test:unit`, or only integration tests
with `npm run test:integration`. The PostgreSQL suite requires a fresh, disposable local database
named `quiz_builder_test`; it skips when `TEST_DATABASE_URL` is unset. Never point it at a
development or production database.

## API contracts

Zod schemas are the source of truth for runtime validation, response typing, and generated OpenAPI
schemas. The conventions for requests, responses, errors, documentation, and versioning are in
[`docs/api-conventions.md`](docs/api-conventions.md).

Run `npm run openapi:check` to generate and structurally validate the document in memory. Run
`npm run openapi:generate` to write `dist/openapi.json`; `npm run build` also writes this file after
compilation. Generated output is a build artifact and is not committed.
