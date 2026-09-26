# Quiz Builder — Architecture & Implementation Plan

## 1. Goal

Build `quiz-builder`, a full-stack TypeScript application with two primary capabilities:

### Quiz Management

Users can:

- create reusable questions
- create new versions of questions
- organize questions with tags
- create quizzes from question versions
- version quizzes as their contents change
- control ownership, visibility, and lifecycle
- review feedback

### Quiz Taking

Users can:

- start a quiz attempt
- answer questions one at a time
- submit deterministic answers
- receive evaluations and scores
- review results
- review attempt history
- submit feedback

The initial system should optimize for correctness, historical consistency, type safety, testability, and a clean path to later LLM-based evaluation.

---

# 2. Core Architecture

## Frontend

- React
- Vite
- TypeScript
- TanStack Router
- TanStack Query
- Supabase Auth client
- shared Zod schemas
- modern vanilla CSS
- CSS Modules for component-specific styles
- global CSS for reset, tokens, typography, and layout

## Backend

- Node.js
- Express v5
- TypeScript
- Zod runtime validation
- OpenAPI generated from API Zod schemas
- Supabase JWT verification
- Pino structured logging
- standard PostgreSQL driver, preferably `pg`
- connection pooling appropriate to the Supabase deployment
- parameterized SQL
- explicit transactions for multi-step operations
- no ORM

## Database

- Supabase Postgres
- Supabase Auth
- SQL migrations are the source of database schema truth
- Supabase-generated TypeScript database types
- JSONB for structured configuration/snapshot data
- database constraints and foreign keys wherever practical

---

# 3. Type-Safety Model

Use different tools for different boundaries.

```txt
SQL migrations
    ↓
Postgres schema
    ↓
Supabase-generated TypeScript DB types
    ↓
repository/database layer

Zod schemas
    ↓
runtime domain/API validation
    ↓
shared frontend/backend TypeScript types
```

Rules:

- SQL migrations define database structure.
- Supabase-generated types describe rows/inserts/updates.
- Zod validates API payloads and JSONB structures.
- `z.infer` provides shared domain/API TypeScript types.
- Raw database rows should not automatically become API contracts.
- JSONB values must be validated before use.
- All SQL must be parameterized.
- Multi-step mutations requiring consistency must use DB transactions.

Raw SQL itself is not compile-time type checked merely because generated DB types exist. Repository code should explicitly type/query/map results and validate complex structures where appropriate.

---

# 4. Authentication and User Identity

Use Supabase Auth.

`auth.users.id` is the canonical authenticated user UUID.

Application profiles use the exact same ID:

```txt
profiles.id = auth.users.id
```

Therefore fields such as:

```txt
created_by
user_id
submitted_by
```

contain the Supabase Auth user UUID directly.

No separate application user-ID translation layer is required.

---

# 5. Ownership, Visibility, and Lifecycle

Questions and quizzes use the same three concepts:

```txt
created_by → ownership
visibility → access/discovery
status     → lifecycle
```

## Visibility

```txt
private
unlisted
public
```

### Question visibility

Question visibility determines whether a question is available through the **question bank** for inclusion in quizzes.

- `private`: only owner can browse/use it
- `unlisted`: available when explicitly referenced/shared, but not discoverable
- `public`: discoverable and available to permitted users through the question bank

Question visibility does **not** determine whether an existing quiz containing that question may be attempted.

### Quiz visibility

Quiz visibility determines whether the quiz may be **attempted**.

- `private`: owner only
- `unlisted`: attemptable when its ID/link is known, but not discoverable
- `public`: attemptable and discoverable

An accessible quiz may present the question content stored in its quiz version even if the source question is no longer independently visible in the question bank.

There is no visibility inheritance between quizzes and questions.

## Lifecycle status

```txt
draft
published
archived
```

Visibility and lifecycle are separate concerns.

---

# 6. Versioning Invariants

Versioning is a core architectural feature.

## Question versioning

`questions` represents stable question identity.

`question_versions` represents immutable question content.

Versioned content includes:

- prompt
- question type
- answer configuration
- grading configuration
- explanation

Changing versioned question content creates a new `question_versions` row.

Existing versions are immutable.

Changing non-versioned metadata such as:

- visibility
- status
- tags

does not create a question version.

### Initial question creation

Because `questions.current_version_id` references a version that cannot exist before the question itself, creation must occur transactionally:

```txt
BEGIN

insert question with current_version_id = null

insert question_version

update question.current_version_id

COMMIT
```

---

