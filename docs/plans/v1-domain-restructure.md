# V1 domain restructure implementation plan

Status: repository implementation and approved hosted cutover complete (2026-10-13); disposable-environment concurrency/browser checks remain.

Implementation evidence is recorded in section 11. Current architecture documents now describe V1.

This plan is based on inspection of the current SQL migrations, backend operations and routes,
shared contracts and generated types, frontend flows, tests, validation scripts, and architecture
documentation. It describes the requested replacement architecture. The existing architecture
documents describe the implementation being replaced.

## Scope and accepted decisions

- Questions and quizzes become direct content records with private/public access and no content
  versions, review requirements, or publication lifecycle.
- Ordinary users create private questions and personal quizzes. Public content remains
  representable for future controlled course/editor authoring; that authoring system is deferred.
- Courses and lessons become first-class public learning content. Lessons belong to one course;
  quizzes can be reused across lessons and courses through explicit associations.
- Keep attempts, deterministic grading, feedback, tags, authentication, and existing batch import.
- Remove the current review, publication, agent, and generalized work-item infrastructure entirely.
  A future orchestration layer may operate on core entities without embedding workflow state in them.
- Existing application data is disposable. No legacy conversion, backfill, compatibility,
  provenance retention, or real upgrade migration is required.
- Preserve the established test user's Supabase Auth account and matching application profile.
  No question, quiz, attempt, feedback, tag, batch, or workflow data needs to survive.
- This document authorizes planning only. Saving it does not implement the restructure or execute
  a database reset.

## 1. Current-state findings

The six files in `supabase/migrations/` create 23 application tables:

- `20260928174208_initial_schema.sql`
- `20260930120000_question_publication.sql`
- `20260930160000_human_review_workflow.sql`
- `20260930190000_agent_creation.sql`
- `20260930220000_agent_review_gate.sql`
- `20261001010000_question_batch_ingestion.sql`

### Conflicts with the target

| Current implementation                                                                            | Conflict                                                                                       |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `questions.current_version_id`, `default_published_version_id`, `question_versions`               | Content is versioned, with separate current candidate and published content.                   |
| `quizzes.current_version_id`, `quiz_versions`, `quiz_version_questions`                           | Quiz content and composition are versioned; membership pins `question_version_id`.             |
| `content_visibility = private/unlisted/public`                                                    | V1 permits private/public access only.                                                         |
| `content_status = draft/published/archived`                                                       | Lifecycle and publication control selection and attempts. Remove these fields and transitions. |
| `question_publication_events`                                                                     | Publication evidence is required to select exact question versions.                            |
| `question_review_submissions`, `question_review_decisions`, `question_publication_gate_decisions` | Persist review policy, approval, rejection, change requests, and gate decisions.               |
| `work_items`, `work_item_events`                                                                  | Persist queue routing, assignments, claims, leases, retries, cancellation, and events.         |
| `agent_actors`, `agent_generation_runs`, `agent_execution_runs`, question/version agent pointers  | Current agent functionality depends on work items, review, publication, and versions.          |
| No `courses`, `lessons`, or `lesson_quizzes`                                                      | The target course hierarchy does not exist.                                                    |

### Coupling that must be addressed

- `backend/src/db/question-bank.ts` creates immutable versions, cancels superseded work, and
  blocks direct publication of imported, agent-origin, or review-submitted questions.
- `backend/src/db/quizzes.ts` resolves versions, compares content to decide whether to create a
  version, and requires exact-version publication evidence for new membership. It currently permits
  public quizzes containing private questions owned by the quiz creator. There is no enforcement of
  the target public-quiz/public-question invariant.
- `backend/src/db/attempts.ts` snapshots question content, answer configuration, grading, settings,
  and points, but still reads quiz title, required flags, and timing from version tables.
- `backend/src/db/feedback.ts` resolves attempted-question feedback recipients through membership
  and quiz-version joins. Its content access checks also depend on publication and unlisted access.
- Batch ingestion is an existing import feature inside `routes/content-workflow.ts`. Its item
  mappings expose first/current version IDs, and imported questions require review before use.
- Backend domain operations and persistence mostly coexist in `backend/src/db/`; there is no
  separate service/repository hierarchy that needs to be preserved.
