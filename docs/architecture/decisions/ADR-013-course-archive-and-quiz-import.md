# ADR-013: Course archiving and embedded quiz import

Status: accepted. Extends ADR-010 and supersedes ADR-012's editor-only import restriction.

## Decision

Courses have nullable `archived_at` and reversible archive/restore operations. Any signed-in user
can archive or restore any course, matching existing shared lesson editing permissions; courses
have no owner. Active lists exclude archives, and the archived list requires authentication.
Direct course and lesson reads remain public. Archiving preserves lessons, quizzes, associations,
existing attempts and results. Archived courses reject lesson edits, lesson imports and new quiz
attempts. Restoration re-enables these operations without changing descendant identities.

Each lesson in a course or lesson import may include an optional ordered `quizzes` array. Entries
accept the existing simple quiz JSON, question batch artifact, or full `LessonQuizContent` format.
The shared parser normalizes these to lesson quiz content; the same transaction-aware materializer
used by the lesson editor creates public quizzes and questions and their ordered associations.
The complete course/lesson import is atomic. Existing sponsor/key/digest idempotency includes quiz
content and prevents duplicate quizzes on retries. Omitting `quizzes` retains the previous format.
The import preview displays quiz titles and question counts; downloadable examples include quizzes.

## Migration and validation

Apply `20261022120000_course_archive.sql` before running the updated application. It adds the column,
index and a new-attempt trigger, preserving existing records. Course row locks serialize archive
changes with edits, imports and new attempts. Database types are aligned locally; canonical type
regeneration requires a migrated Supabase stack.

Only static validation is performed for this change. No tests are added or run at the user's request.
The migration is supplied for deployment and is not applied to an external database by this task.
