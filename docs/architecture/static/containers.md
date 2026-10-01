# Container view

**Scope:** Quiz Builder runtime and external services. A container here is a major runtime boundary, not necessarily a Docker container.

```mermaid
flowchart LR
    person["Author or learner<br/>Browser or API client"]
    web["Web application<br/>React, Vite, TypeScript<br/>Batch upload, authoring, attempts, results"]
    api["API<br/>Node.js, Express 5, TypeScript<br/>Authorization and domain operations"]
    worker["Content workers<br/>Trusted Node.js processes<br/>Creation, review, revision, gate"]
    provider["Configured role providers<br/>HTTPS JSON contracts"]
    auth["Supabase Auth<br/>External identity service"]
    db["Supabase Postgres<br/>Relational records and JSONB snapshots"]

    person -->|Uses over HTTPS| web
    person -->|May call JSON API over HTTPS| api
    web -->|Sign-in and session management via Supabase client| auth
    web -->|JSON HTTP API with bearer access token| api
    api -->|Verifies access token claims via Supabase client| auth
    api -->|Parameterized SQL through pg pool| db
    worker -->|Claims scoped work and applies workflow service through pg| db
    worker -->|Sends bounded task input and validates response| provider
    auth -->|Owns auth.users identity referenced by profiles| db
```

The web application uses TanStack Router and Query. Question and quiz management, JSON batch upload and materialization, agent creation requests, workflow status, human review, attempts, results, history, and feedback submission are wired into its UI. The API exposes question bank, batch and workflow, quiz, attempt, feedback, profile, and health routes. Batch artifacts can be prepared outside the runtime and uploaded by an authenticated author; ingestion and draft creation are separate API operations. Each agent role runs in a separate trusted backend worker process with no public machine API. The backend process submitting a version chooses the role policy; the worker and human routes use the same workflow transition service for decisions and publication. `shared/` is a build-time contracts package used by both applications, not a runtime container. SQL migrations define the schema; generated database types describe rows; shared Zod schemas validate domain and API payloads.

The local Vite server proxies `/api` to the API during development. Production hosting and network topology are not specified in this repository, so no deployment view is asserted.

The [API component view](components/api.md) expands the API boundary.