- `shared/src/index.ts` exposes current/published version DTOs, work-item contracts, lifecycle,
  publication bodies, agent provenance, and version identifiers in composition and snapshots.
- Frontend question management separates candidates from published bank content. Question and quiz
  pages display history and version controls; creation offers public/unlisted visibility. The work
  queue and agent creation have dedicated pages. Batch upload includes review submission.
- Schema scripts and pgTAP checks hard-code the 23 tables, version FKs, workflow provenance, and
  trigger counts. OpenAPI independently enumerates the HTTP operations.
- RLS is enabled without direct Data API policies. The verified Express API is the application
  authorization boundary; preserve this boundary.

Feedback triage (`open/reviewed/resolved/dismissed`) and reviewing completed attempt results are
separate existing behaviors. They do not approve content or gate publication and remain in V1.

## 2. Target schema and integrity rules

Use SQL migrations as schema truth, parameterized `pg` queries, transactional mutations, generated
database types, and Zod validation. No new production dependency is required.

| Table                                | Final fields and relationships                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                           | Preserve existing identity, metadata, and timestamps; `id` remains the Supabase Auth UUID.                                                                                                                                                                    |
| `questions`                          | `id`, `created_by` FK to profiles, private/public `visibility`, `prompt`, `question_type`, `answer_config`, `grading_config`, nullable `explanation`, `created_at`, `updated_at`, nullable irreversible `content_locked_at`.                                  |
| `quizzes`                            | `id`, `created_by` FK to profiles, private/public `visibility`, `title`, nullable `description`, `settings`, `created_at`, `updated_at`.                                                                                                                      |
| `quiz_questions`                     | `id`, required `quiz_id` and `question_id` FKs, `position`, numeric `points`, `required`, nullable `time_limit_seconds`.                                                                                                                                      |
| `quiz_attempts`                      | Preserve identity, `user_id`, attempt status, timestamps, settings snapshot, and score summary. Use required `quiz_id` FK and immutable `quiz_title_snapshot`; no version FK.                                                                                 |
| `quiz_attempt_questions`             | Preserve identity, attempt FK, position, question/answer/grading snapshots, response, evaluation, timestamps, time spent, and points. Use required `question_id` FK and immutable `required`/`time_limit_seconds` snapshot columns; no version-membership FK. |
| `courses`                            | UUID `id`, nonblank `title`, nullable `description`, `created_at`, `updated_at`. Public by definition.                                                                                                                                                        |
| `lessons`                            | UUID `id`, required `course_id` FK, nonblank `title`, nullable `description`, plain-text/Markdown `content`, nonnegative `position`, timestamps.                                                                                                              |
| `lesson_quizzes`                     | Required `lesson_id` and `quiz_id` FKs; nonnegative `position`.                                                                                                                                                                                               |
| `tags`, `question_tags`, `quiz_tags` | Preserve existing owner-scoped tags and entity associations.                                                                                                                                                                                                  |
| `feedback`                           | Preserve existing explicit target FKs, categories, status, comment, submitter, and timestamps.                                                                                                                                                                |
| `question_batches`                   | Preserve sponsor, retained artifact, digest, idempotency key, and creation timestamp.                                                                                                                                                                         |
| `question_batch_items`               | Preserve batch/key/position/question mapping and timestamp; remove `question_version_id`.                                                                                                                                                                     |

Courses and lessons need no creator, permission, draft, review, or editor fields in this phase's
read-only API. Content can be supplied through trusted fixtures or repository-controlled seeds.

### Constraints

- `UNIQUE(quiz_id, position)` for quiz composition. Preserve the existing ability to repeat a
  question at different positions; current contracts do not prohibit repetition.
- `UNIQUE(course_id, position)` for lesson ordering.
- `PRIMARY KEY(lesson_id, quiz_id)` and `UNIQUE(lesson_id, position)` for lesson associations.
- Every lesson belongs to exactly one course. Moving it changes `course_id` and position atomically.
  There is no course/lesson join table.
- A public quiz contains only public questions.
- A private quiz contains only its creator's private questions or public questions.
- A quiz associated with any lesson is public. Reject any visibility change that invalidates this
  relationship or the public-question requirement.
