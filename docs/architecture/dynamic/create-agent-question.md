# Create a sponsored agent question

**Scope:** Phase 3 creation through a configured provider and trusted backend worker. The provider has no application database or API credential.

```mermaid
sequenceDiagram
    actor Sponsor as Signed-in sponsor
    participant Web as Web app
    participant API as Express API
    participant DB as Postgres work queue and content
    participant Worker as Creation worker
    participant Provider as Configured provider

    Sponsor->>Web: Enter question brief
    Web->>API: POST /api/v1/agent-questions with brief and requestKey
    API->>DB: Validate sponsor and limits; enqueue CREATE_QUESTION
    API-->>Web: Creation work item
    Worker->>DB: Claim assigned creation item with lease
    Worker->>Provider: Send bounded versioned creation task
    Provider-->>Worker: Versioned question content
    Worker->>Worker: Validate response with shared contract
    Worker->>DB: Transaction: verify claim; record run; create private draft/version; enqueue review
    DB-->>Worker: Question, version, and review item IDs
    Web->>API: GET /api/v1/work-items
    API-->>Web: Sponsor-visible status and review work
```

The verified sponsor owns the question and version; the immutable generation run identifies the fixed machine actor, provider, model, and creation item. Request keys are sponsor-scoped and idempotent. A sponsor may have at most five active creation requests and twenty requests in a rolling day. The worker claims only creation work, and provider output cannot choose an actor or publish. Claim-token fencing and one transaction prevent stale or invalid output from leaving a partial question. The created private draft enters review automatically and cannot use direct publication, including after a human revision.

The API can run without a creation provider. Processing requires a separate `worker:content` process with `AGENT_WORKER_ROLE=creation` (the default) and creation-provider settings. See [ADR-006](../decisions/ADR-006-sponsored-agent-creation.md), the [container view](../static/containers.md), and [worker configuration](../../../backend/README.md).
