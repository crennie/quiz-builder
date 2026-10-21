# Import a private question batch

A verified sponsor uploads a bounded Zod-validated artifact. Retain immutable JSON and its canonical
SHA-256 before creating questions. Sponsor/batch-key retries return the same artifact; changed
content with the same key returns 409. Declared source describes file origin, not a verified actor.

Materialization locks the sponsored batch, resolves owner tags, creates all private direct questions,
and inserts immutable key/position/question-ID mappings atomically. Retry returns the same mappings;
a failed later item rolls back every question, tag and mapping. Imported questions can immediately
be used in personal quizzes. File `schemaVersion` denotes artifact format only.

## Quiz import UI

The protected `/quizzes/import` page accepts the existing artifact format or a simple JSON quiz
(`title`, optional `description`, and 1–20 `questions` with `prompt`, text `answer`, and optional
`explanation`). Simple files become validated exact-text batches, with case-insensitive grading and
trimmed whitespace. A downloadable example lives in `frontend/public/sample-quiz.json`.

The frontend retains and materializes the batch using the existing APIs, then creates a private quiz
from its ordered question mappings. Defaults are one point per required question, no time limit,
fixed question order, and answers shown after completion. This is a sequence of existing operations,
not one database transaction. If quiz creation fails, imported questions remain in the user's
library; retrying within the page reuses the batch. A confirmed quiz ID is retained in memory so a
navigation failure can be retried without creating another quiz. Reloading loses that UI state;
quiz creation itself has no idempotency key.
