# ADR-009: Direct V1 content and public course hierarchy

Status: accepted; supersedes ADR-001 and ADR-004 through ADR-008's version/review provisions.

## Context

The original version, publication, review and trusted-worker infrastructure complicates personal
practice and embeds orchestration state in content. Existing content is disposable; the established
Supabase Auth account and matching profile must survive the coordinated cutover.

## Decision

Store substantive question and quiz content directly. Personal HTTP creation is private. Public
records support trusted course fixtures; public authoring permissions are deferred. Public courses
contain ordered lessons, and lessons reuse public quizzes through explicit associations.

First quiz inclusion permanently locks substantive question content. Any attempt locks quiz content
and composition. Equivalent saves do not mutate records. Changes after use require independent new
records, with no revision chains or hidden content versions. Tags remain editable under ownership.

Keep historical evidence in immutable attempt snapshots, including quiz title, settings, required
flags, timing, answer/grading configuration and points. Grade and present from those snapshots.
Keep verified authentication, ownership, feedback triage, deterministic grading and retained private
batch import. Delete review/publication/agent/work-item infrastructure entirely.

Enforce access relationships and immutability with transactional parent/source locks and SQL
triggers. A public quiz contains public questions; a private quiz contains only public or its owner's
private questions. A lesson-associated quiz stays public. RLS remains closed to browser Data API access.

## Consequences

The schema/API/UI cutover is intentionally incompatible with the old domain. A targeted application
rebuild retains Auth and profile rows untouched; a blanket account-destroying reset is unacceptable.
Fresh database, preservation, authorization, lock, snapshot, course, import and real PostgreSQL race
tests replace obsolete workflow tests. Public editing and orchestration can be introduced as
separate controlled capabilities later without adding workflow state to V1 records.