- Enforce cross-table invariants through transactional checks and database triggers, covering both
  association writes and invalidating updates to referenced entities.
- No `lesson_id` or `course_id` on quizzes; no direct course/question or lesson/question links.
- Preserve numeric nonnegative points, positive optional timing, JSONB checks, exactly-one feedback
  target, owner-scoped tag slug uniqueness, and batch idempotency/mapping uniqueness.
- Keep RLS enabled on retained/new tables without browser policies. Use restrictive deletion for
  referenced content; do not add content deletion endpoints in this phase.

### Immutability

- Substantive question content is editable only before use. First inclusion in a quiz permanently
  sets `content_locked_at`, even if the question is later removed from that quiz. Prompt, type,
  answer configuration, grading configuration, and explanation are substantive fields.
- `content_locked_at` is an integrity marker, not review or workflow state. It cannot be cleared.
- Any quiz attempt freezes title, description, settings, and composition. In-progress, completed,
  abandoned, and expired attempts all count. Preserve attempts so the lock cannot be evaded.
- Tags remain editable under ownership checks. Access changes must preserve relational invariants;
  ordinary-user APIs will not expose visibility changes.
- Ordinary users cannot create, promote, or substantively edit public content in this phase.
- After a content lock, use ordinary creation endpoints to create independent replacement records.
  Do not introduce version numbers, revision chains, current pointers, or hidden version tables.
- Attempt snapshots are historical evidence. Load and grade from snapshots rather than rebuilding
  presentation from mutable source content.

## 3. Database replacement strategy

The user has confirmed all application data is disposable, except the established test account.
Replace the six existing migrations with a clean V1 baseline. Do not implement legacy mapping,
backfill, upgrade compatibility, audit export, or migration tests for historical versions.

Execution procedure:

1. Build and validate the clean baseline against a fresh disposable database, using an Auth table
   stub for PGlite and the real local Supabase stack for full schema/type checks.
2. Stop API and content-worker writes before replacing any existing application schema.
3. Identify and preserve the established test Auth account and its matching profile. Do not inspect
   authentication secrets. Prefer leaving Auth rows and retained profile rows untouched rather than
   exporting credentials or password data.
4. Rebuild only application tables/types/functions/triggers in explicit dependency order. Clear
   content, attempts, feedback, tags, batch artifacts, queue records, decisions, and agent data.
   Keep Supabase-managed Auth infrastructure intact.
5. Apply the V1 baseline through a coordinated schema rebuild. Existing databases with recorded old
   migrations require an explicit rebuild procedure; replacing migration files is not an upgrade
   operation and must not be presented as one.
6. Verify the preserved test account can sign in and resolves the same profile UUID. Confirm the
   schema is clean and the application starts against the new contracts.

Avoid a blanket `supabase db reset` unless preserving the established account is demonstrated first.
Application data deletion is accepted scope for the later implementation; external database writes
still require the authorization applicable to that environment.

Remove all version/review/publication/agent/queue tables and their dependent pointers, constraints,
indexes, and triggers. Keep the immutable-row helper if batch artifact/mapping triggers use it.
Replace version-dependent attempt guards with guards on direct identity and immutable snapshots.

The destructive risk is accidental loss of the established account or its profile, rather than loss
of content data. No backward compatibility is required; coordinate the schema/API/frontend cutover.

## 4. Backend and API changes

All domain paths below use `/api/v1`.

