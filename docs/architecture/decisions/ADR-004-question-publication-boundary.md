# ADR-004: Separate question candidates from publication

Status: Accepted
Date: 2026-09-30

## Context

The original question API used `current_version_id` for both editing and bank reads and allowed callers to set question status during creation or metadata updates. A newer candidate could therefore become visible before deliberate publication. Quiz creation also accepted accessible draft versions. The content-production plan requires durable publication evidence for each selectable version, while preserving immutable quiz references.

## Decision

- New questions are drafts. Content edits create a new immutable candidate version and advance `current_version_id` only.
- `default_published_version_id` is the bank summary pointer. Bank list and detail return that version only when the question identity is published and visible to the caller. Owner management uses a separate read path for candidate content.
- The Phase 1 human workflow permits direct publication by the authenticated owner of their current candidate. It records direct approval and publication events, then changes the default pointer in one transaction. There is no agent identity or review workflow in this phase; later workflow policies must restrict publication before those are added. Unpublication clears the pointer; archive retains it but removes the question from the bank; restore returns to published only if a retained pointer has publication evidence.
- Append-only publication events establish that an exact version has been published. A new quiz membership may use any historically published version of a currently published question accessible to the quiz author. Existing quiz-version memberships remain pinned if the source question is later hidden.
- Review decisions and ready-to-publish work items are separate concepts to be implemented in the next workflow phase. They do not become question or version statuses.

## Consequences

The bank and owner-management APIs have distinct contracts and routes. Clients cannot publish through a creation or metadata payload. The quiz picker shows only historically published versions, and the backend repeats this check for every new membership. Correct answers remain visible in authorized bank content under the existing practice-content policy. Legacy published questions receive one publication-history entry for their current version; older versions do not gain invented publication evidence.

## Migration checks

Before applying to a database with content, inspect quiz memberships that reference a question version other than the current version of a published question. Such memberships remain valid historically but will not be newly selectable until that exact version is explicitly published. Also inspect published questions with no current version, which violate the pointer backfill requirement. The local repository has no data to preserve, but migration does not delete data.