## Quiz versioning

`quizzes` represents stable quiz identity.

`quiz_versions` represents immutable quiz content.

Versioned quiz content includes all attempt-relevant content:

- title
- description
- quiz settings
- ordered included questions
- exact `question_version_id` for every included question
- points
- required/optional state
- per-question timing/configuration

`quiz_version_questions` contains the ordered membership for each quiz version.

Changing tags, visibility, status, or ownership does not create a quiz version.

### Quiz-version creation rule

Saving a quiz does **not automatically create a version**.

The backend compares the submitted quiz content against the current quiz version.

If equivalent:

```txt
no new quiz version
```

If attempt-relevant content differs:

```txt
create new quiz_version
create corresponding quiz_version_questions
update quizzes.current_version_id
```

This operation must be transactional.

Examples that create a new quiz version:

- adding a question
- removing a question
- reordering questions
- updating a quiz question to a newer question version
- changing points
- changing required status
- changing question-level timing
- changing quiz settings
- changing other attempt-relevant quiz content

The backend is authoritative for determining whether content changed.

The frontend may detect obvious no-op saves for UX/performance, but correctness cannot depend on frontend comparison.

### Question updates do not mutate quizzes

A fundamental invariant:

```txt
quiz_version_questions always reference an explicit question_version_id.
```

Therefore:

```txt
editing a source question
does NOT
change an existing quiz version
```

The quiz owner may explicitly replace a referenced question version with a newer one.

That action creates a new quiz version.

### Historical stability

Both question versions and quiz versions are immutable.

Existing quiz attempts remain historically correct even after future question or quiz edits.

---

# 7. Scoring Model

Scores and points are numeric and may be fractional.

Do not impose a percentage, integer-only, or normalized scoring model.

Examples:

```txt
1
2.5
0.25
10
```

The quiz author determines how points are distributed.

Each attempted question records:

```txt
points_possible
points_awarded
```

The quiz result may aggregate those values into a total.

Specific grading strategies decide how many points are awarded.

No general partial-credit policy should be imposed at the architecture level.

---

# 8. V1 Question Types

V1 supports:

```txt
exact_text
multiple_choice_single
multiple_choice_multi
```

A future fuzzy/LLM question type should **not be exposed for authoring or quiz use until its evaluator is implemented**.

This prevents valid quizzes from containing questions the system cannot evaluate.

---

# 9. Core V1 Data Model

## `profiles`

```txt
id uuid PK → auth.users(id)
display_name
avatar_url nullable
created_at
updated_at
```

---

## `questions`

Stable identity and ownership.

```txt
id uuid PK
created_by uuid FK → profiles(id)
current_version_id uuid nullable FK → question_versions(id)
visibility
status
created_at
updated_at
```

---

## `question_versions`

Immutable content.

```txt
id uuid PK
question_id uuid FK → questions(id)
version_number integer
prompt text
question_type
answer_config jsonb
grading_config jsonb
explanation nullable
created_by uuid FK → profiles(id)
created_at
```

Constraint:

```txt
UNIQUE(question_id, version_number)
```

---

## `quizzes`

Stable identity and metadata.

```txt
id uuid PK
created_by uuid FK → profiles(id)
current_version_id uuid nullable FK → quiz_versions(id)
visibility
status
created_at
updated_at
```

---

## `quiz_versions`

Immutable attempt-relevant quiz content.

```txt
id uuid PK
quiz_id uuid FK → quizzes(id)
version_number integer
title text
description nullable
settings jsonb
created_by uuid FK → profiles(id)
created_at
```

Constraint:

```txt
UNIQUE(quiz_id, version_number)
```

---

## `quiz_version_questions`

Ordered question membership for a specific quiz version.

```txt
id uuid PK
quiz_version_id uuid FK → quiz_versions(id)
question_id uuid FK → questions(id)
question_version_id uuid FK → question_versions(id)
position integer
points numeric
required boolean
time_limit_seconds nullable
```

Constraints should prevent:

- duplicate positions within one quiz version
- invalid version/question relationships

The referenced `question_version_id` must belong to `question_id`.

---

## `tags`

V1 tags are user-scoped.

```txt
id uuid PK
created_by uuid FK → profiles(id)
name text
slug text
created_at
```

Constraint:

```txt
UNIQUE(created_by, slug)
```

---

## `question_tags`

```txt
question_id uuid FK → questions(id)
tag_id uuid FK → tags(id)

PRIMARY KEY(question_id, tag_id)
```

---

## `quiz_tags`

