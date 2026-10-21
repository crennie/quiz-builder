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
| courses                                 | Public title/description and timestamps                                                                            |
| lessons                                 | Exactly one course FK, ordered title/description/Markdown and timestamps                                           |
| lesson_quizzes                          | Stable UUID, immutable lesson/quiz identity, reusable public quiz and unique lesson position                       |
| tags / question_tags / quiz_tags        | Owner-scoped labels and associations                                                                               |
| feedback                                | Exactly one question/quiz/attempt-question target, category/comment/triage                                         |
| question_batches / question_batch_items | Immutable sponsor artifact/digest/key and direct question mappings                                                 |
| course_imports                          | Immutable sponsor/key/digest receipt with created course and lesson IDs                                            |

All 16 tables enable RLS without Data API policies. Referenced content uses restrictive FKs.
Unique parent/position constraints govern composition and lesson ordering. SQL triggers enforce
question/quiz immutability and visibility relationships on writes and invalidating updates.
Numeric points are finite/nonnegative; optional timing is positive. JSONB shape checks complement
shared runtime Zod validation. Batch keys and mappings are unique and immutable.

Lesson context uses a restrictive FK. Association identity and attempt context cannot be changed.
Import receipts serialize retries; append operations lock the course before assigning lesson positions.
