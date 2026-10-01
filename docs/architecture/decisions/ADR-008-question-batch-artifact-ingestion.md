# ADR-008: Retained question batch artifacts

Status: Accepted
Date: 2026-10-01

## Context

The trusted creation worker validates a provider response and immediately creates one draft and one review item. An externally prepared set of questions needs a durable handoff that a human can inspect, ingest, and route through the same question review path. A client-provided claim of agent authorship cannot be treated as a verified worker execution.

## Decision

- A signed-in sponsor uploads one versioned JSON artifact containing 1–20 keyed question contents, a topic, declared source, and suggested tags. The server validates the complete artifact before storing it. The sponsor and a document SHA-256 are recorded; the document's `batchKey` is idempotent for that sponsor. A changed document with the same key is rejected.
- Ingestion retains the validated artifact without creating questions. A separate sponsor action materializes all questions in one transaction as private drafts, records immutable batch-key to question/version mappings, and creates or reuses the sponsor's tags. Retrying materialization returns the same mappings. The original artifact and mappings are immutable; later question revisions create new versions without changing the batch record.
- Every imported question must enter content review before publication, including when its declared source is human. Review submission remains explicit and binds the exact current immutable version. The policy snapshot records the batch ID and whether the document declared human or external-agent production. External-agent declarations route review to a human because the application cannot prove that its configured reviewer was independent of the offline producer. The declaration is attributed to the uploader; it does not create a trusted agent execution run or impersonate a fixed machine actor.
- The existing trusted provider worker remains available. This decision adds a file-based creation path without changing its claim or provenance model. Quiz assembly is outside this decision.

## Consequences

The batch is an auditable input artifact and the question versions are the durable output artifacts. A batch can be retained without materialization, and materialized drafts can wait without review. All-or-nothing materialization avoids a silently partial set. The API uses the established authenticated owner boundary and PostgreSQL transaction service; browser uploads send JSON and need no new production dependency. The SHA-256 covers the validated JSON with object keys sorted, not the original file bytes or an independently verified agent identity.
