# API components

`backend/src/app.ts` mounts `/api/v1` routers for profiles, questions/tags, quizzes, attempts,
feedback, private batches, and public courses/lessons. Health and `/` remain operational endpoints.
Authentication verifies Supabase access tokens and preserves profile identity; an invalid supplied
token fails even on public reads. Request and response helpers apply Zod and standard error envelopes.

`backend/src/db/` combines domain operations and parameterized persistence. `withTransaction` owns
commit/rollback/client release. Question edits lock their row. Composition and attempt creation lock
the quiz parent first; composition locks distinct questions in UUID order. SQL guards provide the
same integrity boundary for direct SQL. Deadlocks reject a transaction without weakening invariants.

`evaluation/deterministic.ts` grades validated snapshots synchronously. Feedback recipient joins use
attempt/quiz/question identities directly. Course reads use title/UUID or position ordering and
pagination. Signed-in JSON imports create courses or append lessons atomically. OpenAPI registers
only active operations.

Quiz archive/restore uses `PUT /quizzes/:quizId/archive` with `{ archived: boolean }` for owned
private quizzes. `GET /quizzes?archived=true` returns only the authenticated owner's archived quizzes;
default lists return active standalone quizzes, excluding all lesson-associated quizzes. Archive and new attempt creation serialize on the quiz row.
Attempt answer saves replace earlier responses and re-evaluate them until the attempt is completed.

`POST /courses/import` accepts `{ importKey, content: { title, description?, lessons? } }`.
`POST /courses/:courseId/lessons/import` accepts `{ importKey, content: { lessons } }`.
Both return `{ courseId, lessonIds }` and allow any verified signed-in user. Retrying the same key
and normalized payload reuses the receipt; changed payloads return 409. Strict schemas reject quiz
attachments. `GET /lessons/:lessonId` includes previous/next lesson links for reading navigation.

Attempt creation accepts an optional `{ lessonQuizId }` body, validates its quiz and public access,
and returns persisted `lessonQuizId` and `lessonContext` (lesson/course IDs). Omission means a
standalone attempt and is rejected for lesson-associated quizzes. Existing bodyless standalone
clients remain supported. Removed lesson quizzes cannot start new attempts.

`PUT /lessons/:lessonId` accepts lesson `title`, `description`, `content`, `expectedUpdatedAt`, and
an ordered `quizzes` array. Any authenticated user may save any lesson. Entries use either
`{ import: LessonQuizContent }` for inline JSON imports or `{ id, content: LessonQuizContent }`
for an existing active association in that lesson. Arbitrary quiz IDs cannot be attached.
Quiz documents include title, description, settings, and ordered questions with validated full
question content, points, required and timing fields. All imported sources are public.
Unchanged entries retain IDs; edited entries create replacement quizzes and questions. Omitted or
replaced associations retire without deleting attempts. Stale lesson saves return 409 and all
writes roll back on failure. `GET /attempts?lessonId=...` filters the authenticated learner's
history before pagination, including retired associations.
