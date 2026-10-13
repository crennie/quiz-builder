# Import a private question batch

A verified sponsor uploads a bounded Zod-validated artifact. Retain immutable JSON and its canonical
SHA-256 before creating questions. Sponsor/batch-key retries return the same artifact; changed
content with the same key returns 409. Declared source describes file origin, not a verified actor.

Materialization locks the sponsored batch, resolves owner tags, creates all private direct questions,
and inserts immutable key/position/question-ID mappings atomically. Retry returns the same mappings;
a failed later item rolls back every question, tag and mapping. Imported questions can immediately
be used in personal quizzes. File `schemaVersion` denotes artifact format only.
