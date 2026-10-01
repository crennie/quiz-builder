# Content workflow closeout and agent handover

**Phase 4 closeout snapshot (2026-10-01):** Phases 1–4 are implemented in the repository. Docker-free validation passed at closeout. Full release validation remained pending because this container had no Docker executable, so it could not run the local Supabase stack, generated-type drift check, browser tests, or a live PostgreSQL service. No migration was applied to a hosted project and no branch was pushed. The later question-batch extension is covered by [ADR-008](../architecture/decisions/ADR-008-question-batch-artifact-ingestion.md) and the [current phase index](../architecture/README.md#content-workflow-phase-coverage).

## Completed in this closeout

- Corrected the in-memory migration checker to include `agent_execution_runs` in its 21-table assertion.
- Added an upgrade test that applies the Phase 4 migration over existing human review/gate decisions and a claimed Phase 3 creation item. It checks actor attribution and preservation of the claim while backfilling machine assignment.
- Added backend and frontend formatting gates and the existing Supabase SQL test command to CI. Refreshed only development dependency lockfile entries within existing package ranges to clear npm audit findings; no production dependency declaration changed.
- Updated repository instructions and workflow documentation to distinguish implementation completion from environment-dependent validation. The API and creation worker must use the same `CONTENT_AGENT_*` settings when they submit versions.

## Checks run for the Phase 4 closeout

| Check                                                                                 | Result                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Fresh `npm ci` in root, backend, and frontend; shared build                           | Pass                                                                                 |
| Shared typecheck, format, tests                                                       | Pass, 6 tests                                                                        |
| Backend typecheck, lint, format, tests, OpenAPI, build                                | Pass, 85 tests; 3 live PostgreSQL tests skipped because `TEST_DATABASE_URL` is unset |
| Frontend typecheck, lint, format, tests, build                                        | Pass, 48 tests                                                                       |
| In-memory SQL migrations and use-case mapping                                         | Pass, 5 migrations and 97 mapped cases                                               |
| Backend and frontend `npm audit --audit-level=high`, including production-only audits | Pass, zero reported vulnerabilities after lockfile refresh                           |

These dated counts describe the Phase 4 closeout before batch ingestion was added. They validate application logic against PGlite and the local build; they do not establish that Supabase type generation, pgTAP tests, browser flows, or PostgreSQL concurrency pass.

## Current repository after batch ingestion

The repository now has six SQL migrations and 121 checked use cases mapped to named tests. The latest local package runs passed 90 backend tests (3 live PostgreSQL tests skipped), 49 frontend tests, and 7 shared-contract tests; typecheck, lint, formatting, and the use-case map also passed. A new batch browser scenario is present and discoverable by Playwright, but it has not run here because Docker is unavailable. These counts include the batch extension and supersede the snapshot counts above for current coverage. See the [architecture phase index](../architecture/README.md#content-workflow-phase-coverage) for current behavior.

## Required environment-dependent gates

1. Run the [CI workflow](../../.github/workflows/ci.yml) on the current commit. Its backend job uses disposable PostgreSQL for the three live transaction tests. Its browser job starts local Supabase, runs `npm run db:test`, regenerates `shared/src/database.types.ts`, requires a clean generated-type diff, and runs Playwright, including the batch-ingestion scenario. Report each job separately; a green local suite is not a substitute for these jobs.
2. If generated database types differ, inspect the schema and relationships against [the SQL migrations](../../supabase/migrations/) before committing the generated output. The repository copy was synchronized without a local Supabase stack; CI is the source of truth for drift.
3. Extend the [browser workflow suite](../../frontend/e2e/quiz-workflows.spec.ts) with a representative human review → ready-to-publish → gate publish path. The current quiz browser tests exercise direct human publication; the [batch browser test](../../frontend/e2e/question-batches.spec.ts) reaches the queued review item but does not decide it. In a Docker-enabled test environment, also exercise agent creation and an automated review/gate using controlled local provider responses; keep real provider credentials out of tests.
4. Add a live PostgreSQL concurrency check for work-item claims and a rollback check for an agent gate completion. Add a focused service test for new quiz membership selection when an older version is published and a newer candidate has never been published. Current [workflow persistence tests](../../backend/tests/integration/agent-workflow.database.test.ts) verify fencing, idempotency, revision cycles, and human handoff with PGlite, while the existing live PostgreSQL tests cover quiz saves and attempts.
5. Before applying migrations to an existing development database, review the publication backfill and any legacy quiz memberships lacking publication evidence, then dry-run the migration sequence described in the [root README](../../README.md). Apply hosted migrations or push a branch only with explicit authorization.

## Review boundary for the next agent

Treat phases 1–4 and the later batch-ingestion extension as feature complete. Fix failures found by the gates above and keep new tests tied to existing behavior. Preserve sponsor ownership, exact immutable version binding, claim fencing, the prohibition on an agent reviewing its own generated version, separate review and gate decisions, and publication through the application service. The [architecture phase index](../architecture/README.md#content-workflow-phase-coverage) links the runtime views and ADRs for each slice. Cross-owner reviewer grants, external worker authentication, finer version grants, and automatic batch production are separate product decisions, outside this closeout.
