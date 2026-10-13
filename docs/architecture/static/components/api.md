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
pagination; hierarchy mutations have no HTTP routes. OpenAPI registers only active operations.
