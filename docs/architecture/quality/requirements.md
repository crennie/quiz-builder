# Quality requirements

Authorization tests cover private exclusion, owner mutations, public reads, rejected ordinary public
creation/promotion, invalid tokens, learner-only attempts, tag ownership, sponsored imports and
feedback recipients. SQL tests cover permanent question locks, all-status quiz locks, immutable
self-contained snapshots, exactly-one feedback targets, public composition, lesson relationships,
movement/order collisions, public association and cross-course reuse. Rollback tests cover partial
quiz/import writes; PostgreSQL races cover edits versus use, saves versus starts and repeated answers.

Run shared typecheck/tests/build, schema checks and use-case mapping; backend typecheck/lint/tests/
format/OpenAPI/build; frontend typecheck/lint/tests/format/build. With disposable environments run
Supabase pgTAP/type parity and Playwright. PGlite alone is insufficient concurrency evidence.
The rebuild must retain the established Auth/profile UUID and require post-cutover sign-in verification.
