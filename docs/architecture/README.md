# Architecture

## System

Quiz Builder is a practice application for authoring reusable questions and versioned quizzes, taking quizzes, grading deterministic answers, and reviewing feedback. It preserves the exact content used by historical attempts. The backend supports these flows; the current web interface supports sign-in and question management, with quiz and attempt screens still planned.

## Architecture Views

- [Static structure](static/context.md): system context, runtime containers, domain, data, and API components.
- [Runtime behavior](dynamic/save-quiz.md): significant save and attempt flows.
- Decisions: [versioning](decisions/ADR-001-immutable-content-versions.md),
  [authorization](decisions/ADR-002-api-authorization-boundary.md), and
  [attempt evaluation storage](decisions/ADR-003-jsonb-attempt-evaluation.md).
- [Constraints and quality](quality/constraints.md): fixed choices and quality expectations.

## Key Artifacts

- [Container view](static/containers.md)
- [Domain model](static/domain.md) and [data model](static/data.md)
- [Save quiz](dynamic/save-quiz.md) and [take quiz attempt](dynamic/take-quiz-attempt.md)
- [Quality requirements](quality/requirements.md)

## Current Architecture Summary

A client-rendered React application calls an Express API. The API verifies Supabase Auth access tokens, owns authorization and domain operations, and uses parameterized SQL against Supabase Postgres. Shared Zod contracts validate API and JSONB data. Immutable question and quiz versions, plus attempt snapshots, protect historical results. The [Architecture & Implementation Plan](../../architecture-plan.md) records the target design and phase order; these views describe the implemented boundaries and identify unfinished UI work.
