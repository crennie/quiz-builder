# Quiz Builder Roadmap

This roadmap describes the intended development sequence for Quiz Builder.

It is deliberately ordered so that concerns which shape how future code should be written are established early, while infrastructure that depends on real application behavior is introduced only when there is enough application to justify it.

The roadmap is not intended to lock in every implementation detail. Architecture choices should remain small and explicit while the project is early-stage.

---

## Development principles

### Build cross-cutting concerns in early

Concerns that affect the shape or quality of most future code should be established before substantial feature development.

Examples include:

- TypeScript and compiler rules
- application/server separation
- input validation
- error handling
- logging conventions
- test infrastructure
- linting and formatting
- CI validation
- security principles
- API contract conventions
- accessibility on the frontend

These should not be deferred to a final cleanup or hardening phase.

### Add feature-dependent infrastructure when justified

Some infrastructure needs real application behavior before its design becomes clear.

Examples include:

- database structure
- authentication and authorization
- end-to-end tests
- production metrics and tracing
- deployment/CD
- caching
- background jobs

Introduce these when the first real use case requires them rather than designing them speculatively.

### Prefer vertical slices once foundations are established

After the backend and frontend foundations are stable, prefer implementing complete user-facing capabilities through the relevant layers rather than building every backend feature before beginning frontend work.

For example:

```text
Create a question
    -> persistence
    -> backend domain/service
    -> API
    -> frontend UI
    -> validation
    -> tests
```

This keeps architecture grounded in real product behavior.

### Security is continuous

There is no future task called "add security."

Security considerations should be part of each relevant implementation task:

- validate data at trust boundaries
- authorize access independently of authentication
- avoid exposing secrets
- redact sensitive log fields
- use safe database access patterns
- limit CI/CD permissions
- review dependency additions
- use secure session/token/cookie settings
- handle external integrations defensively

---

# Phase 1 — Repository and runtime foundation

Establish the basic project structure and repeatable development environment.

- [x] Establish top-level `frontend/` and `backend/` directories
- [x] Establish Node 24 LTS runtime
- [x] Use npm
- [x] Use ESM
- [x] Add backend TypeScript
- [x] Add backend typecheck command
- [x] Add minimal backend source entry point
- [x] Establish project Dev Container/runtime image
- [x] Establish isolated Codex development workflow
- [x] Establish agent review/export/import workflow
- [x] Establish local agent Git commit identity handling
- [ ] Automate dependency installation in the trusted Dev Container where appropriate
- [ ] Keep `AGENTS.md` synchronized with real development and validation commands

### Exit criteria

- A clean checkout can be opened in the project development environment.
- Node/npm versions are deterministic.
- Backend dependencies can be installed reproducibly.
- `npm run typecheck` succeeds.
- Agent changes can be reviewed, committed, exported, imported, and accepted safely.

---

# Phase 2 — Minimal backend application foundation

Establish the structure that all later backend APIs will build on.

- [x] Add Express 5
- [x] Separate Express application construction from HTTP server startup
  - `app.ts`
  - `server.ts`
- [x] Add the minimum backend development/start scripts
- [x] Add `GET /health`
- [x] Add central JSON 404 handling
- [x] Add centralized Express error middleware
- [x] Define a small application error convention
- [x] Add Zod-based environment/configuration validation
  - `NODE_ENV`
  - `PORT`
  - future environment values added through the same boundary
- [x] Add structured logging
  - Pino
  - HTTP request logging
  - consistent logger usage
  - sensitive-field redaction rules
  - avoid ad-hoc `console.log` usage

### Exit criteria

The backend has one predictable application lifecycle:

```text
validated configuration
        ->
application construction
        ->
middleware/routes
        ->
central errors
        ->
HTTP server
```

The service can start, respond to a health request, log requests/errors consistently, and fail clearly on invalid configuration.

---

# Phase 3 — Backend quality baseline

Establish the normal validation loop before meaningful domain code accumulates.

## Testing

- [x] Select and configure backend test framework
- [x] Add unit-test command
- [x] Add API integration-test support using the Express app without starting the production server
- [x] Add initial integration tests for:
  - `/health`
  - 404 behavior
  - centralized error behavior
- [x] Establish test naming/location conventions
- [x] Document when unit vs integration tests are expected

The normal backend development loop should become:

```text
implement
    ->
typecheck
    ->
lint
    ->
test
    ->
review
```