```txt
quiz_id uuid FK → quizzes(id)
tag_id uuid FK → tags(id)

PRIMARY KEY(quiz_id, tag_id)
```

Tags belong to stable entities rather than individual versions.

Changing tags does not create a new version.

---

## `quiz_attempts`

Represents one user taking one immutable quiz version.

```txt
id uuid PK
quiz_version_id uuid FK → quiz_versions(id)
user_id uuid FK → profiles(id)
status
started_at
completed_at nullable
settings_snapshot jsonb
score_summary jsonb nullable
```

Statuses:

```txt
in_progress
completed
abandoned
expired
```

---

## `quiz_attempt_questions`

Represents one presented question in one attempt.

```txt
id uuid PK
quiz_attempt_id uuid FK → quiz_attempts(id)
quiz_version_question_id uuid FK → quiz_version_questions(id)
position integer

question_snapshot jsonb
answer_snapshot jsonb
grading_snapshot jsonb

user_response jsonb nullable
evaluation_result jsonb nullable

started_at nullable
answered_at nullable
time_spent_ms nullable

points_possible numeric
points_awarded numeric nullable
```

Snapshots are immutable historical records.

They must never be reconstructed from current question data after the attempt begins.

---

## `feedback`

Use explicit nullable foreign keys instead of polymorphic `target_type + target_id`.

```txt
id uuid PK
submitted_by uuid FK → profiles(id)

question_id uuid nullable FK → questions(id)
quiz_id uuid nullable FK → quizzes(id)
quiz_attempt_question_id uuid nullable FK → quiz_attempt_questions(id)

category
comment
status

created_at
reviewed_at nullable
```

Add a DB `CHECK` constraint requiring **exactly one** target:

```txt
exactly one of:

question_id
quiz_id
quiz_attempt_question_id

must be non-null
```

Categories:

```txt
incorrect_answer
ambiguous_question
typo
bad_choices
unfair_grading
too_easy
too_hard
other
```

Statuses:

```txt
open
reviewed
resolved
dismissed
```

---

# 10. V1 Response and Evaluation Storage

For v1:

```txt
quiz_attempt_questions.user_response JSONB
quiz_attempt_questions.evaluation_result JSONB
```

These structures must have Zod schemas.

Separate response/evaluation tables are intentionally deferred but remain core future work.

---

# 11. Authorization Rule

Authorization must be implemented during each feature phase rather than added afterward.

Every protected mutation must verify ownership or other permitted access.

Every protected read must enforce visibility/access rules.

A final security phase audits these behaviors but is not the first time they are implemented.

Backend authorization is the primary v1 enforcement boundary.

RLS may be added as defense-in-depth but is not required to duplicate every Express authorization rule in v1.

---

# 12. Implementation Phases

# Phase 0 — Repository and Tooling Baseline

## Goal

Establish a runnable full-stack TypeScript project.

## Implement

- React + Vite frontend
- Express v5 backend
- shared TypeScript/Zod package or module
- TypeScript configuration
- linting/formatting
- unit/integration test framework
- environment configuration
- local development commands
- Docker/local-development baseline if required
- CI skeleton

## Verify

- frontend starts
- backend starts
- typecheck passes
- lint passes
- tests execute
- environment setup is documented

---

# Phase 1 — Persistence and Shared Contracts

## Goal

Implement the core domain schema and shared runtime contracts.

## Implement

SQL migrations for:

```txt
profiles
questions
question_versions
quizzes
quiz_versions
quiz_version_questions
tags
question_tags
quiz_tags
quiz_attempts
quiz_attempt_questions
feedback
```

Also implement:

- indexes
- foreign keys
- check constraints
- version uniqueness
- feedback exactly-one-target constraint
- Supabase-generated DB types
- shared Zod enum schemas
- answer config schemas
- grading config schemas
- quiz settings schema
- snapshot schemas
- user response schemas
- evaluation result schemas

## Verify

- database can be created from zero using migrations
- generated types succeed
- JSONB contracts have runtime validation
- schema constraints have automated tests where practical

---

# Phase 2 — Backend Platform and Authentication

## Goal

Create the reusable backend infrastructure.

## Implement

- Express application bootstrap
- `/api/v1`
- PostgreSQL pool/client
- transaction helper
- request IDs
- Pino logging
- centralized error handling
- standard error response
- Zod request/response validation
- Supabase JWT verification
- profile creation/upsert
- current-user endpoint
- OpenAPI generation from Zod-backed API contracts

