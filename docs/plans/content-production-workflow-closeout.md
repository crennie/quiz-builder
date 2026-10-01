# Content workflow closeout and agent handover

**Status (2026-10-01):** Phases 1–4 are implemented in the repository. Docker-free validation passes. Full release validation remains pending because this container has no Docker executable, so it cannot run the local Supabase stack, generated-type drift check, browser tests, or a live PostgreSQL service. No migration has been applied to a hosted project and no branch has been pushed.

## Completed in this closeout

- Corrected the in-memory migration checker to include `agent_execution_runs` in its 21-table assertion.
- Added an upgrade test that applies the Phase 4 migration over existing human review/gate decisions and a claimed Phase 3 creation item. It checks actor attribution and preservation of the claim while backfilling machine assignment.
- Added backend and frontend formatting gates and the existing Supabase SQL test command to CI. Refreshed only development dependency lockfile entries within existing package ranges to clear npm audit findings; no production dependency declaration changed.
- Updated repository instructions and workflow documentation to distinguish implementation completion from environment-dependent validation. The API and creation worker must use the same `CONTENT_AGENT_*` settings when they submit versions.

## Checks run in this container

| Check                                                                                 | Result                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Fresh `npm ci` in root, backend, and frontend; shared build                           | Pass                                                                                 |
| Shared typecheck, format, tests                                                       | Pass, 6 tests                                                                        |
| Backend typecheck, lint, format, tests, OpenAPI, build                                | Pass, 85 tests; 3 live PostgreSQL tests skipped because `TEST_DATABASE_URL` is unset |
| Frontend typecheck, lint, format, tests, build                                        | Pass, 48 tests                                                                       |
| In-memory SQL migrations and use-case mapping                                         | Pass, 5 migrations and 97 mapped cases                                               |
| Backend and frontend `npm audit --audit-level=high`, including production-only audits | Pass, zero reported vulnerabilities after lockfile refresh                           |

These checks validate application logic against PGlite and the local build. They do not establish that Supabase type generation, pgTAP tests, browser flows, or PostgreSQL concurrency pass.

## Required environment-dependent gates

1. Run the [CI workflow](../../.github/workflows/ci.yml) on the closeout commit. Its backend job uses disposable PostgreSQL for the three live transaction tests. Its browser job starts local Supabase, runs `npm run db:test`, regenerates `shared/src/database.types.ts`, requires a clean generated-type diff, and runs Playwright. Report each job separately; a green local suite is not a substitute for these jobs.
2. If generated database types differ, inspect the schema and relationships against [the SQL migrations](../../supabase/migrations/) before committing the generated output. The repository copy was synchronized without a local Supabase stack; CI is the source of truth for drift.
3. Extend the existing [browser workflow suite](../../frontend/e2e/quiz-workflows.spec.ts) with a representative human review → ready-to-publish → gate publish path. The current browser tests exercise direct human publication. In a Docker-enabled test environment, also exercise agent creation and an automated review/gate using controlled local provider responses; keep real provider credentials out of tests.
4. Add a live PostgreSQL concurrency check for work-item claims and a rollback check for an agent gate completion. Current [workflow persistence tests](../../backend/tests/integration/agent-workflow.database.test.ts) verify fencing, idempotency, revision cycles, and human handoff with PGlite, while the existing live PostgreSQL tests cover quiz saves and attempts.
5. Before applying migrations to an existing development database, review the publication backfill and any legacy quiz memberships lacking publication evidence, then dry-run the migration sequence described in the [root README](../../README.md). Apply hosted migrations or push a branch only with explicit authorization.

## Review boundary for the next agent

Treat phases 1–4 as feature complete. Fix failures found by the gates above and keep new tests tied to existing behavior. Preserve the sponsor ownership rule, exact immutable version binding, claim fencing, reviewer self-review prohibition, separate review and gate decisions, and publication through the application service. The [workflow plan](content-production-workflow.md) and [ADR-004](../architecture/decisions/ADR-004-question-publication-boundary.md), [ADR-005](../architecture/decisions/ADR-005-human-review-and-work-queue.md), [ADR-006](../architecture/decisions/ADR-006-sponsored-agent-creation.md), and [ADR-007](../architecture/decisions/ADR-007-configured-agent-review-and-gate.md) define those boundaries. Cross-owner reviewer grants, external worker authentication, and finer version grants are separate product decisions, outside this closeout.
