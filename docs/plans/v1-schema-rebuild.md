# V1 application schema rebuild

This is a coordinated schema/API/frontend replacement, not a lossless upgrade. All application
content is disposable; Supabase-managed Auth and the established profile must remain untouched.
The prepared script defaults to a read-only preflight. Hosted execution requires explicit approval
under the repository's external-write rule.

## Prepared target

Read-only inspection of the configured development database found one matching Auth/profile UUID:
`2f8bb7f8-1c96-4994-9fe2-77047c68a565`. No password/token data was read. The preflight passed on
2026-10-13. Recheck immediately before execution because the environment may change.

## Procedure

1. Validate the clean baseline in a disposable database with `npm run db:check-schema`, backend
   persistence/preservation tests, and a fresh local Supabase stack. Never reset the existing
   development database to perform these checks.
2. Stop all API and old content-worker writes against the target. Confirm the intended development
   environment; keep its connection URL in ignored configuration. Do not inspect Auth credentials.
3. Run the read-only preflight:

    ```sh
    node --env-file=backend/.env.local scripts/application-rebuild.mjs --check 2f8bb7f8-1c96-4994-9fe2-77047c68a565
    ```

4. Review [the script](../../scripts/application-rebuild.mjs) and the
   [clean baseline](../../supabase/migrations/20261013120000_v1_baseline.sql). After environment
   approval, execute with writers stopped:

    ```sh
    node --env-file=backend/.env.local scripts/application-rebuild.mjs --execute 2f8bb7f8-1c96-4994-9fe2-77047c68a565 --writers-stopped
    ```

    The transaction locks profiles, checks the matching account, rejects unknown tables/FK dependents
    or dependent views, and removes only the explicit application content tables/functions/types.
    It retains `profiles` in place, applies the baseline without recreating profiles, compares every
    retained profile and Auth UUID, and records the new baseline in existing Supabase migration history.
    Failure rolls everything back. No statement updates or deletes Auth rows.

5. Run the read-only hosted schema check in `scripts/check-hosted-schema.sql`; every column must be
   true. Regenerate types with `npm run db:types -- --db-url`, or validate them with `--check`.
6. Build shared/backend/frontend together, restart the API, and sign in through the existing test
   account. Verify `GET /api/v1/me` returns the same UUID and exercise private question creation,
   quiz composition, attempt/answer/completion/history/feedback, and private batch materialization.
   Account preservation tests do not replace a real sign-in check.

## Environment gates

The implementation container has no Docker or PostgreSQL executables. PGlite creation and exact
profile/Auth UUID preservation are tested locally. Supabase pgTAP, full Playwright journeys, and PostgreSQL concurrency tests require a disposable
environment. Hosted Supabase type parity and live Auth/API verification have passed. The hosted rebuild and post-cutover sign-in were completed after user approval; no blanket
`supabase db reset` is part of this procedure.

## Completed cutover (2026-10-13)

The user approved execution. With local writers stopped and no active application write locks,
the transactional rebuild retained the sole Auth identity and exact profile unchanged. All seven
hosted schema checks pass. The existing infrastructure `remote_schema` migration remains; old
application migration records were replaced with `20261013120000_v1_baseline`.

Supabase types were regenerated directly from the hosted schema and the type-parity check passes.
The established account signed in successfully and `/api/v1/me` returned
`2f8bb7f8-1c96-4994-9fe2-77047c68a565`. Thirty live API checks passed for personal authoring,
question/quiz locks, attempts, required answers, deterministic 2.5/2.5 grading, history, feedback,
private idempotent batch import and removed endpoints. Private-import digest/mapping/access
verification passed. Smoke content is retained under the established account for inspection.

API port 3000 and frontend port 5173 were verified against the V1 schema; frontend Auth configuration
matches the backend and proxied health/course reads passed. Both development servers were stopped
gracefully after validation at the user's request. Full browser/concurrency suites remain
for a disposable environment. Do not rerun the rebuild merely to execute those tests.
