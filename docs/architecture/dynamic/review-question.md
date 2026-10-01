# Review a question and decide publication

**Scope:** Phase 2 human workflow and the shared review/gate transition service used by later agent roles. The diagram shows human execution; assigned workers use the same persisted submission and decision boundary.

```mermaid
sequenceDiagram
    actor Author as Author and assigned human reviewer
    participant Web as Web app and work queue
    participant API as Express API
    participant DB as Postgres

    Author->>Web: Submit current question version
    Web->>API: POST /api/v1/questions/{id}/review-submissions
    API->>DB: Lock owner question; store exact version and policy snapshot
    API->>DB: Enqueue REVIEW_QUESTION with assigned actor
    API-->>Web: Review item
    Author->>Web: Claim review item
    Web->>API: POST /api/v1/work-items/{id}/claim
    API->>DB: Record lease token and generation
    Author->>Web: Approve content
    Web->>API: POST /api/v1/work-items/{id}/decision
    API->>DB: Transaction: record review decision and enqueue APPROVE_PUBLICATION
    API-->>Web: Completed review item
    Note over DB: Question is still unpublished
    Author->>Web: Claim final gate item and approve publication
    Web->>API: POST claim, then POST decision with approve_and_publish
    API->>DB: Transaction: record gate decision and publication event; move default pointer
    API-->>Web: Completed gate item
```

The owner can submit only an unarchived current candidate. A version has one review submission; retrying the same submission returns its existing item. Human review and gate default to the sponsor, so human self-review is permitted by the current policy. Submission blocks direct publication of that version. Review approval creates a separate ready-to-publish item and does not publish. A gate can wait indefinitely; only its qualifying decision runs the publication transition.

Claims have five-minute leases, tokens, and generations. Stale claims cannot decide, and the same completed decision can be retried idempotently. Failed or expired claims have a three-attempt limit. `changes_requested` creates a revision task; rejection closes that version's path. A new immutable version is required for another submission. Saving a newer candidate cancels open work for the older one, and a stale decision cannot publish. Work-item status describes routing, while review and gate decision rows describe content outcomes. See [ADR-005](../decisions/ADR-005-human-review-and-work-queue.md) and the [data view](../static/data.md).
