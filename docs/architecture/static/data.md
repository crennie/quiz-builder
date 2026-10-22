# Data model

The baseline and subsequent SQL migrations in `supabase/migrations/` are authoritative.

| Table                                   | Responsibility                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| profiles                                | Supabase Auth UUID, display name/avatar and timestamps                                                             |
| questions                               | Direct content, creator, visibility, permanent content lock                                                        |
| quizzes                                 | Direct title/description/settings, creator and visibility                                                          |
| quiz_questions                          | Ordered question IDs, repeatable at separate positions, points/required/timing                                     |
| quiz_attempts                           | Quiz/user identity, optional immutable lesson-quiz FK, status, immutable snapshots and score summary               |
| quiz_attempt_questions                  | Source question identity, immutable presentation/answer/grading/required/timing/points, recorded responses/results |
| courses                                 | Public title/description, archived_at and timestamps                                                                            |
| lessons                                 | Exactly one course FK, ordered title/description/Markdown and timestamps                                           |
| lesson_quizzes                          | Stable UUID, exclusive public quiz, immutable identity, removed_at, unique active lesson position                  |
| tags / question_tags / quiz_tags        | Owner-scoped labels and associations                                                                               |
| feedback                                | Exactly one question/quiz/attempt-question target, category/comment/triage                                         |
| question_batches / question_batch_items | Immutable sponsor artifact/digest/key and direct question mappings                                                 |
| course_imports                          | Immutable sponsor/key/digest receipt with created course and lesson IDs                                            |
| course_enrollments                      | Unique user/course enrollment with original enrollment timestamp                                                  |
| lesson_progress                         | Unique user/lesson completion timestamp; composite FKs require enrollment in the lesson's course                   |

All 18 tables enable RLS without Data API policies. Referenced content uses restrictive FKs.
Unique parent/position constraints govern composition and lesson ordering. SQL triggers enforce
question/quiz immutability and visibility relationships on writes and invalidating updates.
Numeric points are finite/nonnegative; optional timing is positive. JSONB shape checks complement
shared runtime Zod validation. Batch keys and mappings are unique and immutable.

Lesson context uses a restrictive FK. Association identity and attempt context cannot be changed.
Import receipts serialize retries; append operations lock the course before assigning lesson positions.

`lesson_quizzes.quiz_id` is unique even for retired associations; quizzes cannot be shared across
lessons. A partial unique index orders only active associations (`removed_at IS NULL`). Retired
associations preserve history, but cannot start new attempts. Lesson saves lock the lesson, check
`expectedUpdatedAt`, lock associated quizzes in UUID order, and publish the entire draft atomically.

Course imports optionally materialize each lesson's ordered quizzes in the same transaction, using
the lesson editor's quiz materializer. Course archiving preserves all descendants and attempt history.
API edits/imports and attempt starts lock the course and reject archived courses; a SQL insert guard
also serializes new attempts with archive changes. Existing attempts remain usable.

Course enrollments are explicit and user-scoped. Manual lesson completion is independent of quiz
attempts; absence of a progress row means incomplete. Undo removes the completion row. Composite
FKs prevent cross-course progress and moving completed lessons to a different course. My Courses
counts current lessons and completions, preserving archived enrollments. New course quiz attempts
require enrollment through both Express checks and a SQL insert guard.
