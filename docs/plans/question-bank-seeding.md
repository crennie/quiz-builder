# Question bank seeding epic

**Status:** In progress · **Started:** 2026-10-01 · **Current phase:** 2 — pilot REST endpoints

**Checkpoint (2026-10-02):** Phase 1 is complete. The REST pilot is a local JSON draft at SEED-21; it has not been previewed in the application, retained, or materialized. No REST pilot questions have been submitted for human review yet. The five follow-on batches are also local drafts for Phase 3. Human review and the final publication gate follow materialization and submission.

## Goal and working boundaries

Seed a useful, reviewed bank of technical practice questions using the retained batch artifact and existing content workflow. A published question, rather than a generated draft, counts toward the goal. This is a content-production plan; implementation features continue to be tracked in the [use-case checklist](../use-cases.md).

The [batch ingestion flow](../architecture/dynamic/ingest-question-batch.md) accepts one versioned JSON artifact with 1–20 keyed questions, a declared source, and up to 10 batch-level tags. Retention, materialization as private drafts, per-question review submission, content review, and the final publication gate are separate actions. Imported questions cannot publish directly. An `external_agent` declaration routes content review to a human; the declaration is attributed to the uploader, not verified worker provenance. The configured creation worker currently creates one question at a time and does not emit batch artifacts ([BATCH-09](../use-cases.md#epic-11--question-batch-ingestion)).

## Work batches

### Phase 0 — prove the path

- [x] **SEED-00** Run the Supabase schema tests and generated database-type drift check against a migrated test database. Record the result.
- [x] **SEED-01** Run an imported test batch through review and final gate, then verify the published version through the bank list, detail, published-versions, and tag-filter API endpoints against the configured test database. Confirm an unsubmitted draft stays hidden.
- [x] **SEED-02** Provide a repeatable read-only API check for materialized batches against that database. Keep browser and local-only PostgreSQL test results recorded separately.

**Exit:** One imported test question can be traced from retained artifact to private draft, exact-version review, gate approval, and public bank API entry; schema and live API checks pass. **Completed 2026-10-01.**

### Phase 1 — plan the REST endpoints pilot

- [x] **SEED-10** Define ten distinct REST endpoints learning objectives across introductory, intermediate, and advanced levels for the first batch. Track the five follow-on topics separately.
- [x] **SEED-11** Agree on the [review rubric](rest-endpoints-pilot.md#agreed-review-rubric): correct answer, unambiguous wording, plausible distractors, useful explanation, stable technical claim, and no near-duplicate in the planned set or bank.
- [x] **SEED-12** Keep a [production ledger](rest-endpoints-pilot.md#coverage-and-tracking) outside the immutable artifact for learning objective, fact-checking reference, batch key, item key, question ID, version, and review outcome. The current artifact has no reference or per-question objective field.

**Exit:** Each pilot question has a learning objective and a reviewer can apply the agreed rubric consistently. **Completed 2026-10-01.**

### Phase 2 — pilot one topic

- [x] **SEED-20** Prepare one [ten-question JSON batch](../examples/rest-endpoints-pilot-batch.json) from the [REST example](../examples/rest-endpoints-batch.json), with stable item keys and a new UUID batch key. Use single-choice questions and meaningful explanations; check every answer against a reference.
- [ ] **SEED-21** Validate and preview the artifact, retain it, then materialize its private drafts. Resolve any content problems through new question versions while preserving the batch's original mappings.
- [ ] **SEED-22** Submit each current version, complete human content review and the final gate, and verify accepted versions in the bank. Record revisions, rejections, and time spent.

**Exit:** The pilot produces reviewed, published questions and a usable estimate of production and review effort. No question is counted before publication.

### Phase 3 — expand by topic

- [ ] **SEED-30** Prepare and inspect one ten-question batch per remaining topic, at most 20 questions per artifact, using the pilot rubric and stable keys. Five local drafts are in the [follow-on batch ledger](five-follow-on-batches.md); preview each before materialization.
- [ ] **SEED-31** Track drafted, submitted, approved, and published counts by topic and difficulty; record reasons for changes requested or rejection and check duplicates across batches.
- [ ] **SEED-32** Assemble one small topic quiz from published question versions for each completed topic. Quiz assembly is currently manual.

**Exit:** The agreed coverage is present as published versions, with no unresolved duplicate or pending review item silently counted as complete.

### Phase 4 — learn from attempts

- [ ] **SEED-40** Have learners take the topic quizzes and inspect feedback for ambiguity, unfair grading, weak distractors, and missing explanations.
- [ ] **SEED-41** Revise affected questions as new immutable versions and send them through the required review and gate path. Track the rate and cause of post-publication corrections.

**Exit:** Recurrent quality issues have been resolved and the rubric reflects what learner feedback revealed.

## Measures and decisions

Use published questions by topic and difficulty as the coverage measure. Track attrition at each workflow step and classify revision or rejection reasons so generation briefs and the rubric can improve. Review the REST pilot results before retaining or materializing the five follow-on batches. Keep automatic batch production ([BATCH-09](../use-cases.md#epic-11--question-batch-ingestion)) as a separate implementation decision after the manual artifact path proves useful.

## Phase 0 run log

**2026-10-01, repository container:** Extended the [batch browser scenario](../../frontend/e2e/question-batches.spec.ts) to claim human review, approve content, claim the final gate, publish one imported question, and confirm that the other unsubmitted draft remains absent from the bank. Playwright discovers the scenario, but it has not executed against a live stack.

| Check                                                         | Result                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run db:check-schema`                                     | Passed; six migrations applied in PGlite and constraints passed.                                      |
| `npm test` in `backend/`                                      | Passed; 90 tests passed and three live PostgreSQL tests skipped because `TEST_DATABASE_URL` is unset. |
| `npm run typecheck` and `npm run lint` in `frontend/`         | Passed.                                                                                               |
| Playwright `test --list` for the batch scenario               | Passed; one Chromium scenario discovered. This does not execute the scenario.                         |
| Prettier check of changed files                               | Passed.                                                                                               |
| Local Supabase SQL tests and generated-type drift check       | Not run: no Docker-compatible executable is installed.                                                |
| Live PostgreSQL backend tests and Playwright browser scenario | Not run: there is no local database URL or Supabase stack.                                            |

**Next gate at that time:** In a Docker-enabled environment, run the repository's CI-equivalent local Supabase schema test, generated-type comparison, backend tests with `TEST_DATABASE_URL`, and Playwright workflow. Review any generated-type difference before accepting it.

**Follow-up after connection setup (2026-10-01):** Both ignored `.env.local` files are present. The backend's read-only `npm run db:check` connects to the configured remote database. A read-only run of `scripts/check-hosted-schema.sql` reports that the expected agent and batch tables, constraints, immutable triggers, and full RLS set are not yet present. The migration history contains only `20260928174208` and `20260930120000`; four migrations remain. The database currently contains two questions, one quiz, and one attempt. No hosted migration or browser test was run, because each would write to this remote project. Local checks passed again: six PGlite migrations, 90 backend tests with three live PostgreSQL tests skipped, 49 frontend tests, both application builds, OpenAPI check, and Playwright discovery of the batch scenario. The live PostgreSQL tests require a local `quiz_builder_test` database, and this workspace still has no Docker-compatible runtime.

**Approved disposable-project run (2026-10-01):** The Supabase CLI dry run identified exactly the four pending migrations; applying them succeeded. A read-only follow-up reports all six migration versions and every flag in `scripts/check-hosted-schema.sql` as true. The original two questions, one quiz, and one attempt remained present. The eight pgTAP assertions in `supabase/tests/database/schema.test.sql` passed against this database using `pg`, because `supabase test db --db-url` still required Docker. Supabase type generation from the configured database was reviewed, saved to `shared/src/database.types.ts`, and reproduced with only trailing whitespace normalization. Shared, backend, and frontend typechecks pass.

A live backend-service check retained a new two-question batch, materialized both private drafts, bound review to the first immutable version, approved human review and the final gate, and found exactly that version in the owner's bank while the second remained a draft. This test data remains in the disposable project; the final read-only audit shows one batch, two batch items, one review decision, and one gate decision. The Playwright scenario started its app servers but Chromium could not launch: the container lacks `libglib-2.0.so.0`. Hosted Auth also rejected sign-up probes using the scenario's `example.test` domain and `example.com` with `email_address_invalid`. The browser run and three dedicated local-only PostgreSQL transaction tests remain separate infrastructure checks.

**API discovery check (2026-10-01):** Set the published test question to public visibility in the disposable test project, then called the Express HTTP routes with `supertest` while the app used the configured remote PostgreSQL database. The anonymous bank list, question detail, published-versions endpoint, and tag-filtered list returned the exact published version. The second mapped question remained absent from the list and returned 404 from the detail endpoint. The read-only `npm run check:batch-bank` command in `backend/` repeated these checks successfully: two mapped questions, one public published, one hidden. It checks the latest batch by default; pass a batch UUID after `--` to check a specific batch. This exercises the backend routes and real test database without a browser or long-running server.
