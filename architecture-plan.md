# Architecture & Implementation Plan

Quiz Builder V1 uses direct question and quiz records, public course hierarchies, and immutable
attempt snapshots. [ADR-009](docs/architecture/decisions/ADR-009-direct-v1-domain.md) supersedes the
previous version/publication/workflow design. The accepted replacement scope is recorded in
[the restructure plan](docs/plans/v1-domain-restructure.md).

## Technology and boundaries

Use Node.js 24 LTS, npm and ECMAScript modules. The frontend is React, Vite, TypeScript, TanStack
Router and TanStack Query. Express 5 owns authentication, authorization and domain operations;
Supabase Auth owns accounts and sessions. PostgreSQL through parameterized `pg` queries is the
persistence boundary. Shared Zod contracts validate HTTP and JSONB data. SQL migrations define the
schema; generated database types describe rows. No ORM or new production dependency is needed.
Keep frontend, backend and contracts in `frontend/`, `backend/` and `shared/` respectively.

## Domain

Profiles use Supabase Auth UUIDs. `is_platform_admin` defaults to false and is managed only in SQL,
never from Auth metadata or API writes. `/me` exposes the read-only role for UI permissions.
See [ADR-015](docs/architecture/decisions/ADR-015-platform-admin-and-lesson-access.md). Questions contain prompt, type, answer/grading configurations,
explanation, ownership and private/public visibility directly. Quizzes contain title, description,
settings and visibility directly; ordered `quiz_questions` reference question IDs with numeric
points, required flags and optional timing. Repeating a question at different positions is allowed.

Private quizzes support reversible archiving through `archived_at`; active lists exclude archives,
new attempts are blocked while archived, and existing attempts and content locks are preserved.
See [ADR-010](docs/architecture/decisions/ADR-010-quiz-archiving.md).

Course catalogs are public and support reversible archiving by platform admins. Active lists exclude
archives; archived courses remain readable, while edits, imports and new attempts require restoration.
See [ADR-013](docs/architecture/decisions/ADR-013-course-archive-and-quiz-import.md). Each ordered
lesson has exactly one course FK and plain text/Markdown content.
`lesson_quizzes` gives each lesson quiz exactly one lesson, with ordered active associations.
Course and lesson summaries have public read APIs. Full lessons and their quizzes require enrollment
or platform admin access. Only platform admins may import courses or appended lessons, edit lessons,
and import, edit, remove or reorder lesson quizzes.
View is the default; editing uses an atomic save or local cancel. Lesson quizzes are created by
inline import in the lesson editor or optional per-lesson quiz JSON in course/lesson imports, and
use public questions. Edited quiz content creates a
replacement record; removed associations remain for immutable historical attempt context.
See [ADR-012](docs/architecture/decisions/ADR-012-lesson-quiz-editing.md).
Owner-scoped tags, feedback, batch artifacts and mappings remain core entities.

Learners explicitly enroll in courses and manually mark lessons complete or incomplete. Course quiz
starts require enrollment; standalone quiz access is unchanged. My Courses lists the learner's
enrollments and lesson completion counts, including preserved archived progress. Public course and lesson titles
remain available; full lesson reading requires enrollment (admins are exempt for authoring). See [ADR-014](docs/architecture/decisions/ADR-014-course-enrollment-and-progress.md).

## Durable invariants

1. Personal creation produces private content. Lesson editor imports create public quizzes and
   public questions; lesson edits replace quiz content without mutating locked originals. Other
   public content APIs remain read-only. Reads permit ownership or public visibility.
2. First quiz inclusion permanently sets a question's `content_locked_at`. Substantive content
   cannot change afterward, even after composition removal; tags remain owner-editable.
3. Any quiz attempt freezes title, description, settings and composition. Every attempt status
   counts. Equivalent saves are harmless. Attempts cannot be deleted to evade this lock.
4. A public quiz contains public questions only. A private quiz contains public questions or its
   creator's private questions. A lesson-associated quiz must remain public. Both association
   writes and invalidating source updates are guarded in SQL.
5. Content edits and attempts serialize through quiz/question row locks. Quiz writers acquire the
   parent first and lock distinct questions in UUID order. Direct SQL triggers also enforce locks.
6. Attempts snapshot quiz title, settings, source question identity/content, answer and grading
   configurations, required flags, timing and numeric points. Historical presentation and grading
   load snapshots without joining mutable content or composition.
7. Exact text, single choice and multiple choice use synchronous deterministic evaluation.
   Fuzzy authoring is unavailable until an evaluator exists. Numeric scores may be fractional.
8. Learners can access only their own attempts. Feedback has exactly one explicit target FK;
   attempted-question feedback goes to both the quiz owner and source-question owner.
9. Batch retention precedes atomic materialization. Sponsor/key idempotency and canonical JSON
   digest protect the artifact; mappings contain direct question IDs. Imported questions are
   immediately usable private content without approval requirements.
10. RLS is enabled with no browser Data API policies. Verified Express access is authoritative;
    invalid bearer tokens cannot fall back to anonymous access. Referenced content uses restrictive FKs.

## Replacement and verification

V1 replaces disposable application content with a single clean baseline. Existing installations
must use the [explicit application rebuild](docs/plans/v1-schema-rebuild.md), preserving Auth and
profiles in place. Replacing migration files is not an upgrade. Never reset the database containing
the established test account.

Implementation order: baseline and guards → generated types/contracts → direct persistence and
routes → attempts/feedback → private import → public hierarchy reads → frontend → validation/docs.
The code cutover is implemented; environment checks and hosted cutover are tracked in the
[restructure plan](docs/plans/v1-domain-restructure.md).

Validation covers fresh creation, authorization, locks, snapshots, relational integrity, grading,
rollback, import, removed endpoints, browser flows and PostgreSQL races. PGlite proves SQL behavior;
real PostgreSQL is required for concurrency evidence. Supabase checks and type generation require a
local stack or approved development environment. CI runs shared, backend, frontend and browser checks.

## Deferred extensions

Broader course authoring, discovery, collaboration, analytics,
manual/fuzzy grading, response/evaluation tables and organizations remain future work. Future
orchestration may model `WorkItem → operation on Question / Quiz / Lesson / Course` additively.
V1 contains no dormant work queue, agent, review, publication, lifecycle or version fields.
