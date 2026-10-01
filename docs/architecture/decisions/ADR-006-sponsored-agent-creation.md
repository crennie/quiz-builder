# ADR-006: Sponsored agent creation through a trusted worker

Status: Accepted
Date: 2026-09-30

## Context

Agent creation needs an owner for private drafts, a machine identity distinct from Supabase Auth users, and a way to process generated output without letting a provider write application state. Existing owner checks use a human profile UUID. Agent review and publication remain human tasks in this phase.

## Decision

- A signed-in human sponsors each generation request and owns its resulting question. `questions.created_by` and `question_versions.created_by` retain that sponsor UUID for existing ownership and access checks. This is sponsorship attribution, not a claim that the human wrote the content. The first version carries `agent_run_id`, the question carries `agent_origin_run_id`, and the API exposes these markers. An immutable run record identifies the configured agent actor, sponsor, work item, provider, model, and execution metadata.
- A fixed `agent_actors` row identifies the question generator. A separate trusted backend worker process uses the application's database credential and this server-chosen actor ID. It claims only `CREATE_QUESTION` items. No machine completion endpoint or client-supplied actor identity is accepted. Provider output has no database or API credential and cannot claim work or publish.
- The worker sends a bounded brief to a configured HTTPS provider endpoint (loopback HTTP is allowed for development). It validates the versioned provider response with the shared question-content contract. Provider and model names come from worker configuration, not the response. The worker times out provider calls, fences completion with the claim token and generation, and records failures for retry.
- A successful completion inserts the run, private draft, first immutable version, and exactly one human review item in one transaction, then completes the creation item. Invalid output or a stale claim cannot persist a question. Agent-origin questions require the review and final gate path for publication, including after a human revision. Direct publication remains available only for human-origin questions under ADR-005.
- One sponsor may have at most five active creation requests and twenty requests in a rolling 24-hour period. A client-supplied UUID request key makes enqueue retries idempotent; reuse with different content is rejected.

## Consequences

The API and worker are separate processes that share the database and domain code. Running the worker requires provider configuration; the API can run without it. The provider protocol is application-owned and replaceable. Agent content is never placed in the bank by generation alone. Future external workers need a separate, scoped machine authentication design; the trusted worker does not establish a general agent API identity.
