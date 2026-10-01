# Create and publish a question

**Scope:** Phase 1 publication boundary for a human-authored question. This path applies only while direct publication is allowed for the exact current version.

```mermaid
sequenceDiagram
    actor Author
    participant Web as Web app
    participant API as Express API
    participant DB as Postgres

    Author->>Web: Save question content
    Web->>API: POST /api/v1/questions
    API->>DB: Create stable question and immutable version 1 as draft
    API-->>Web: Owner management detail
    Author->>Web: Publish current version
    Web->>API: POST /api/v1/questions/{id}/publish with versionId
    API->>DB: Lock owned question; check current version and direct-publish policy
    API->>DB: Transaction: append direct approval and publication events; set default pointer
    API-->>Web: Published owner detail
    Web->>API: GET /api/v1/questions/{id}
    API->>DB: Read default published version through bank projection
    API-->>Web: Published bank content
```

Creation never publishes. `GET /api/v1/questions/mine` and `GET /api/v1/questions/{id}/manage` expose the owner's draft and current candidate; bank reads expose the default published version only when the question is published and visible. A later edit creates a new immutable current version without moving the bank pointer. Direct publication rejects a stale version, an archived question, a submitted version, and any question with agent or batch origin. The owner may explicitly unpublish, archive, or restore through separate actions; those transitions append publication events.

Publication history records every version that has actually been published. A new quiz membership may pin an accessible historical published version only while the question identity is currently published. Existing quiz versions and attempt snapshots keep their exact content when source publication changes. See the [domain view](../static/domain.md), [data view](../static/data.md), and [ADR-004](../decisions/ADR-004-question-publication-boundary.md).