| Classification | Endpoints                                                                                                                              | Planned behavior                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Keep unchanged | `GET /me`; operational `/health` and backend `/`; `GET/POST /tags`                                                                     | Preserve verified authentication, profiles, health, and owner-scoped tags.                                                                |
| Modify         | `GET /questions/mine`                                                                                                                  | List caller-owned direct question records without publication filtering.                                                                  |
| Modify         | `GET /questions/:questionId`                                                                                                           | Unified owner/public access by ID; direct content DTO.                                                                                    |
| Modify         | `POST /questions`                                                                                                                      | Create private questions; reject visibility, lifecycle, and version inputs.                                                               |
| Modify         | Question and quiz `PUT/DELETE .../tags/:tagId`                                                                                         | Preserve entity/tag ownership checks and simplify returned DTOs.                                                                          |
| Remove         | `GET /questions`                                                                                                                       | Delete public-bank browsing. Personal selection uses the owner list.                                                                      |
| Remove         | `GET /questions/:questionId/manage`                                                                                                    | No separate candidate-management detail is needed.                                                                                        |
| Remove         | Question `GET/POST .../versions`; `GET .../published-versions`                                                                         | Delete version APIs entirely.                                                                                                             |
| Remove         | Question `PATCH /:questionId`                                                                                                          | Currently only changes visibility; ordinary users cannot promote content.                                                                 |
| Remove         | Question `POST .../publish`, `/unpublish`, `/archive`, `/restore`                                                                      | Delete publication/lifecycle operations.                                                                                                  |
| Modify         | `GET /quizzes`, `GET /quizzes/:quizId`                                                                                                 | Direct DTOs; preserve owner/public access, list scope, and pagination without lifecycle/unlisted rules.                                   |
| Modify         | `POST /quizzes`                                                                                                                        | Private personal creation; composition accepts question IDs only.                                                                         |
| Modify         | `PUT /quizzes/:quizId/content`                                                                                                         | Transactional direct content/composition updates before attempts; reject substantive changes afterward. Equivalent saves remain harmless. |
| Remove         | Quiz `GET .../versions`, `PATCH /:quizId`, `POST .../publish`, `/archive`                                                              | Delete version history and visibility/lifecycle authoring.                                                                                |
| Modify         | `POST /quizzes/:quizId/attempts`                                                                                                       | Authenticated owner access to private quizzes or access to public quizzes; reject empty composition; snapshot direct content.             |
| Modify         | `GET /attempts`, `GET /attempts/:attemptId`                                                                                            | Preserve learner ownership, pagination, and history; remove version IDs and joins.                                                        |
| Keep unchanged | `PUT /attempts/:attemptId/questions/:questionId/answer`; `POST /attempts/:attemptId/complete`                                          | Preserve request semantics and grading behavior; simplify internals and returned DTOs. Path question ID remains an attempt-question ID.   |
| Modify         | `POST /feedback`, `GET /feedback/received`, `PATCH /feedback/:feedbackId`                                                              | Preserve feedback handling; replace publication/version-dependent authorization and recipient joins.                                      |
| Modify         | `POST/GET /question-batches`, `GET /question-batches/:batchId`, `POST .../materialize`                                                 | Preserve owned import, validation, digest, idempotency, and atomicity; materialize immediately usable private questions.                  |
| Remove         | `POST /agent-questions`; `POST /questions/:questionId/review-submissions`                                                              | Delete agent generation and review submission.                                                                                            |
| Remove         | `GET /work-items`; `POST /work-items/:itemId/{claim,decision,fail,hand-off,cancel}`                                                    | Delete queue endpoints without compatibility stubs.                                                                                       |
| Add            | `PUT /questions/:questionId/content`                                                                                                   | Owner-only unused private question edits; `409` for substantive changes after use.                                                        |
| Add            | `GET /courses`, `GET /courses/:courseId`, `GET /courses/:courseId/lessons`, `GET /lessons/:lessonId`, `GET /lessons/:lessonId/quizzes` | Minimal public hierarchy reads with consistent ordering.                                                                                  |

Do not expose course/lesson/association mutations over HTTP yet. There is no privileged permission
system in the repo, and ordinary-user public authoring is outside scope. Exercise creation, movement,
ordering, and association integrity through trusted fixtures and narrowly scoped internal operations.

### Operations and persistence

- Rewrite `db/question-bank.ts` and `db/quizzes.ts` around direct records. Delete version resolution,
  publication evidence, retained-version exceptions, and work supersession.
- Delete `db/content-workflow.ts` and the existing `src/agent/` implementation.
- Move batch endpoints into a dedicated router before deleting `routes/content-workflow.ts`.
- Rewrite attempt loading and completion to use immutable title, required, timing, and content
  snapshots. Preserve synchronous deterministic grading and existing response-display settings.
