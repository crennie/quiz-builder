# Save quiz content

**Scenario:** An authenticated owner saves the attempt-relevant content of an existing quiz through `PUT /api/v1/quizzes/:quizId/content`. The current web UI does not expose this operation yet.

```mermaid
sequenceDiagram
    actor Owner
    participant API as Express route
    participant Auth as Auth middleware
    participant Store as Quiz operation and pg transaction
    participant DB as Postgres

    Owner->>API: PUT quiz content with bearer token
    API->>Auth: Verify token and resolve profile
    Auth-->>API: Verified user ID
    API->>API: Validate content with Zod
    API->>Store: Save content as owner
    Store->>DB: Lock owned quiz row; load current version
    alt Missing or archived quiz
        Store-->>API: 404 or 409
    else Equivalent canonical content
        Store-->>API: Current quiz detail; no new version
    else Changed content
        Store->>DB: Check new question-version membership and publishability
        alt Invalid or unavailable content
            Store-->>API: 404 or 409; transaction rolls back
        else Allowed
            Store->>DB: Insert quiz version and ordered membership
            Store->>DB: Update current_version_id; commit
            Store-->>API: New quiz detail
        end
    end
    API-->>Owner: Validated JSON response or error
```

The comparison is performed by the backend on normalized content: title, description, settings, and ordered question IDs, version IDs, points, required flags, and time limits. Visibility, status, and tags are metadata outside this version. Retained question-version references remain valid if source visibility later changes; newly added references must be available to the author. The row lock serializes competing saves. The transaction keeps the new version, membership, and current pointer together; immutable database triggers protect prior versions. See [ADR-001](../decisions/ADR-001-immutable-content-versions.md).
