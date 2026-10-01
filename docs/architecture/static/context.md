# System context

**Scope:** Quiz Builder as one software system. Relationships show who uses it and which external services it depends on.

```mermaid
flowchart LR
    author["Quiz author<br/>Creates questions and quizzes; reviews feedback"]
    producer["Human or offline agent<br/>Prepares question batch JSON"]
    learner["Learner<br/>Takes quizzes; reviews results; sends feedback"]
    system["Quiz Builder<br/>Practice application"]
    auth["Supabase Auth<br/>Identity and access tokens"]
    postgres["Supabase Postgres<br/>Application records"]
    provider["Configured content provider<br/>External role-specific JSON service"]

    producer -->|Hands artifact to author| author
    author -->|Authors, uploads batches, and reviews via web or API| system
    learner -->|Practices and gives feedback via web or API| system
    system -->|Signs in users and verifies access tokens| auth
    system -->|Stores and reads versioned content, attempts, and feedback| postgres
    system -->|Trusted workers send bounded content tasks| provider
```

The backend API provides explicit question publication, review/work queue, question batch ingestion, quiz management, attempt, and feedback operations. An author can upload a batch made manually or by an offline agent, then materialize private drafts and submit them for review. Configured providers can create or act on content only through trusted workers; they have no application credentials. The web UI provides sign-in, authoring, batch upload, human review and publication actions, quiz taking, results, history, and feedback submission. Reviewing received feedback is currently API-only. Supabase Auth owns credentials and sessions. The application uses `auth.users.id` directly for profile and ownership IDs.