Example error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body.",
    "details": []
  }
}
```

## Verify

- authenticated requests resolve user identity
- invalid JWTs fail
- validation errors have consistent responses
- database transactions work
- request logs contain correlation IDs

---

# Phase 3 — Question Bank and Tags

## Goal

Implement reusable, immutable-versioned questions.

## Implement

Question operations:

```txt
list questions
get question
create question + initial version
create new question version
update question metadata
archive question
```

Tag operations:

```txt
create/list tags
assign/remove question tags
filter question bank by tags
```

Enforce:

- ownership
- visibility
- lifecycle
- immutable versions
- transactional initial creation
- Zod validation of answer/grading configuration

## Verify

Integration tests should cover:

```txt
create
→ create version
→ retrieve current version
→ preserve previous version
→ metadata update without version creation
→ authorization/visibility
```

---

# Phase 4 — Quiz Management and Versioning

## Goal

Implement immutable quiz versions and explicit question-version membership.

## Implement

Quiz operations:

```txt
create quiz
get/list quizzes
edit quiz content
publish/archive
update visibility
tag quiz
```

Quiz save operation must:

1. validate submitted quiz content
2. canonicalize content for comparison
3. load current version
4. determine whether attempt-relevant content changed
5. return existing version for a no-op save
6. transactionally create a new version when changed
7. create its `quiz_version_questions`
8. update `quizzes.current_version_id`

Question membership must reference explicit `question_version_id`.

Never silently advance a quiz when a question receives a new version.

## Verify

Tests should cover:

```txt
no-op save → no new version

add question → new version

remove question → new version

reorder → new version

change points → new version

change quiz settings → new version

update referenced question version → new version

edit source question only → existing quiz unchanged

