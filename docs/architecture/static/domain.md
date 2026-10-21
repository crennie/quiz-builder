# Domain model

```mermaid
erDiagram
    PROFILE ||--o{ QUESTION : owns
    PROFILE ||--o{ QUIZ : owns
    QUIZ ||--o{ QUIZ_QUESTION : orders
    QUESTION ||--o{ QUIZ_QUESTION : reused
    COURSE ||--o{ LESSON : contains
    LESSON ||--o{ LESSON_QUIZ : orders
    QUIZ ||--o{ LESSON_QUIZ : reused
    QUIZ ||--o{ ATTEMPT : freezes
    LESSON_QUIZ |o--o{ ATTEMPT : contextualizes
    ATTEMPT ||--o{ ATTEMPT_QUESTION : snapshots
    QUESTION ||--o{ ATTEMPT_QUESTION : identifies
    PROFILE ||--o{ QUESTION_BATCH : sponsors
    QUESTION_BATCH ||--o{ BATCH_ITEM : maps
    QUESTION ||--o| BATCH_ITEM : imported
```

Questions and quizzes are direct records with private/public access. Questions lock on first quiz
use; quizzes lock on any attempt. New records replace locked content without revision identity.
Courses and lessons are public; each lesson belongs to one course. Lessons can reuse public quizzes
across courses. Tags stay owner-scoped. Feedback triage and learner result review are retained,
independent of any content approval lifecycle. No version, publication, workflow or agent entities exist.

Signed-in users may import public courses and append lessons. Imports create no quiz associations.
Attempts retain a nullable, immutable lesson-quiz association ID independently of player UI state.
