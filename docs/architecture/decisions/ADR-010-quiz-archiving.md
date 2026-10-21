# ADR-010: Reversible quiz archiving

Status: accepted.

Use a nullable `quizzes.archived_at` timestamp for reversible removal from active quiz lists.
Archive and restore are idempotent owner-only operations on private quizzes. They lock the quiz
row, preserve its identity, composition, tags, feedback and attempts, and never delete questions.
Public authoring remains outside the ordinary API; a database constraint prevents public archives.

Active lists exclude archived records. An authenticated archived view returns only the viewer's
own archived quizzes. Direct detail and historical attempt reads remain available. Archived quizzes
cannot start new attempts; the API and database enforce this under the same quiz row lock used for
archiving. Existing in-progress attempts remain resumable. Restore clears the timestamp without
weakening content locks from earlier attempts.

Apply this as an additive migration after the V1 baseline, not a database rebuild. The archive
column and owner/archive index support filtering without breaking existing foreign keys or immutable
snapshots. Archive metadata is separate from quiz content, so attempted quizzes can be archived.
