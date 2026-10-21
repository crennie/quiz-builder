# Quiz Builder backend

Express verifies Supabase Auth tokens, authorizes domain access, and persists direct records through
parameterized `pg` SQL. Node.js 24 and npm are required. Run `npm ci` and `npm run build:shared` at
root, then `npm ci` here. Copy `.env.example` to ignored `.env.local` and configure `DATABASE_URL`,
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the same environment as the frontend.

## Commands

```sh
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm test
npm run openapi:check
npm run build
```

`npm start` runs built output. `npm run db:check` checks the configured connection. `test:unit` and
`test:integration` select suites. `openapi:generate` writes ignored `dist/openapi.json`. The server
closes HTTP and the database pool on termination; multi-statement mutations use `withTransaction`.

## Authentication and access

Bearer tokens are Supabase user access tokens. `getClaims()` verifies them; issuer, audience, role,
user UUID and session identity are checked. An invalid supplied token never becomes anonymous.
`GET /api/v1/me` ensures the same Auth UUID profile while preserving existing profile metadata.
Supabase owns passwords/sessions; this API never issues tokens. RLS closes browser Data API access.
Signed tokens can remain valid until expiry; live revocation checks are outside the current boundary.

Questions and quizzes permit owner/public reads, including anonymous public reads. Personal lists,
mutations, tags, batches and attempts require verified identity. Question/quiz creation is private;
public quiz authoring, promotion and substantive public edits are unavailable. Courses and lessons
are public; any signed-in user can import a course or append lessons to any existing course. Referenced content cannot be deleted through this API.

## API surface

All domain paths below use `/api/v1`. Responses are flattened direct DTOs with derived owner
`canEditContent`, never version/publication/workflow identifiers. Lists return `items`/`nextOffset`
except owner tags (`tags`) and recent batches (`batches`).

| Method/path                                                                                             | Behavior                                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| GET /questions/mine                                                                                     | Owned content; tag slug, limit and offset                                         |
| GET /questions/:questionId                                                                              | Owner/public full direct content                                                  |
| POST /questions                                                                                         | `{ "content": QuestionContent }`; private creation                                |
| PUT /questions/:questionId/content                                                                      | Owner private edits before use; substantive locked changes return 409             |
| GET/POST /tags                                                                                          | Owner-scoped labels                                                               |
| PUT/DELETE /questions/:questionId/tags/:tagId                                                           | Entity/tag ownership                                                              |
| GET /quizzes; GET /quizzes/:quizId                                                                      | Owner/public content; list scope all/mine, tag and pagination                     |
| POST /quizzes                                                                                           | `{ "content": QuizContent }`; private composition with question IDs               |
| PUT /quizzes/:quizId/content                                                                            | Direct save before attempts; equivalent saves harmless                            |
| PUT/DELETE /quizzes/:quizId/tags/:tagId                                                                 | Owner-scoped tagging remains possible after locks                                 |
| POST /quizzes/:quizId/attempts                                                                          | Owner private or public access; empty composition returns 409                     |
| GET /attempts; GET /attempts/:attemptId                                                                 | Learner-only snapshot history/detail                                              |
| PUT /attempts/:attemptId/questions/:questionId/answer                                                   | Path question ID denotes attempt-question ID; body `{ "response": UserResponse }` |
| POST /attempts/:attemptId/complete                                                                      | Required answer checks and deterministic score summary                            |
| POST /feedback; GET /feedback/received; PATCH /feedback/:feedbackId                                     | Exactly one target, owner triage, direct recipient relationships                  |
| POST/GET /question-batches; GET /question-batches/:batchId; POST /question-batches/:batchId/materialize | Retain then atomically create usable private questions                            |
| GET /courses; GET /courses/:courseId; GET /courses/:courseId/lessons                                    | Public, ordered and paginated hierarchy                                           |
| GET /lessons/:lessonId; GET /lessons/:lessonId/quizzes                                                  | Public content and ordered quiz reuse                                             |

## Public course imports

`POST /courses/import` accepts `{ importKey, content: { title, description?, lessons? } }`.
`POST /courses/:courseId/lessons/import` accepts `{ importKey, content: { lessons } }`.
Use a UUID `importKey` and lesson objects with `title`, optional `description`, and nonblank `content`.
Array order determines position. Up to 100 lessons per request and 256 KiB per body are supported;
quiz attachment fields are rejected. Both endpoints return `{ courseId, lessonIds }`. A retry with
the same authenticated user, key, and content reuses the original result. All writes are atomic.

Attempt creation accepts optional `{ lessonQuizId }`; omission preserves standalone behavior.
The association must match the public quiz. Attempt responses retain `lessonQuizId` and
`lessonContext: { lessonId, courseId }`, or null for standalone attempts.

Apply `20261021130000_course_lesson_context.sql` before running these endpoints.

## Integrity and practice

First composition use permanently locks question prompt/type/answer/grading/explanation. Any attempt
status locks quiz title/description/settings/composition. Create independent replacements for changes.
A public quiz contains public questions only; private composition uses owned private or public
questions. Lesson associations require public quizzes and reject invalidating visibility updates.
Mutations and attempt starts serialize through parent/question locks and SQL guards.

Attempts snapshot quiz title/settings plus question identity/content, answer/grading, required/timing
and points. Reads/completion never reconstruct content from sources. Answers are graded synchronously
for exact text and single/multi choice, with fractional numeric points. Historical answer display uses
snapshotted settings. Feedback on attempted questions goes to quiz and source-question owners;
feedback statuses remain `open/reviewed/resolved/dismissed`.

## Private batch import

[The REST example](../docs/examples/rest-endpoints-batch.json) shows artifact format `schemaVersion: 1`.
A UUID batch key, topic, declared source, up to ten tag names and 1–20 uniquely keyed gradeable
questions are validated before retention. Sponsor/key retries preserve a canonical SHA-256; changed
content with the same key returns 409. Materialization with `{}` creates all questions/tags/mappings
atomically. Retry returns the same direct IDs. No review or provider configuration is required.
`npm run check:private-import -- <batch-uuid>` performs read-only digest, mapping, private access and
sponsor integrity verification against the configured database.

## Validation and replacement

Unit/API tests mock Auth. Persistence and HTTP+SQL tests apply the clean baseline to PGlite, including
exact profile preservation. Real PostgreSQL races require `TEST_DATABASE_URL` pointing to a fresh
local `quiz_builder_test`; other/nonempty databases are rejected. CI provides that disposable service.
PGlite alone does not establish row-lock correctness. Never run destructive checks on the retained account.

See [the rebuild procedure](../docs/plans/v1-schema-rebuild.md), [current architecture](../architecture-plan.md),
and [API conventions](docs/api-conventions.md). Review/version/publication/agent/work-item APIs and
worker commands have been removed without compatibility stubs.