## Static quality

- [x] Add linting
- [x] Establish TypeScript-aware lint rules
- [x] Add formatting policy/tooling if useful
- [x] Avoid large style-only rewrites unrelated to feature work
- [x] Add a backend build command if production execution requires compiled output

### Exit criteria

The backend exposes stable commands for at least:

```text
typecheck
lint
test
build
```

where applicable.

New backend features are expected to use these checks rather than introducing validation later.

---

# Phase 4 — Initial CI pipeline

Add CI as soon as the project has meaningful automated checks.

- [ ] Add GitHub Actions CI workflow
- [ ] Trigger CI for pull requests
- [ ] Trigger CI for relevant pushes
- [ ] Install dependencies reproducibly
- [ ] Run backend typecheck
- [ ] Run backend lint
- [ ] Run backend tests
- [ ] Run backend build
- [ ] Add frontend checks once frontend tooling exists
- [ ] Use least-privilege workflow permissions
- [ ] Avoid unnecessary repository write permissions
- [ ] Pin or otherwise deliberately manage third-party CI actions
- [ ] Add dependency/security scanning appropriate to the repository

### Exit criteria

A change cannot silently bypass the project's ordinary validation baseline.

CI verifies the same commands developers and agents are expected to run locally.

---

# Phase 5 — API contract and validation architecture

Make API conventions explicit before many real endpoints exist.

- [x] Decide how Zod schemas and OpenAPI generation relate
- [x] Prefer a single source of truth where practical
- [x] Establish request validation convention
  - path parameters
  - query parameters
  - request bodies
- [x] Establish response-schema convention
- [x] Establish API error response shape
- [x] Generate an initial OpenAPI document
- [x] Decide where generated OpenAPI output lives
- [x] Decide whether generated artifacts are committed or produced during build
- [x] Add a validation/generation check ready for the initial CI phase
- [x] Define API versioning strategy only if/when needed

### Goal

Avoid separately maintaining equivalent runtime validation and API documentation that can drift apart.

A typical desired flow is:

```text
schema
   |-- runtime validation
   `-- OpenAPI generation
