# ADR-002: Enforce application authorization in the API

Status: Accepted
Date: 2026-09-29

## Context

Question-bank visibility, quiz attemptability, ownership, and feedback access have different rules. The frontend obtains Supabase access tokens, while application tables live in Supabase Postgres.

## Decision

The Express API is the v1 application-data access boundary. It verifies Supabase Auth user access tokens, uses `auth.users.id` as the profile and ownership UUID, and applies ownership, visibility, and lifecycle rules in protected operations. Public and unlisted reads use optional authentication where appropriate. RLS is enabled on application tables without direct Data API policies; the browser does not query those tables directly.

## Consequences

The API can apply domain-specific checks at each operation and avoids a second user-ID mapping. Every new route and query must enforce the correct access rule. The database RLS setup closes direct Data API access, but does not duplicate the API's authorization rules for its server-side database connection. Later direct client access would require explicit policies and an authorization review.

## Alternatives

Direct browser access to application tables with equivalent RLS policies would distribute access rules across the API and database. The v1 plan selects a single API boundary; stronger RLS remains a possible defense-in-depth extension.
