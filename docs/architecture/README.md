# Architecture

## System

Quiz Builder is a practice application for authoring reusable questions and versioned quizzes, taking quizzes, grading deterministic answers, and reviewing feedback. It preserves the exact content used by historical attempts. The backend supports explicit question publication, human review, optional trusted agent creation/review/revision/gating, and retained question batch ingestion. The web interface supports sign-in, question and quiz management, batch upload, human content work, quiz taking, result review, attempt history, and feedback submission. Reviewing received feedback remains an API workflow.

## Architecture Views

- [Static structure](static/context.md): system context, runtime containers, domain, data, and API components.
- Runtime behavior: [question publication](dynamic/publish-question.md), [human review and gate](dynamic/review-question.md), [sponsored agent creation](dynamic/create-agent-question.md), [configured agent roles](dynamic/configured-agent-review.md), [batch ingestion](dynamic/ingest-question-batch.md), [quiz save](dynamic/save-quiz.md), and [quiz attempt](dynamic/take-quiz-attempt.md).
- Decisions: [versioning](decisions/ADR-001-immutable-content-versions.md),
  [authorization](decisions/ADR-002-api-authorization-boundary.md),
  [attempt evaluation storage](decisions/ADR-003-jsonb-attempt-evaluation.md),
  [publication](decisions/ADR-004-question-publication-boundary.md), and
  [human review](decisions/ADR-005-human-review-and-work-queue.md), and
  [sponsored agent creation](decisions/ADR-006-sponsored-agent-creation.md), and
  [configured agent review and gate](decisions/ADR-007-configured-agent-review-and-gate.md), and
  [question batch ingestion](decisions/ADR-008-question-batch-artifact-ingestion.md).
- [Constraints and quality](quality/constraints.md): fixed choices and quality expectations.

## Key Artifacts

- [Container view](static/containers.md)
- [Domain model](static/domain.md) and [data model](static/data.md)
- [Save quiz](dynamic/save-quiz.md) and [take quiz attempt](dynamic/take-quiz-attempt.md)
- [Ingest a question batch](dynamic/ingest-question-batch.md)
- [Quality requirements](quality/requirements.md)

## Content workflow phase coverage

| Implemented slice                                  | Runtime view                                                 | Decision                                                          |
| -------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Phase 1: candidate and publication boundary        | [Create and publish a question](dynamic/publish-question.md) | [ADR-004](decisions/ADR-004-question-publication-boundary.md)     |
| Phase 2: human review, queue, and final gate       | [Review a question](dynamic/review-question.md)              | [ADR-005](decisions/ADR-005-human-review-and-work-queue.md)       |
| Phase 3: sponsored agent creation                  | [Create an agent question](dynamic/create-agent-question.md) | [ADR-006](decisions/ADR-006-sponsored-agent-creation.md)          |
| Phase 4: optional agent review, revision, and gate | [Configured agent roles](dynamic/configured-agent-review.md) | [ADR-007](decisions/ADR-007-configured-agent-review-and-gate.md)  |
| Later extension: retained question batches         | [Ingest a batch](dynamic/ingest-question-batch.md)           | [ADR-008](decisions/ADR-008-question-batch-artifact-ingestion.md) |

The [use-case checklist](../use-cases.md) and [test map](../use-case-tests.json) connect these behaviors to current automated coverage. The [content workflow closeout](../plans/content-production-workflow-closeout.md) records the remaining environment-dependent validation gates.

## Current Architecture Summary

A client-rendered React application calls an Express API. The API verifies Supabase Auth access tokens, owns authorization and domain operations, and uses parameterized SQL against Supabase Postgres. Optional trusted worker processes claim assigned content work from the same database and use bounded provider contracts; providers never receive application credentials. Shared Zod contracts validate API and JSONB data. Immutable question and quiz versions, publication history, review/gate decisions, and attempt snapshots protect historical results. The [Architecture & Implementation Plan](../../architecture-plan.md) records the target design and phase order; these views describe the implemented boundaries and identify unfinished UI work.
