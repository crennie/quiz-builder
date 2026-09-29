# System context

**Scope:** Quiz Builder as one software system. Relationships show who uses it and which external services it depends on.

```mermaid
flowchart LR
    author["Quiz author<br/>Creates questions and quizzes; reviews feedback"]
    learner["Learner<br/>Takes quizzes; reviews results; sends feedback"]
    system["Quiz Builder<br/>Practice application"]
    auth["Supabase Auth<br/>Identity and access tokens"]
    postgres["Supabase Postgres<br/>Application records"]

    author -->|Authors and reviews via web or API| system
    learner -->|Practices and gives feedback via web or API| system
    system -->|Signs in users and verifies access tokens| auth
    system -->|Stores and reads versioned content, attempts, and feedback| postgres
```

The backend API already provides quiz management, attempt, and feedback operations. The current web UI provides sign-in and question management; the remaining user journeys are API-only for now. Supabase Auth owns credentials and sessions. The application uses `auth.users.id` directly for profile and ownership IDs.
