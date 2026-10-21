# Architecture

Quiz Builder supports personal questions and quizzes, public courses and lessons, deterministic
practice attempts, immutable historical results, tags, feedback and retained batch import.

- Structure: [context](static/context.md), [containers](static/containers.md),
  [domain](static/domain.md), [data](static/data.md), [API](static/components/api.md).
- Behavior: [question editing](dynamic/edit-question.md), [quiz saving](dynamic/save-quiz.md),
  [attempts](dynamic/take-quiz-attempt.md), [batch import](dynamic/ingest-question-batch.md).
- Decisions: [direct V1 domain](decisions/ADR-009-direct-v1-domain.md),
  [quiz archiving](decisions/ADR-010-quiz-archiving.md),
  [API authorization](decisions/ADR-002-api-authorization-boundary.md),
  [snapshot evaluation](decisions/ADR-003-jsonb-attempt-evaluation.md).
- Quality: [constraints](quality/constraints.md), [requirements](quality/requirements.md).
- Implementation: [architecture plan](../../architecture-plan.md),
  [use cases](../use-cases.md), [test map](../use-case-tests.json),
  [schema rebuild](../plans/v1-schema-rebuild.md).

The client-rendered React application calls Express. Express verifies Supabase Auth tokens, owns
access checks, and uses transactional parameterized PostgreSQL queries. Shared Zod contracts validate
HTTP and JSONB. Direct content guards protect immutable snapshots without content versions or workers.
Historical ADRs and workflow plans marked superseded describe the removed implementation.
