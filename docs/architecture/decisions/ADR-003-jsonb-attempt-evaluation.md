# ADR-003: JSONB attempt snapshots and evaluation

Status: accepted; direct identity fields clarified by ADR-009.

Store immutable presentation/answer/grading snapshots alongside a response and evaluation JSONB on
each attempt question. The attempt also snapshots quiz title and settings; required flags, timing and
points belong to immutable attempt-question columns. Direct quiz/question FKs identify sources but
historical reads and grading never join current source content or composition.
Shared Zod schemas validate snapshots, responses, evaluation and numeric score summaries. Exact
text/single/multi choice grading remains synchronous. Learner-only ownership and snapshotted display
settings govern presentation. Separate response/evaluation tables and fuzzy/manual evaluation are deferred.