change visibility/tags/status → no new content version
```

Also test ownership and visibility.

---

# Phase 5 — Deterministic Evaluation and Quiz Attempts

## Goal

Implement the complete backend quiz-taking flow.

## Implement

Evaluators for:

```txt
exact_text
multiple_choice_single
multiple_choice_multi
```

Create a common evaluator contract.

Implement:

```txt
start attempt
load attempt
submit answer
evaluate answer
complete attempt
retrieve results
list attempt history
```

Starting an attempt must:

1. resolve the exact current `quiz_version`
2. create `quiz_attempt`
3. copy its `quiz_version_questions`
4. create immutable attempt-question snapshots

Submitting an answer must:

1. validate response
2. select appropriate evaluator
3. calculate numeric points
4. save response
5. save evaluation result

Completing an attempt must calculate summary values from recorded question results.

## Verify

Test:

```txt
published quiz
→ start attempt
→ snapshots created
→ submit answers
→ evaluate
→ complete
→ retrieve historical results
```

Modify the source quiz/question afterward and verify old results do not change.

---

# Phase 6 — Feedback

## Goal

Implement feedback with strong relational integrity.

## Implement

- submit question feedback
- submit quiz feedback
- submit attempted-question feedback
- retrieve feedback relevant to owned content
- update feedback status

Enforce exactly one target per feedback row.

## Verify

Test valid target types, invalid multiple targets, invalid zero targets, ownership, and feedback review.

---

# Phase 7 — Frontend Foundation and Question Management

## Goal

Establish frontend architecture while implementing the first complete management feature.

## Implement

Foundation:

- TanStack Router
- TanStack Query
- Supabase Auth
- authenticated API client
- shared Zod contracts
- app shell/navigation
- common loading/error states
- CSS foundation

Question management:

- question-bank list
- filters
- tags
- question creation
- type-specific forms
- question editing/version creation
- visibility/status controls

## Verify

Component/integration tests cover major management paths.

Frontend validation and backend validation should use compatible shared schemas.

---

# Phase 8 — Quiz Management UI

## Goal

Provide a complete quiz-builder interface.

## Implement

- quiz list
- create quiz
- edit quiz
- question-bank picker
- explicit question-version selection/update
- add/remove questions
- reorder questions
- scoring controls
- settings
- tags
- visibility
- publish/archive
- save/no-op behavior

UI should make version-affecting changes understandable without requiring users to manage version numbers manually.

## Verify

Frontend integration tests cover quiz editing and saving.

At least one test must verify a no-op save does not create unnecessary versions.

---

# Phase 9 — Quiz Taking, Results, History, and Feedback UI

## Goal

Complete the primary learner workflow.

## Implement

- quiz landing/start
- one-question-at-a-time presentation
- exact-text response
- single-choice response
- multi-choice response
- answer submission
- attempt recovery after refresh
- quiz completion
- result summary
- per-question review
- attempt history
- answer visibility rules
- feedback submission

## Verify

Cover the complete frontend flow with integration tests.

---

# Phase 10 — Security, E2E, CI, and Stabilization

## Goal

Validate the application as an integrated system.

## Authorization audit

Verify:

- owner mutations
- non-owner mutation denial
- private question-bank access
- unlisted question-bank access
- public question-bank access
- private quiz attempt restrictions
- unlisted quiz attempt behavior
- public quiz attempt behavior
- attempts restricted to their users
- feedback access rules

## E2E

At minimum, Playwright should cover:

```txt
sign in
→ create question
→ create quiz
→ add question
→ publish
→ start attempt
→ answer
→ complete
→ inspect results
```

Add a versioning E2E/integration scenario:

```txt
create quiz
→ save version 1
→ edit source question
→ verify quiz unchanged
→ explicitly update quiz question version
→ save quiz version 2
→ verify previous attempt still reflects version 1
```

## CI

Run:

- lint
- typecheck
- unit tests
- integration tests
- E2E tests as appropriate
- migration validation
- generated-type consistency check if practical

## Stabilization

Review:

- SQL indexes
- transaction boundaries
- logging
- error handling
- accessibility
- responsive layout
- auth/session failure behavior
- attempt recovery
- known limitations

---

# 13. Future Core Work

The following features are intentionally beyond v1 but should be preserved as known architectural extensions.

| Future work | Purpose |
|---|---|
| `user_responses` table | Multiple submissions, revisions, autosave history, response analytics |
| `evaluation_results` table | Regrading, evaluator history, auditability, manual grading |
| LLM/fuzzy evaluator | Rubric-based free-text evaluation with provider abstraction |
| Manual grading | Human review of responses without requiring queue infrastructure |
| Workspaces/organizations | Shared ownership and collaborative question/quiz libraries |
| Public profiles/community | Creator pages, public discovery, sharing/social functionality |
| Advanced tags | Hierarchies, aliases, curated/global taxonomies |
| Search | Postgres full-text search and richer discovery |
| Analytics | Difficulty, distractor selection, timing, completion, progress |
| Spaced repetition | User/question review scheduling and memory state |
| Import/export | CSV, JSON, Anki, bulk workflows |
| Stronger RLS | Defense-in-depth, especially if frontend later accesses application tables directly |
| Collaboration | Shared editing, approvals, comments, moderation, version diffs |

---

# 14. Future LLM Evaluation Requirements

When fuzzy questions are introduced, implement them behind the existing evaluator abstraction.

Future concerns include:

```txt
provider abstraction
model selection
rubric schemas
prompt templates
prompt versioning
evaluation metadata
timeouts/retries
failure handling
cost controls
rate limiting
regrading
safe user-facing grading explanations
```

Do not introduce fuzzy questions into authoring until this evaluator works end-to-end.

---

# 15. Durable Domain Invariants

These rules should be treated as architectural constraints throughout implementation:

```txt
1. Questions and quizzes have stable identities.

2. Question versions are immutable.

3. Quiz versions are immutable.

4. A quiz version always references explicit question versions.

5. Editing a question never silently changes an existing quiz version.

6. A changed saved quiz creates a new version; an equivalent save does not.

7. The backend is authoritative for quiz-version change detection.

8. Quiz visibility determines whether a quiz can be attempted.

9. Question visibility determines question-bank availability.

10. Quiz access does not grant independent question-bank access.

11. Historical attempts use immutable quiz/question versions plus snapshots.

12. Ownership is represented by created_by in v1.

13. Scores and points are numeric and may be fractional.

14. Feedback has exactly one relational target.

15. All JSONB domain structures are runtime-validated.

16. Authorization is enforced as features are implemented, not postponed.

17. SQL migrations define database truth.

18. No ORM is used in v1.
```

---

# 16. Implementation Order

```txt
repository baseline
    ↓
schema + shared contracts
    ↓
backend/auth foundation
    ↓
question bank + question versions
    ↓
quiz management + quiz versions
    ↓
evaluators + quiz attempts
    ↓
feedback
    ↓
frontend question management
    ↓
frontend quiz management
    ↓
quiz taking/results/history
    ↓
security + E2E + stabilization
```

The primary v1 flow is complete when this works reliably:

```txt
create question
→ create quiz
→ save immutable quiz version
→ take quiz
→ submit answers
→ evaluate
→ view results/history
→ submit feedback
```