- Rewrite feedback joins using direct attempt/quiz/question identities. Attempted-question feedback
  remains visible to the quiz owner and source-question owner.
- Serialize content edits, composition writes, and attempt starts with consistent parent/question
  row locking. Add database guards so direct SQL cannot bypass immutability or relationship rules.
- Add course/lesson read routers and persistence operations using existing request validation,
  response validation, pagination, transaction, and error conventions.
- Update `src/openapi/document.ts`; remove obsolete operations/components and register new ones.
- Remove `worker:content`, `start:worker`, agent environment configuration, and worker instructions.

### Authorization that remains versus workflow that is deleted

Keep verified tokens, profile identity, owner mutation checks, private access restrictions,
learner-only attempt access, batch sponsorship, owner-scoped tag checks, and feedback authorization.
Invalid bearer tokens must still fail rather than being treated as anonymous requests.

Delete approval/gate checks, publication-history eligibility, provenance-based publication
restrictions, review policies, work assignment, claims, leases, retries, and queue routing. Do not
remove legitimate ownership checks simply because they appear next to this logic.

## 5. Shared contract changes

In `shared/src/index.ts`:

- Rename `QuestionVersionContent` to `QuestionContent`, preserving cross-type validation.
- Flatten question and quiz DTOs. Remove `currentVersion`, `publishedVersion`, version numbers/IDs,
  content lifecycle, and agent-origin fields.
- Replace `QuizVersionQuestion` with `QuizQuestion`; composition input uses `questionId` only.
- Remove question/quiz version schemas and responses, bank-specific DTOs, publication bodies,
  review bodies, agent-request bodies, and work-item input/result/queue contracts.
- Restrict visibility to private/public. Ordinary creation accepts neither visibility nor lifecycle.
- Remove version identifiers from attempt DTOs and question snapshots.
- Simplify batch item DTOs to key and question ID. Retain artifact `schemaVersion` as a file-format
  identifier; it is unrelated to entity content versioning.
- Add `Course`, `Lesson`, `LessonQuiz`, and list/detail schemas with UUID, timestamp, metadata,
  content, and position validation.
- Expose derived owner editability so frontend controls reflect backend locks; do not persist
  editable/review/workflow statuses.
- Preserve answer, grading, settings, response, evaluation, score, and feedback contracts where
  their behavior remains unchanged.

Regenerate `shared/src/database.types.ts` from the clean V1 database.

## 6. Frontend changes

- Delete `work-queue-page.tsx`, `agent-question-page.tsx`, their routes/navigation, queue query state,
  and associated API functions.
- Consolidate bank/owner question surfaces into My questions. Remove public-bank browsing,
  candidate/published distinctions, history, and publication/review/lifecycle controls.
- Reuse `question-editor.tsx` for creation and unused private question editing. Used questions show
  content and explain that changes require a new record.
- Simplify `quiz-editor.tsx` to select owner questions by ID. Preserve order, scoring, required
  flags, timing, and settings. Remove version selection/update actions.
- Support adding an accessible public question by known ID without public discovery UI.
- Make creation private automatically; remove visibility/status selectors.
- Disable substantive quiz editing after attempts. Preserve taking, results, history, feedback,
  and permitted tagging.
- Update `currentVersion` reads, version-based component keys, cache keys, invalidations, and copy.
- Preserve batch import while removing review buttons and draft/version language.
- Validate course structures through APIs and fixtures first. No course editor is required. Any
  optional course/lesson pages should be minimal read-only views in a separate small slice.

Do not add privileged authoring, agent workflows, review dashboards, generalized queues, or a
public question-bank discovery experience.

## 7. Test changes

### Delete intentionally obsolete behavior

- Content-workflow, agent-creation, agent-workflow, agent-upgrade, and provider-specific tests.
- `frontend/src/pages/work-queue-page.test.tsx`.
- Version-history, publication-evidence, review/gate, unlisted, and draft/archive assertions in
  mixed suites.
- Browser scenarios for version advancement and reviewed publication; replace them with V1 flows.
- Legacy version/workflow upgrade tests and historical migration fixtures. Existing content need
  not survive the schema replacement.

### Update retained coverage

