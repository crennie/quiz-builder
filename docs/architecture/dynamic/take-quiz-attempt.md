# Take quiz attempt

**Scenario:** A verified learner starts a published quiz in the web UI, submits answers one at a time, and completes it through the API. The attempt route reloads saved progress by attempt ID after a refresh.

```mermaid
sequenceDiagram
    actor Learner
    participant API as Express routes and auth middleware
    participant Store as Attempt operations
    participant Grade as Deterministic evaluator
    participant DB as Postgres

    Learner->>API: POST /quizzes/:quizId/attempts with access token
    API->>Store: Start attempt for verified user
    Store->>DB: Check published quiz and visibility; read current version
    alt Quiz unavailable or empty
        Store-->>API: 404 or 409; no attempt committed
    else Allowed
        Store->>DB: Insert attempt and frozen settings/questions in one transaction
        Store-->>API: In-progress attempt
    end
    API-->>Learner: Attempt detail or error
    Learner->>API: PUT /attempts/:id/questions/:questionId/answer
    API->>Store: Submit validated response as owner
    Store->>DB: Lock owned in-progress attempt; read frozen snapshots
    alt Closed, already answered, or invalid choice
        Store-->>API: 409 or 400; no answer stored
    else Valid response
        Store->>Grade: Evaluate response against frozen answer and grading data
        Grade-->>Store: Correctness and awarded points
        Store->>DB: Store response, evaluation, and points in transaction
        Store-->>API: Updated attempt
    end
    API-->>Learner: Updated detail or error
    Learner->>API: POST /attempts/:id/complete
    API->>Store: Complete owned attempt
    Store->>DB: Lock attempt; check required answers; sum points
    alt Required answers missing
        Store-->>API: 409; remains in progress
    else Complete
        Store->>DB: Store score summary and completed status atomically
        Store-->>API: Completed result
    end
    API-->>Learner: Result or error
```

The quiz access check depends on quiz visibility and publication, not on current visibility of its source questions. A learner can access only their own attempts. Attempts use frozen snapshots even after later edits. The current evaluator awards all points or zero for exact text, single choice, and multiple choice; points can be fractional. The web UI shows scores and per-question review after completion, reads history from the API, and lets the learner submit feedback. Correct answers and explanations in the response are governed by the saved `showAnswersAfterCompletion` setting, while answer secrecy is not a security requirement for this practice app.
