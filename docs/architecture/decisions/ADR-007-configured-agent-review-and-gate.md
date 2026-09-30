# ADR-007: Configured agent review, revision, and publication gate

Status: Accepted
Date: 2026-09-30

## Context

The human workflow already binds review to an immutable question version and keeps content approval separate from publication. Sponsored agent creation initially enqueues human review. Optional automation needs separate machine identities and a durable decision trail without giving providers database access or publication authority.

## Decision

- The submitting backend process selects the executor policy when a version is submitted. `CONTENT_AGENT_REVIEW`, `CONTENT_AGENT_REVISION`, and `CONTENT_AGENT_GATE` independently enable the three machine roles on the API and creation worker. Their fixed actor IDs and human sponsor are captured in the submission policy snapshot; subsequent configuration changes do not reroute existing submissions. The default for each role is human. A reviewer agent that generated the submitted version falls back to human review.
- Each role runs as a separate trusted worker process selected by `AGENT_WORKER_ROLE`. The review, revision, and gate processes require their own provider endpoint, token, name, and model settings. Workers claim only items assigned to their actor and queue/type. The browser can see progress but cannot claim or decide machine items. Providers receive only the exact version content and relevant findings, return versioned validated JSON, and receive no application credential.
- Review and gate decisions store a machine actor and immutable execution run with provider/model metadata. Agent revisions create a new immutable version linked to a generation run and submit it under the previous policy. Reviewers cannot decide their own generated version. After the third review submission, change requests route to a manual revision item to bound automatic cycles.
- A gate agent only returns a decision. The shared application workflow service verifies the claim, exact current version, approved review, and policy, then records the gate decision, publication event, and default pointer in one transaction. Agent publication events identify the machine actor separately from the sponsor.
- After three failed claims, a sponsor may move a failed review, revision, or gate item to the human queue. The handoff records an event and resets the claim-attempt budget while retaining the policy and prior events. Agent creation failures remain creation requests; the sponsor can create a question manually.

## Consequences

Enabled roles need separately configured workers; an enabled queue waits if its worker is not running. Failed items remain visible and can be handed to the human queue. Automated decisions and generated revisions remain attributable to a sponsor for ownership, while provider authorship and execution are recorded separately. The trusted worker uses the backend database credential; external workers would require a new machine authentication boundary.