- Backend question-bank, quizzes, attempts, feedback, batches, and core HTTP/database suites.
- Frontend question/quiz management, batch, attempt-flow, router/auth, and contract-boundary suites.
- Shared contracts, OpenAPI, migration checker, hosted schema checker, and pgTAP checks.
- Keep evaluator, invalid-answer, fractional scoring, rollback, token verification, and feedback
  authorization coverage.

### Add required coverage

- Private creation and rejection of ordinary-user public creation/promotion.
- Owner/public reads, foreign-private exclusion, and public-quiz/public-question enforcement.
- Permanent question lock after first use, including after composition removal.
- Quiz content/composition lock after every attempt status; equivalent saves remain harmless.
- Attempt snapshots remain immutable and self-contained, including title, required flags, timing,
  grading, points, response-display settings, and historical results.
- Creating independent replacement questions/quizzes leaves earlier attempts unchanged.
- Required course FK, lesson movement, ordering collisions, cross-course quiz reuse, private quiz
  association rejection, and invalidating visibility-change rejection.
- Import without review while preserving sponsor access, digest/idempotency, bounds, and rollback.
- Removed endpoints are absent and return the normal not-found response.
- Real PostgreSQL races for edit-versus-use and quiz-save-versus-attempt-start, plus concurrent
  answer submission. PGlite alone does not establish row-lock correctness.
- Fresh schema creation and established test-account/profile preservation during the rebuild.

## 8. Documentation changes

Rewrite `architecture-plan.md` and affected architecture domain/data/API/runtime/quality views.

- Supersede ADR-001 and ADR-004 through ADR-007 with the direct-record, immutability, and deferred
  orchestration decision.
- Revise ADR-002 access rules while retaining its API authorization boundary.
- Retain ADR-003's snapshot/evaluation approach.
- Supersede ADR-008's version/review provisions while retaining batch artifact integrity.
- Replace publication/review/agent runtime views. Rewrite quiz-save and attempt views, and simplify
  batch ingestion.
- Update root/backend/frontend READMEs, API examples/conventions, `AGENTS.md` implementation
  descriptions, use cases, and `docs/use-case-tests.json`.
- Mark old workflow/seeding/closeout plans as superseded wherever they prescribe obsolete behavior.
- Replace `backend/scripts/check-batch-bank.js` and its command with private-import integrity
  verification; the current script requires public discovery and published-version APIs.
- Document the clean schema rebuild and account-preservation procedure. Do not describe it as a
  lossless upgrade or retain compatibility steps.
- Describe future `WorkItem -> operation on Question / Quiz / Lesson / Course` only as an additive
  direction. Leave no dormant queue or workflow fields in V1.

## 9. Recommended execution order and validation

1. Record the replacement architecture decision and prepare a targeted rebuild procedure that
   preserves the established Auth account/profile.
2. Replace old migrations with the clean baseline, direct relationships, visibility/immutability
   guards, courses, lessons, associations, and simplified batch mappings. Validate fresh creation.
3. Regenerate DB types and replace shared contracts; build the shared package.
4. Rewrite question/quiz persistence and locking. Update their routes and focused tests.
5. Rewrite attempts and feedback against direct identities and complete snapshots.
6. Separate and simplify batches. Remove workflow/agent code, APIs, contracts, tests, and commands.
7. Add course/lesson/association integrity coverage and read APIs. Update OpenAPI.
8. Update frontend flows and remove obsolete screens, state, and tests.
9. Complete documentation, validation scripts, and integrated/browser/concurrency coverage.
10. Inspect the final diff and run required checks. Coordinate schema/API/frontend cutover, verify
    test-account sign-in, and report any environment-dependent validation that could not run.

No production dependencies need to be added or changed. Follow established npm lockfiles and
Node.js 24 conventions.

Relevant validation commands:

- Root: `npm ci`, `npm run typecheck:shared`, `npm run test:shared`, `npm run build:shared`,
  `npm run db:check-schema`, `npm run check:use-cases`, and relevant formatting checks.
- Backend: typecheck, lint, formatting, tests, `openapi:check`, and build.
- Frontend: typecheck, lint, formatting, tests, and build.
- With the required environments: local Supabase `db:test`, generated-type consistency,
  frontend `test:e2e`, and PostgreSQL concurrency tests using `TEST_DATABASE_URL` pointing to the
  dedicated local test database.

