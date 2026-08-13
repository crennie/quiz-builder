# Quiz Builder Agent Instructions

## Project overview

Quiz Builder is an application for creating and practicing question-based
study content.

The repository contains both the frontend and backend applications.

The project is currently in its initial setup phase. Core application
architecture and tooling are still being established.

## Repository layout

The repository uses separate top-level directories for the two application
areas:

- `frontend/` — frontend application
- `backend/` — backend application

Project-wide configuration and documentation may remain at the repository
root.

Shared code may be introduced later if there is a concrete need for it. Do
not introduce a shared package structure or monorepo tooling preemptively.

When adding frontend code, place it under `frontend/`.

When adding backend code, place it under `backend/`.

## Current project state

This is an early-stage repository.

The Node.js development runtime is established, but the frontend and backend
applications have not yet been fully scaffolded.

Do not assume that a frontend framework, backend directory structure, test
framework, or shared-code architecture has been selected unless it is present
in the repository or specified in the task.

## Development environment

The project currently uses:

- Node.js 24 LTS
- npm
- ECMAScript modules

The canonical container development environment is defined in:

- `.devcontainer/Dockerfile`
- `.devcontainer/devcontainer.json`

Use the Node and npm versions supplied by the project container.

Development commands should reflect the actual frontend and backend tooling
present in the repository. Do not invent commands that do not exist.

Available backend development commands (run from `backend/`):

- `npm run dev` — start the Express development server with automatic restarts

## Planned backend stack

Backend code belongs under `backend/`.

The backend architecture is expected to use:

- Node.js
- Express 5
- TypeScript
- Zod for request and domain validation
- generated OpenAPI documentation/specification
- Pino for structured logging
- centralized Express error-handling middleware

The exact OpenAPI generation library and detailed backend structure have not
yet been selected.

Do not replace these planned technologies with alternatives without an
explicit project decision.

## Validation

Automated validation should use the actual commands provided by the project.

Available backend commands (run from `backend/`):

- `npm run typecheck` — type-check the backend TypeScript source without
  emitting files

As frontend and backend tooling are introduced, document their real linting,
type-checking, testing, and build commands here.

Until a validation command exists, report that the relevant validation
tooling has not yet been established rather than inventing a command.

## Engineering conventions

- Prefer small, understandable changes.
- Follow established project patterns once they exist.
- Do not introduce abstractions before they are needed.
- Keep architectural decisions explicit when establishing new project
  foundations.
- Avoid unrelated changes outside the requested task.

## Dependencies and tooling

The project's framework, package manager, and major dependencies may still be
undecided.

Do not choose or introduce major foundational technology unless:

- it is explicitly requested, or
- the task necessarily requires making that decision.

If multiple reasonable foundational choices exist and the choice materially
affects the project architecture, explain the tradeoff before making the
decision.

Do not add production dependencies unless they are necessary for the requested
work.

## Git

Local Git operations may be used for inspection and review.

Do not push or otherwise modify a remote repository unless explicitly
authorized.

## Completion criteria

For implementation tasks:

- the requested work is complete
- the resulting changes have been reviewed
- no unrelated changes were introduced
- any available validation has been run
- unavailable validation is clearly reported
