# Ingest a question batch

**Scope:** One authenticated author imports a versioned JSON artifact, creates draft questions, and submits individual versions to the existing review workflow. The source may be a human or an offline agent; the artifact's source label is a declaration by the uploader.

```mermaid
sequenceDiagram
    actor Producer as Human or offline agent
    actor Author
    participant Web as Web app
    participant API as Express API
    participant DB as Postgres

    Producer->>Author: Hand over JSON batch artifact
    Author->>Web: Select JSON file
    Web->>Web: Parse and validate shared Zod contract; preview questions
    Author->>Web: Retain batch artifact
    Web->>API: POST /api/v1/question-batches
    API->>API: Verify author, validate artifact, calculate digest
    API->>DB: Store immutable artifact by sponsor and batch key
    DB-->>API: Batch ID and retained artifact
    API-->>Web: Batch with no draft mappings
    Author->>Web: Create private drafts
    Web->>API: POST /api/v1/question-batches/{id}/materialize
    API->>DB: Transaction: resolve tags; create all drafts and item mappings
    DB-->>API: Complete key-to-question/version mappings
    API-->>Web: Batch with draft mappings
    Author->>Web: Submit one current version for review
    Web->>API: POST /api/v1/questions/{id}/review-submissions
    API->>DB: Record exact version, source policy, and review work item
    API-->>Web: Review item queued
    Author->>Web: Open work queue
    Web->>API: GET /api/v1/work-items
    API->>DB: Load sponsor's work items
    API-->>Web: Review item available for claim
```

The API rejects malformed artifacts and a sponsor reusing a batch key with different content. Repeating retention with identical content or repeating materialization returns the existing result. Materialization commits every question, tag link, and mapping together. Batch reads and actions are sponsor-scoped. The mapping retains the first version even if the author later revises a question; batch reads also show its current version. Imported drafts cannot use direct publication, and each review submission is a separate, explicit action. The existing review and gate flow handles publication.

The batch route is an artifact boundary for manual and offline production. Configured content workers remain separate runtimes; they do not ingest files through this flow today. The [data model](../static/data.md), [API component view](../static/components/api.md), and [ADR-008](../decisions/ADR-008-question-batch-artifact-ingestion.md) provide the persistent and decision details.