Do not run a destructive test/reset procedure against the database containing the preserved account.
Use a disposable test database for schema and concurrency validation.

## 10. Open decisions

None remain for finalizing this plan. Existing data can be discarded, the established test account
must be preserved, ordinary creation remains private, and public authoring/orchestration are deferred.
The exact account identity and database rebuild mechanics are implementation preflight details,
not unresolved domain decisions.

## 11. Implementation and validation record (2026-10-13)

The repository cutover implements the single clean 15-table baseline, direct shared contracts and
catalog-generated types, permanent question/all-status quiz locks, immutable complete attempt
snapshot sets and closed results, public course/lesson hierarchy, retained private batch import,
rewritten persistence/routes/OpenAPI/frontend, removed worker/workflow infrastructure, and updated
architecture/ADRs/READMEs/use cases/validation/browser/concurrency tests. No production dependencies
changed and no remote Git resources were modified.

Validated locally:

- Shared: typecheck, seven contract tests, build and formatting.
- Database: fresh baseline/schema guards and RLS checks; exact Auth UUID/profile preservation in a
  transactional PGlite rebuild; generation from the clean catalog; type-shape drift detection.
- Backend: typecheck, lint, formatting, OpenAPI validation, build and 74 passing tests.
- Frontend: typecheck, lint, formatting, build and 35 passing tests.
- Use-case map: all 21 implemented entries have valid test references.
- Browser: three updated Playwright scenarios discovered; execution requires local Supabase.
- Final diff reviewed; `git diff --check` passes.

The three real PostgreSQL race tests are present and skipped because `TEST_DATABASE_URL` is unset.
Docker and PostgreSQL executables are unavailable here. Supabase pgTAP and full browser journeys remain environment-dependent; hosted type parity and
live account/API verification were completed after approval. Types were initially generated from the
clean PGlite schema and then regenerated from the live Supabase schema after the approved cutover.
The hosted Supabase table/relationship/enum parity check passes. CI repeats the parity check. The frontend build reports the existing large-chunk advisory.

The user approved the hosted application rebuild. It completed transactionally while retaining the
exact established Auth/profile UUID `2f8bb7f8-1c96-4994-9fe2-77047c68a565`; one Auth identity and one
profile survived unchanged. No local API/worker writers or active application write locks were
present before execution. The retained `remote_schema` migration contains infrastructure rather
than application table creation and remains alongside the new V1 baseline.

All seven hosted schema checks pass. Live verification corrected an enum-array cast in the check
SQL; both hosted and pgTAP checks now cast enum labels to text. Supabase types were regenerated and
the hosted generated-type parity check passes. Shared/backend/frontend typechecks and builds pass.

The established test account signed in through Supabase Auth and `/api/v1/me` returned the same UUID.
Thirty live HTTP checks verified private creation, unused edits, permanent question locks,
attempted quiz locks and equivalent saves, immutable presentation/settings/timing, deterministic
2.5/2.5 grading, required-answer enforcement, history, feedback submission/triage, private idempotent
batch materialization and removed endpoint absence. The read-only private-import integrity command
also passed. Smoke-test content remains under the test account for inspection; no other Auth account
was created.

During cutover validation, the API ran on port 3000 and Vite on port 5173. The frontend uses the
same Auth project; the sign-in page and proxied health/public-course reads passed. Both development
servers were stopped gracefully after validation at the user's request. Full Playwright journeys and the
three real PostgreSQL concurrency tests still require a disposable test environment. The
[application rebuild procedure](v1-schema-rebuild.md) now records the completed cutover; no further
hosted rebuild is needed.

The final full test run passed all seven shared, 74 backend and 35 frontend tests (116 total).
Three PostgreSQL concurrency tests remained skipped because `TEST_DATABASE_URL` was unset.
Supabase SQL tests could not connect to the missing local stack; Playwright could not start while
the development ports were occupied, and its separate local-Supabase startup prerequisite also
failed. Typechecks, lint, formatting, OpenAPI, schema checks and hosted type parity passed. No test
runner or content worker remains running.
