# ADR-001: Keep immutable question and quiz content versions

Status: Accepted
Date: 2026-09-29

## Context

Quiz authors can edit reusable questions and quiz composition after learners have started or finished attempts. Historical attempts must retain the content and grading rules that were actually presented. Re-saving equivalent quiz content should not create redundant versions.

## Decision

Questions and quizzes have stable identity rows and immutable content-version rows. Each quiz-version membership pins an exact question version. The backend compares saved quiz content with the current version and creates a new quiz version only when attempt-relevant content changes. Starting an attempt records its quiz version and freezes settings, question, answer, grading, and points data. Multi-row changes use transactions; database constraints and triggers protect version and snapshot integrity.

## Consequences

Old quizzes and attempts remain stable when source questions or current quiz content change. Authors must explicitly adopt a newer question version. Versions and snapshots increase storage and require careful transactional writes. Tags, visibility, and lifecycle metadata can change without generating a content version.

## Alternatives

Updating content in place would make historical quiz and grading behavior depend on later edits. Automatically making a quiz version on every save would preserve history but create duplicate versions for equivalent content. These alternatives do not meet the documented versioning invariants.
