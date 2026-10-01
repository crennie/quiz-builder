# Architecture constraints

These constraints come from the [Architecture & Implementation Plan](../../../architecture-plan.md), repository conventions, and the implemented schema.

- Use Node.js 24, TypeScript, npm, and ECMAScript modules for application code.
- Keep the React web app in `frontend/`, the Express API in `backend/`, and runtime contracts in `shared/`.
- Use Supabase Auth for user identity. Profile and ownership IDs equal `auth.users.id`; do not accept unverified token payloads.
- Use Supabase Postgres as the authoritative relational store. SQL migrations define the schema; use parameterized `pg` queries, explicit transactions for multi-step changes, and no ORM.
- Use Zod for API and JSONB runtime validation. Generated database types describe rows but do not replace runtime validation.
- Preserve immutable question and quiz versions, exact question-version references in quizzes, and frozen attempt snapshots.
- Keep candidate question content separate from published bank projections. Publication requires an explicit direct-human action where policy allows it or a qualifying final-gate decision; content review approval alone does not publish.
- Keep provider credentials and fixed machine actor IDs in trusted backend workers. Providers receive bounded, validated tasks and cannot access application tables or use a public machine-completion API.
- Keep review/gate decisions, policy snapshots, generation/execution provenance, and work-item routing as separate durable records. Claims must be fenced before applying domain effects.
- Enforce ownership and visibility in the backend. A quiz's visibility governs attempts; a question's visibility governs question-bank access. Public practice content does not promise secret answers.
- Support only implemented deterministic question types in authoring and quiz use: exact text, single choice, and multiple choice.
- Keep points numeric and potentially fractional; do not impose a global percentage or partial-credit policy.

Production hosting, capacity targets, and operational recovery targets are not specified by the current repository documents. The local stack and CI workflow do not establish a production deployment topology.
