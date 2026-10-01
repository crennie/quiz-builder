# Question bank seeding epic

**Status:** In progress · **Started:** 2026-10-01 · **Current phase:** 0 — prove the import-to-publication path

## Goal and working boundaries

Seed a useful, reviewed bank of technical practice questions using the retained batch artifact and existing content workflow. A published question, rather than a generated draft, counts toward the goal. This is a content-production plan; implementation features continue to be tracked in the [use-case checklist](../use-cases.md).

The [batch ingestion flow](../architecture/dynamic/ingest-question-batch.md) accepts one versioned JSON artifact with 1–20 keyed questions, a declared source, and up to 10 batch-level tags. Retention, materialization as private drafts, per-question review submission, content review, and the final publication gate are separate actions. Imported questions cannot publish directly. An `external_agent` declaration routes content review to a human; the declaration is attributed to the uploader, not verified worker provenance. The configured creation worker currently creates one question at a time and does not emit batch artifacts ([BATCH-09](../use-cases.md#epic-11--question-batch-ingestion)).

## Work batches

### Phase 0 — prove the path

- [ ] **SEED-00** Run the local Supabase schema tests and generated database-type drift check against the six migrations. Record the result.
- [ ] **SEED-01** Run the live PostgreSQL backend tests and the browser batch scenario through review, final gate, and question-bank discovery. Record each result separately.
- [ ] **SEED-02** Confirm that the phase can be repeated in the intended environment before importing real content. Do not count Docker-free tests as live-path evidence.

**Exit:** One imported test question can be traced from retained artifact to private draft, exact-version review, gate approval, and published bank entry; schema and live checks pass.

### Phase 1 — choose coverage and a review rubric

- [ ] **SEED-10** Define a first set of six technical topics with ten questions per topic and explicit learning objectives. Choose a mix of introductory, intermediate, and advanced questions rather than ten variants of one fact.
- [ ] **SEED-11** Agree on a review rubric: correct answer, unambiguous wording, plausible distractors, useful explanation, stable technical claim, and no near-duplicate in the planned set or bank.
- [ ] **SEED-12** Keep a production ledger outside the immutable artifact for learning objective, fact-checking reference, batch key, item key, question ID, version, and review outcome. The current artifact has no reference or per-question objective field.

**Exit:** Every planned question has a learning objective and a reviewer can apply the rubric consistently.

### Phase 2 — pilot one topic

- [ ] **SEED-20** Prepare one ten-question JSON batch from the [REST example](../examples/rest-endpoints-batch.json), with stable item keys and a new UUID batch key. Start with single-choice questions and meaningful explanations; check every answer against a reference.
- [ ] **SEED-21** Validate and preview the artifact, retain it, then materialize its private drafts. Resolve any content problems through new question versions while preserving the batch's original mappings.
- [ ] **SEED-22** Submit each current version, complete human content review and the final gate, and verify accepted versions in the bank. Record revisions, rejections, and time spent.

**Exit:** The pilot produces reviewed, published questions and a usable estimate of production and review effort. No question is counted before publication.

### Phase 3 — expand by topic

- [ ] **SEED-30** Produce the remaining five topic batches, at most 20 questions per artifact, using the pilot rubric and stable keys. Inspect each batch before materialization.
- [ ] **SEED-31** Track drafted, submitted, approved, and published counts by topic and difficulty; record reasons for changes requested or rejection and check duplicates across batches.
- [ ] **SEED-32** Assemble one small topic quiz from published question versions for each completed topic. Quiz assembly is currently manual.

**Exit:** The agreed coverage is present as published versions, with no unresolved duplicate or pending review item silently counted as complete.

### Phase 4 — learn from attempts

- [ ] **SEED-40** Have learners take the topic quizzes and inspect feedback for ambiguity, unfair grading, weak distractors, and missing explanations.
- [ ] **SEED-41** Revise affected questions as new immutable versions and send them through the required review and gate path. Track the rate and cause of post-publication corrections.

**Exit:** Recurrent quality issues have been resolved and the rubric reflects what learner feedback revealed.

## Measures and decisions

Use published questions by topic and difficulty as the coverage measure. Track attrition at each workflow step and classify revision or rejection reasons so generation briefs and the rubric can improve. Review the pilot results before committing to the remaining five topics. Keep automatic batch production ([BATCH-09](../use-cases.md#epic-11--question-batch-ingestion)) as a separate implementation decision after the manual artifact path proves useful.

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

**Next gate:** In a Docker-enabled environment, run the repository's CI-equivalent local Supabase schema test, generated-type comparison, backend tests with `TEST_DATABASE_URL`, and Playwright workflow. Review any generated-type difference before accepting it. Keep Phase 0 open until the live batch scenario reaches a published bank entry.
