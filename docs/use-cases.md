# V1 use cases

Checked entries have implemented automated coverage; environment-dependent tests can still be
skipped locally. Real PostgreSQL, Supabase, browser and hosted sign-in evidence is tracked separately
in [the restructure plan](plans/v1-domain-restructure.md). Public editors/orchestration are deferred.

- [x] **QN-01 · UI/API** Create private questions and edit unused owned content.
- [x] **QN-02 · UI/API** Permanently lock substantive content on first quiz use, including removal.
- [x] **QN-03 · UI/API** Owner tags, personal filtering and pagination.
- [x] **QZ-01 · UI/API** Direct private quiz composition, repetition, scoring and equivalent saves.
- [x] **QZ-02 · UI/API** Exclude foreign private questions and include accessible public IDs.
- [x] **QZ-03 · UI** Show attempted quiz locks while retaining taking and tagging.
- [x] **QZ-04 · Rule** Rollback quiz content/composition on a later failure.
- [x] **AT-01 · API** Private practice, fractional grading, learner ownership and immutable replacement history.
- [x] **AT-02 · API** Empty quiz exclusion and snapshot display settings.
- [x] **AT-03 · API** Invalid choice exclusion, optional unanswered questions and repeated shuffled sources.
- [x] **FB-01 · API** Direct feedback access and owner-only triage.
- [x] **FB-02 · API** Attempted-question feedback delivery to quiz and source owners.
- [x] **BT-01 · UI/API** Retain bounded immutable artifacts and materialize usable private questions.
- [x] **BT-02 · Rule** Rollback every imported question/tag/mapping on a later failure.
- [x] **CR-01 · Rule** Ordered lessons, movement, quiz reuse and public relationship integrity.
- [x] **CR-02 · API** Public hierarchy reads without mutation routes.
- [x] **SC-01 · API** Reject legacy/public creation and remove obsolete HTTP operations.
- [x] **SC-02 · Rule** Retain exact established Auth/profile through targeted rebuild.
- [x] **SC-03 · Rule** Serialize question editing against first use in real PostgreSQL.
- [x] **SC-04 · Rule** Serialize quiz editing against attempt start in real PostgreSQL.
- [x] **SC-05 · Rule** Serialize concurrent answers in real PostgreSQL.

- [ ] **FT-01 · API** Controlled public course/editor authoring and permissions (deferred).
- [ ] **FT-02 · API** Optional orchestration operating on core entities (deferred).
