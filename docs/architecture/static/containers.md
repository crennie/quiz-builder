# Container view

**Scope:** Quiz Builder runtime and external services. A container here is a major runtime boundary, not necessarily a Docker container.

```mermaid
flowchart LR
    person["Author or learner<br/>Browser or API client"]
    web["Web application<br/>React, Vite, TypeScript<br/>Current UI: sign-in and question management"]
    api["API<br/>Node.js, Express 5, TypeScript<br/>Authorization and domain operations"]
    auth["Supabase Auth<br/>External identity service"]
    db["Supabase Postgres<br/>Relational records and JSONB snapshots"]

    person -->|Uses over HTTPS| web
    person -->|May call JSON API over HTTPS| api
    web -->|Sign-in and session management via Supabase client| auth
    web -->|JSON HTTP API with bearer access token| api
    api -->|Verifies access token claims via Supabase client| auth
    api -->|Parameterized SQL through pg pool| db
    auth -->|Owns auth.users identity referenced by profiles| db
```

The web application uses TanStack Router and Query. Only question management calls are wired into its UI today. The API exposes question bank, quiz, attempt, feedback, profile, and health routes. `shared/` is a build-time contracts package used by both applications, not a runtime container. SQL migrations define the schema; generated database types describe rows; shared Zod schemas validate domain and API payloads.

The local Vite server proxies `/api` to the API during development. Production hosting and network topology are not specified in this repository, so no deployment view is asserted.

The [API component view](components/api.md) expands the API boundary.
