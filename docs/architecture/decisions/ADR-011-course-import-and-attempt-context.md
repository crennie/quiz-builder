# ADR-011: Public course import and durable lesson attempt context

Status: Accepted (2026-10-21)

## Decision

Keep the existing public Course → ordered Lesson model. Add UUID identities to `lesson_quizzes`,
retaining unique lesson/quiz and lesson/position constraints. Attempts optionally reference that
association through `lesson_quiz_id`; existing and standalone attempts have null context.

Association ID, lesson ID, and quiz ID are immutable. Attempts cannot change their context.
A restrictive FK prevents deletion of a referenced association. Attempt creation locks the quiz
first, validates a matching public lesson quiz, and protects the association from deletion. SQL
also enforces the matching quiz and immutable context. Attempt responses include the association ID
and originating lesson/course IDs so reloads can recover the learning context. No quiz attachment
or lesson quiz player UI is introduced in this increment.

Any verified signed-in user may import new public courses or append public lessons to **any**
existing course. This is the explicitly agreed V1 import policy; it does not introduce an editor,
roles, visibility states, enrollment, or progression. It is an exception to the previous read-only
course API boundary. Personal question and quiz creation remains private.

Course JSON contains `title`, optional `description`, and an optional ordered `lessons` array.
Append JSON contains a nonempty `lessons` array. Each lesson has `title`, optional `description`, and
nonblank `content`. Limits: 100 lessons per import, 300-character titles, 5,000-character descriptions,
200,000-character lesson content, and 256 KiB per HTTP request. Unknown fields, including quiz
attachments, are rejected. Courses may contain zero lessons. Positions are assigned by the server.

Each import is one transaction. A sponsor/key advisory lock serializes retries; an immutable
`course_imports` receipt stores the normalized payload digest and resulting IDs. Reusing a key with
the same content returns the original IDs; different content conflicts. The UI keeps its key during
retries on the same page. Selecting a file again or reloading begins a new import. Appending locks
the course row before allocating positions, so concurrent imports cannot overwrite or interleave
lesson ordering. Import receipts have RLS enabled with no browser policies.

## Reading experience

Public routes expose the course catalog, course overview with ordered lessons, and an individual
lesson reader. Imports require sign-in and preview the content before creating it. The reader uses
bounded line lengths, responsive typography, section links, and previous/next lesson navigation.
Reading and navigating do not record completion or progress.

Lesson content uses plain text or a deliberately limited Markdown dialect: ATX headings, paragraphs,
flat ordered/unordered lists, blockquotes, fenced code, inline code, emphasis, and HTTP(S)/mailto
links. Raw HTML and images are not interpreted. Text is rendered through React with no HTML injection.
Full CommonMark, nested Markdown constructs, tables, and rich media are deferred. No production
dependency is added.

## Migration and validation

Apply `20261021130000_course_lesson_context.sql` after the existing migrations; do not rebuild or
reset existing data. The migration backfills association IDs and leaves historical attempts with
null context. Database TypeScript shapes are checked against the migrated PGlite catalog using
`node scripts/generate-embedded-db-types.mjs --check`; Supabase CLI parity remains an environment check.

At the user's request this increment adds and runs no tests. Type/lint/build/OpenAPI and migration
application checks are the validation boundary; automated scenario coverage remains follow-up work.
