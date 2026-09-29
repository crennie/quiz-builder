# ADR-003: Store v1 responses and evaluations with attempt questions

Status: Accepted
Date: 2026-09-29

## Context

V1 supports one deterministic answer and evaluation per attempted question. The system also needs the original question, answer, grading, and settings data for historical consistency.

## Decision

Store snapshots, `user_response`, and `evaluation_result` as JSONB on attempt records. Validate their shapes with shared Zod schemas when writing and reading. Evaluate exact text and choice responses synchronously against frozen snapshots and store awarded points with the result.

## Consequences

One transaction can save an answer and its evaluation without a worker or additional response tables. The current model does not represent multiple submissions, regrading history, or evaluator revisions. Those capabilities require separate response/evaluation records or another explicit migration. Database checks ensure JSONB objects; Zod enforces the domain shape in application code.

## Alternatives

Separate response and evaluation tables would support revisions and audit history but add relationships and lifecycle behavior not needed for v1. The implementation plan reserves them for future work.
