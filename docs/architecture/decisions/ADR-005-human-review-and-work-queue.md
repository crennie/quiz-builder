# ADR-005: Human review and fenced publication work

Status: Accepted
Date: 2026-09-30

## Context

Question publication already separates the current candidate from published versions. The next workflow phase needs durable content review, a final publication gate, and work items that can wait or be retried without treating queue status as a content decision. There is no collaborator role or machine identity yet.

## Decision

- An owner may submit only the current, unarchived immutable version. A version has at most one review submission. The server stores policy version 1 with the owner as both the assigned human reviewer and final gate actor, explicitly allowing self-review for this human-only phase. This is a narrow policy until roles and reviewer assignment are designed.
- A submitted version cannot use the direct-publish endpoint. Unsubmitted human-authored current versions retain direct publication. A review decision is separate from a publication-gate decision. Content approval creates exactly one ready-to-publish item in the same transaction and does not publish.
- Work items have typed, validated inputs, a scoped assignee, a unique operation key, and append-only events. An assignee claims an item for five minutes. Claim tokens and generations fence completion after retry or lease expiry. Three failed or expired claims exhaust the item; a manual failure is recorded. Decisions and queue completion occur in the same transaction.
- Gate approval records the gate decision, publication event, and default-pointer update atomically under a question row lock. A changed current candidate makes an older item unusable; saving a new candidate cancels its open review, gate, and revision items. Changes requested enqueue a revision task; rejection closes that version's request. Either outcome requires a new version for a new submission.
- The API is the only application-table access path. Existing Auth user UUIDs remain the actor identity. Machine authentication, agent ownership, and cross-owner reviewer assignment remain future decisions.

## Consequences

An approved candidate can wait unpublished in the ready-to-publish queue. Queue status does not grant publication eligibility. Older published versions and pinned quiz attempts retain their existing behavior. Human reviewers see only work assigned to their account; in this phase, that is the question owner. No agent may submit or act through these endpoints without a verified human Auth session.