```

### Exit criteria

The first real domain endpoint can follow an established pattern for:

- request validation
- response typing
- error responses
- documentation

---

# Phase 6 — Domain model and persistence foundation

Begin real Quiz Builder behavior.

Before implementing database tables simply because they seem likely, refine the first domain use cases.

Initial domain concepts are expected to include:

- questions
- answer types
- decks
- deck/question membership
- practice attempts/sessions
- users or ownership rules later

## Initial modeling

- [ ] Define the smallest useful Question domain model
- [ ] Define initial answer-type requirements
- [ ] Define the smallest useful Deck domain model
- [ ] Decide first vertical slice before finalizing broader schema
- [ ] Choose database technology
- [ ] Choose database access/query approach
- [ ] Establish migration tooling
- [ ] Establish local development database workflow
- [ ] Establish test database strategy
- [ ] Define transaction conventions where needed
- [ ] Ensure database credentials remain outside source control

### Security requirements

From the first persistence code:

- use parameterized/safe database APIs
- validate externally supplied identifiers/data
- avoid exposing internal database details in API errors
- treat migrations as reviewed source code
- explicitly handle uniqueness/referential constraints

### Exit criteria

The project can persist and retrieve the data needed for the first vertical feature through a repeatable migration-based workflow.

---

# Phase 7 — First real vertical slice

Implement one small end-to-end product capability before expanding the domain broadly.

Recommended first slice:

## Create and retrieve a simple question

Possible scope:

- [ ] Define simple exact-answer question schema
- [ ] Add persistence model/migration
- [ ] Add backend domain/service layer as justified
- [ ] Add create-question API endpoint
- [ ] Add get-question API endpoint
- [ ] Add validation
- [ ] Add API integration tests
- [ ] Add domain/unit tests where useful
- [ ] Include structured logging/error handling
- [ ] Generate/update OpenAPI contract
- [ ] Exercise through a minimal client/manual workflow

Do not add every planned question type in the first slice.

### Exit criteria

One real Quiz Builder concept works through persistence and the HTTP API using all established project conventions.

---

# Phase 8 — Frontend foundation

Start frontend implementation before the backend becomes a large disconnected API.

Exact frontend framework/tooling should be selected deliberately rather than assumed by backend decisions.

## Foundation

- [ ] Select frontend framework/build tooling
- [ ] Configure strict TypeScript
- [ ] Establish development/build commands
- [ ] Establish linting/formatting consistent with project policy
- [ ] Establish frontend test framework
- [ ] Establish API client strategy
- [ ] Determine whether OpenAPI-generated client/types are useful
- [ ] Establish environment/configuration handling
- [ ] Establish application-level error handling
- [ ] Establish routing
- [ ] Establish basic design/layout conventions

## Accessibility baseline

Accessibility should be part of component implementation from the beginning.

- [ ] semantic HTML conventions
- [ ] keyboard operation
- [ ] focus handling
- [ ] form labels/errors/instructions
- [ ] color/contrast considerations
- [ ] appropriate ARIA only where semantic HTML is insufficient
- [ ] automated accessibility checks where useful

## Security baseline

- [ ] do not expose server-only secrets through frontend configuration
- [ ] treat client validation as UX, not a security boundary
- [ ] safely render untrusted/user-authored content
- [ ] establish safe authentication storage/session strategy before auth is implemented

### Exit criteria

The frontend can consume the first real backend capability using established type, validation, error, testing, accessibility, and API conventions.

---

# Phase 9 — First complete user-facing feature

Extend the first backend slice into a usable UI workflow.

Example:

## Create and view a simple question

- [ ] Question creation form
- [ ] Client-side UX validation
- [ ] Server-side authoritative validation
- [ ] API interaction
- [ ] Loading/error/success states
- [ ] Question display
- [ ] Component/unit tests where valuable
- [ ] API/backend integration tests
- [ ] Accessibility validation
- [ ] Add frontend validation/build/test steps to CI

### Exit criteria

The repository contains a complete frontend-to-database feature that serves as the reference implementation for subsequent work.

---

# Phase 10 — Expand question and deck functionality

Grow the domain in small vertical slices.

## Question capabilities

- [ ] Exact text answers
- [ ] Multiple-choice questions
- [ ] Multi-select answers
- [ ] Fuzzy/free-text answer evaluation
- [ ] Question editing
- [ ] Question browsing/searching
- [ ] Appropriate validation per answer type

## Deck capabilities

- [ ] Create deck
- [ ] Edit deck
- [ ] Add/remove questions
- [ ] Allow a question to belong to multiple decks
- [ ] Browse decks
- [ ] Define ordering behavior if needed

Each slice should include, where applicable:

```text
domain/persistence
API
validation
OpenAPI
frontend
tests
logging
security review
```

---

# Phase 11 — Practice/quiz engine

Implement the core study workflow.

- [ ] Start practice session for a deck
- [ ] Select/present questions
- [ ] Submit answers
- [ ] Evaluate exact answers
- [ ] Evaluate multiple-choice answers
- [ ] Evaluate multi-select answers
- [ ] Define fuzzy-answer evaluation strategy
- [ ] Present answer feedback
- [ ] Track session progress
- [ ] Track results/history if product requirements justify it
- [ ] Define retry/review behavior
- [ ] Add tests around answer evaluation as core domain logic

Answer evaluation logic should be independently testable from HTTP/UI concerns.

---

# Phase 12 — Identity, ownership, authentication, and authorization

Do not implement ownership rules until the product model is sufficiently clear, but do not build protected collaborative features without them.

## Product decisions

- [ ] Decide whether anonymous use is supported
- [ ] Decide question ownership model
- [ ] Decide deck ownership model
- [ ] Decide sharing/public/private behavior
- [ ] Decide collaboration requirements

## Technical implementation

- [ ] Select authentication approach/provider
- [ ] Establish secure session/token lifecycle
- [ ] Add authenticated user context
- [ ] Add authorization rules at appropriate application boundaries
- [ ] Ensure object-level access is checked for every protected operation
- [ ] Add authorization-focused integration tests
- [ ] Add rate limiting/abuse controls where appropriate
- [ ] Add security-relevant audit logging where justified

Authentication answers "who is this?"

Authorization independently answers "may this identity perform this operation on this resource?"

---

# Phase 13 — Broader automated testing

Expand test depth as the real application grows.

## Unit tests

Prioritize:

- answer evaluation
- domain rules
- transformations
- authorization decisions
- pure utility logic

## Backend integration tests

Prioritize:

- request validation
- API behavior
- authentication/authorization
- persistence
- error responses

## Frontend tests

Prioritize:

- user-visible behavior
- forms
- important state transitions
- accessibility-sensitive interactions

## End-to-end tests

Introduce once several meaningful frontend/backend workflows exist.

Initial candidates:

- [ ] create question
- [ ] create deck
- [ ] add question to deck
- [ ] complete a practice session
- [ ] authentication flow when applicable

Do not use E2E tests to replace cheaper unit/integration tests.

---

# Phase 14 — Operational readiness

Before treating the application as production-capable, establish explicit operational behavior.

## Observability

- [ ] production logging configuration
- [ ] request/correlation IDs
- [ ] error monitoring
- [ ] basic service metrics
- [ ] health/readiness distinction if infrastructure requires it
- [ ] tracing only when architecture/use cases justify it
- [ ] alerts for meaningful failure conditions

## Resilience

- [ ] graceful shutdown
- [ ] database connection lifecycle
- [ ] external request timeouts
- [ ] retry policy only where safe
- [ ] request/body limits
- [ ] rate limiting where appropriate
- [ ] production error sanitization

## Security

- [ ] dependency vulnerability monitoring
- [ ] secrets management
- [ ] HTTP security headers
- [ ] CORS policy based on actual deployment
- [ ] secure cookie/session settings
- [ ] production authentication configuration
- [ ] authorization review
- [ ] abuse protections
- [ ] backup/restore requirements
- [ ] security-sensitive logging review

These are reviews of security already built into the application, not a first attempt to "add security."

---

# Phase 15 — Deployment and CD

Choose deployment architecture once application requirements make the decision meaningful.

- [ ] Select frontend hosting target
- [ ] Select backend hosting target
- [ ] Select production database hosting
- [ ] Define environment strategy
  - local
  - test
  - staging if justified
  - production
- [ ] Define production secrets management
- [ ] Add infrastructure configuration as code where useful
- [ ] Add database migration deployment procedure
- [ ] Add deployment workflow
- [ ] Prefer short-lived/federated deployment credentials where supported
- [ ] Keep CI/CD permissions least-privileged
- [ ] Add deployment approval gates where appropriate
- [ ] Establish rollback procedure
- [ ] Establish backup/restore procedure

CI should already exist before this phase.

This phase adds CD and production operations rather than introducing basic code validation for the first time.

---

# Phase 16 — Product expansion

Potential later capabilities include:

- question/deck search
- tagging/topics/categories
- richer study modes
- spaced repetition
- progress/statistics
- import/export
- sharing
- collaboration
- public question banks
- content moderation
- media/image support
- bulk question creation
- AI-assisted question generation/evaluation
- administrative tooling

These should be prioritized from actual product needs rather than treated as required platform architecture.

---

# Near-term sequence

The current recommended implementation sequence is:

```text
[x] TypeScript
[x] Express app/server split

