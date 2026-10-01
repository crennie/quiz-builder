# Data model

**Scope:** Architecturally important persisted relationships. The [initial SQL migration](../../../supabase/migrations/20260928174208_initial_schema.sql), [publication migration](../../../supabase/migrations/20260930120000_question_publication.sql), [workflow migration](../../../supabase/migrations/20260930160000_human_review_workflow.sql), [agent creation migration](../../../supabase/migrations/20260930190000_agent_creation.sql), [agent workflow migration](../../../supabase/migrations/20260930220000_agent_review_gate.sql), and [batch ingestion migration](../../../supabase/migrations/20261001010000_question_batch_ingestion.sql) are authoritative for exact columns, constraints, indexes, and triggers.

```mermaid
erDiagram
    auth_users ||--|| profiles : "same UUID"
    profiles ||--o{ questions : owns
    profiles ||--o{ question_batches : uploads
    question_batches ||--o{ question_batch_items : maps
    questions ||--o| question_batch_items : imported_as
    question_versions ||--o| question_batch_items : imported_as
    profiles ||--o{ quizzes : owns
    profiles ||--o{ tags : owns
    profiles ||--o{ quiz_attempts : takes
    questions ||--|{ question_versions : has
    questions ||--o{ question_publication_events : records
    question_versions ||--o{ question_publication_events : published_as
    question_versions ||--o| question_review_submissions : submitted_as
    question_review_submissions ||--o| question_review_decisions : content_decision
    question_review_submissions ||--o| question_publication_gate_decisions : gate_decision
    question_review_submissions ||--o{ work_items : routes
    work_items ||--o{ work_item_events : audits
    agent_actors ||--o{ agent_execution_runs : executes
    work_items ||--o| agent_execution_runs : completes_as
    agent_execution_runs ||--o| question_review_decisions : records
    agent_execution_runs ||--o| question_publication_gate_decisions : records
    agent_actors ||--o{ agent_generation_runs : executes
    profiles ||--o{ agent_generation_runs : sponsors
    work_items ||--o| agent_generation_runs : completes_as
    agent_generation_runs ||--o| question_versions : creates
    agent_generation_runs ||--o| questions : originates
    quizzes ||--|{ quiz_versions : has
    quiz_versions ||--o{ quiz_version_questions : orders
    question_versions ||--o{ quiz_version_questions : pinned_by
    quiz_versions ||--o{ quiz_attempts : taken_as
    quiz_attempts ||--o{ quiz_attempt_questions : contains
    quiz_version_questions ||--o{ quiz_attempt_questions : source_for
    questions ||--o{ question_tags : labelled_by
    tags ||--o{ question_tags : labels
    quizzes ||--o{ quiz_tags : labelled_by
    tags ||--o{ quiz_tags : labels
    questions ||--o{ feedback : target_of
    quizzes ||--o{ feedback : target_of
    quiz_attempt_questions ||--o{ feedback : target_of
```

`questions` and `quizzes` keep stable ownership, visibility, status, and a pointer to their current version. Questions also have a nullable `default_published_version_id`, which the bank uses for its summary. Composite foreign keys ensure each pointer belongs to the same question. Append-only `question_publication_events` record direct approval, publication, unpublication, archive, and restore actions; publication events establish which exact versions have ever been published. A published question must have a default pointer. Draft questions have none; archived questions may retain one. `quiz_version_questions` pins a specific question version and its order, points, and attempt settings. Composite keys also ensure a pinned version belongs to the stated question. Version and membership rows cannot be updated or deleted because of database triggers.

The bank lists only published question identities and projects their default published version. A separate owner-management read exposes candidates. New quiz memberships require an accessible question that is currently published and an exact version with publication history. An existing quiz version retains its pinned reference if the source question is later unpublished or archived.

A review submission binds one question version to a server-chosen policy snapshot. Immutable review and gate decisions record distinct approvals. Work items hold typed inputs, assignment, status, lease generation, and claim token; append-only events record routing changes. Gate approval writes publication evidence and the default pointer in one transaction. New candidate versions cancel older open work items.

Agent-created questions remain owned by a sponsoring human. An immutable agent generation run identifies the machine actor, provider, model, and work item. Generated and revised versions point to their exact run; the question keeps its agent-origin marker. Creation, provenance, and one review item commit together; agent-origin questions cannot use direct publication. Separately assigned reviewer, reviser, and gate actors operate under a submission policy snapshot. Immutable execution runs identify provider/model provenance for agent decisions. A qualifying gate decision passes through the application publication transaction.

An uploaded question batch retains validated JSON and its digest before any question is created. Immutable batch-item mappings connect stable artifact keys to the private drafts and first versions created in an all-or-nothing materialization step. Imported drafts require an explicit review submission and cannot use direct publication. The artifact's source label is a declaration by the uploader; it is distinct from a trusted worker run.

An attempt references one quiz version. Starting it copies quiz settings and each presented question's content, answer, grading configuration, and points into snapshot columns. Database triggers prevent snapshot changes and reject membership that does not match the quiz version. Responses, evaluation results, and score summaries are JSONB; shared Zod schemas validate their shapes in application code. A database check requires feedback to reference exactly one target. User-scoped tag slugs are unique per owner.

All application tables have RLS enabled but no direct Data API policies. The API uses its database connection and enforces access in queries. See [ADR-002](../decisions/ADR-002-api-authorization-boundary.md) for the authorization boundary.
