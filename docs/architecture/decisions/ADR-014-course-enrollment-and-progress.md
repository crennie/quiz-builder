# ADR-014: Course enrollment and manual lesson progress

Status: Accepted

## Context

Learners need a personal course home and persistent lesson completion. Reading public content
does not imply enrollment, and quiz completion does not reliably indicate lesson completion.

## Decision

`course_enrollments` has a composite `(user_id, course_id)` primary key and an enrollment timestamp.
Enrollment is explicit, self-service and idempotent. `lesson_progress` stores completed lessons,
keyed by `(user_id, lesson_id)`, with a completion timestamp. Absence means incomplete; marking
incomplete removes that completion. Repeated completion preserves the original timestamp.
Composite restrictive FKs require both enrollment and a lesson in the same course. Completed
lessons cannot move to another course. Both tables enable RLS with no browser policies.

Express derives the user from verified authentication for every operation:

- `PUT /api/v1/courses/:courseId/enrollment` enrolls the current user.
- `GET /api/v1/me/courses` pages through their courses with completed/total lesson counts.
- `GET /api/v1/courses/:courseId/progress` returns their enrollment (or null) and completed lessons.
- `PUT /api/v1/lessons/:lessonId/progress` accepts `{ completed: boolean }`.

New course quiz attempts require enrollment in the quiz's actual course. The existing required
lesson context remains enforced. A SQL insert trigger checks enrollment from the quiz association,
including when an insert omits context. Standalone personal quiz access remains unchanged.
Existing attempts remain readable and resumable without retroactive enrollment. No enrollments
or completions are inferred from existing attempts. Quiz completion never changes lesson progress.

Enrollment and progress writes lock and require an active course. Archived enrollments and their
progress remain visible in My Courses; restoration enables further writes. Counts derive from
current lessons, so adding lessons can reduce the displayed completion fraction. Lesson edits
preserve manual completion. Unenrollment and automatic completion rules are deferred.

The authenticated `/courses/mine` page is the learner's My Courses home. Public course and lesson
reading remains available. Course discovery/detail pages offer enrollment, and lesson pages offer
manual completion with undo. Query caches include user identity and refresh after successful writes.

## Validation

PGlite tests cover idempotency, user isolation, composite FKs, pagination/counts, archives and attempt
gating. HTTP tests cover authentication and request validation. Browser component tests cover
enrollment, My Courses, completion/undo, failed saves and quiz gating.