[ ] GET /health
[ ] Central 404 handling
[ ] Central error middleware
[ ] Zod environment/config validation
[ ] Pino + HTTP logging/redaction conventions
[ ] Backend test infrastructure + initial integration tests
[ ] Lint/format baseline
[ ] Backend build command
[ ] Initial CI pipeline
[ ] OpenAPI/schema-generation decision
[ ] Persistence/database decision
[ ] First real Question vertical slice
[ ] Frontend foundation
[ ] First complete frontend-to-database feature
```

At that point, stop thinking of the work primarily as "backend setup" and move toward incremental product slices.

---

# Ongoing checklist for every feature

Not every item applies to every change, but meaningful feature work should consider:

- [ ] Is the implementation consistent with existing architecture?
- [ ] Is externally supplied input validated?
- [ ] Are authentication/authorization checks required?
- [ ] Could sensitive data enter logs or responses?
- [ ] Are errors handled through established conventions?
- [ ] Does domain logic need unit tests?
- [ ] Does API behavior need integration tests?
- [ ] Does frontend behavior need component/E2E coverage?
- [ ] Is accessibility affected?
- [ ] Does the API contract/OpenAPI need updating?
- [ ] Does persistence require a migration?
- [ ] Did the change introduce a dependency that should be reviewed?
- [ ] Do local validation and CI run the relevant checks?
- [ ] Does documentation or `AGENTS.md` need updating?

The goal is not to turn every feature into a checklist exercise. The purpose is to keep cross-cutting quality, security, and operational concerns present throughout development rather than discovering them at the end.
