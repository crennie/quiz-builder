# ADR-012: Lesson editing and exclusive imported quizzes

Status: accepted. Supersedes ADR-011's reusable quiz associations and deferred lesson editor.

## Decision

Public lesson pages default to View. Any verified signed-in user can enter Edit for any lesson;
anonymous users can read courses, lessons and quizzes. Backend authorization enforces this rule.
The editor saves lesson content and its ordered quiz draft in one transaction, or cancels all local
changes. Navigation warns before discarding drafts. A timestamp precondition rejects stale saves.

New lesson quizzes come only from JSON import inside the lesson editor. There is no public quiz
management screen or arbitrary attachment API. The existing simple quiz file and batch artifact
formats are supported, as is the full `LessonQuizContent` document. Imported questions and quizzes
are public. Each quiz has exactly one immutable lesson association; SQL enforces quiz uniqueness.

Quiz edits create replacement quiz/question records using the same validated import materializer.
Unchanged quizzes keep their IDs, including during reordering. This preserves existing question
and quiz locks without a version model. Replaced or removed associations set `removed_at`; they
retain their identity and restrictive attempt FK. Only active associations have unique positions.
Retired quizzes cannot start new attempts; existing attempts can still resume and show results.
Replacement duplicates source content, trading some storage for simple immutable history.

View embeds the existing attempt player. The editor never exposes attempt actions. Lesson quizzes
must start with their active association ID; context-free attempts are rejected in the API and SQL.
Attempt history filters by lesson and user before pagination and includes retired quiz attempts.
Standalone attempt URLs retain a return link to the originating lesson.

## Migration and validation

Apply `20261021140000_lesson_quiz_editing.sql` before running the updated application. It adds
retirement and exclusive ownership without deleting existing records. If legacy data shares a quiz
between lessons, the unique constraint intentionally fails; resolve those associations through a
reviewed data migration before rollout. No automatic destructive cleanup is performed.

Database types were aligned with the migration locally; regeneration against a migrated Supabase
stack remains the canonical verification. This change uses static type, lint, build and OpenAPI
checks only. Automated tests were neither added nor run at the request of the task owner; database
migration and browser behavior require later runtime verification.
