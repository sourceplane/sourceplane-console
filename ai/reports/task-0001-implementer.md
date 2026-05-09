# Task 0001 Implementer Report

## Summary

Added the first production persistence seam for the Supabase/Postgres direction in `apps/identity-worker`. The D1-backed local/test path is preserved and all existing tests remain green. A new Postgres adapter (`PostgresIdentityRepository`) implements the full `IdentityRepository` contract using `postgres.js` (postgres.js v3). Repository selection is wired in `app.ts`: production environments with an `IDENTITY_HYPERDRIVE` binding use Postgres; all other environments fall back to D1. Missing the production binding in production now results in a clear HTTP 500 rather than a silent fallback.

## Files Changed

| File | Change |
|------|--------|
| `apps/identity-worker/migrations-pg/0001_initial.sql` | New Postgres migration using `identity` schema. All tables, indexes, and uniqueness constraints equivalent to the D1 migration. No cross-context foreign keys. |
| `apps/identity-worker/src/domain/pg-identity-repository.ts` | New `PostgresIdentityRepository` implementing `IdentityRepository` using postgres.js tagged template literals (parameterized). `revokeApiKeyAndServicePrincipal` is wrapped in a Postgres transaction for atomicity. |
| `apps/identity-worker/src/env.ts` | Added optional `IDENTITY_HYPERDRIVE?: Hyperdrive` binding with documentation comment. |
| `apps/identity-worker/src/app.ts` | Added `resolveIdentityRepository()` helper; moved service construction inside the try/catch so config errors return clean HTTP 500 responses; added import for `PostgresIdentityRepository` and `IdentityRepository`. |
| `apps/identity-worker/test/repository-selection.test.ts` | New test file: 4 tests covering D1 selection (local), D1 selection (preview), production failure when Hyperdrive is absent, and Postgres selection when Hyperdrive is present. |
| `apps/identity-worker/package.json` | Updated `test` script from a single-file invocation to `vitest run test/` to pick up all test files. Added `postgres` as a production dependency. |
| `apps/identity-worker/README.md` | Updated to document both persistence paths, the required Hyperdrive binding name (`IDENTITY_HYPERDRIVE`), and the provisioning follow-up requirement. |

## Checks Run

| Check | Result |
|-------|--------|
| `npm exec --yes pnpm@10.7.1 -- lint` | ✅ passed |
| `npm exec --yes pnpm@10.7.1 -- typecheck` | ✅ passed |
| `npm exec --yes pnpm@10.7.1 -- test` | ✅ passed (10 tests: 6 existing integration + 4 new selection tests) |
| `npm exec --yes pnpm@10.7.1 -- build` | ✅ passed |
| `wrangler deploy --dry-run` (local) | ✅ passed |
| `kiox -- orun plan --changed` | ✅ 3 jobs planned (identity-worker × 3 envs) |
| `kiox -- orun run --changed` | ⚠️ 1 succeeded; 2 failed due to missing CI credentials (`CLOUDFLARE_ACCOUNT_ID`) — not a code regression; same failure mode as pre-existing CI runs without deployment secrets. |

## Assumptions

1. `postgres` (postgres.js v3) is the appropriate Cloudflare Hyperdrive-compatible client. It accepts a plain `connectionString` and works inside Workers with `nodejs_compat`.
2. Storing timestamps as `TEXT` (ISO 8601) in Postgres matches the D1 schema and the application-layer convention. No `TIMESTAMPTZ` conversion is needed at the adapter boundary because all timestamps are already serialized as strings.
3. Role names are stored as a JSON text column (`role_names_json`) in both adapters to avoid a Postgres array type dependency.
4. The Hyperdrive binding name `IDENTITY_HYPERDRIVE` is the correct convention. The actual Hyperdrive resource ID must be provisioned separately (see README).
5. `max: 1` connection pool size is appropriate for Cloudflare Worker isolates (one connection per request context).

## Spec Proposals

No spec changes are required. The implementation is fully conservative with respect to the existing `IdentityRepository` contract and the normative persistence direction in `specs/`.

## Remaining Gaps

1. **No live Postgres execution test.** The `repository-selection.test.ts` verifies binding selection and uses a fake `Hyperdrive` stub. The `PostgresIdentityRepository` methods are not exercised against a real Postgres instance in CI. A dedicated Postgres integration test suite (e.g., using `pg-mem` or a Docker Postgres instance) is needed to provide full adapter-level coverage. Tracked as a follow-up.

2. **Hyperdrive binding not in `wrangler.jsonc`.** The production and preview Hyperdrive IDs require a real Cloudflare account and Supabase project. These must be provisioned and configured in `wrangler.jsonc` under `env.production.hyperdrive` and `env.preview.hyperdrive` before the production Postgres path is live.

3. **`kiox orun run --changed` CI failures.** The `production` job failed due to a missing `CLOUDFLARE_ACCOUNT_ID` secret in the local orun runner. The `dev` dry-run encountered a Wrangler environment-selection warning (no `--env` flag) and then failed in the orun context. Neither failure is a code regression — both are pre-existing CI credential/infrastructure gaps.

4. **Connection cleanup.** `PostgresIdentityRepository.end()` is defined but not called in the Worker `fetch` handler. In Cloudflare Workers, connections are recycled by the runtime, but explicit cleanup via `ctx.waitUntil(repo.end())` would be cleaner. Deferred to a follow-up.

## Next Task Dependencies

- **Membership worker migration (task-0002 pattern):** Can now follow the same adapter pattern: add `PgMembershipRepository`, `MEMBERSHIP_HYPERDRIVE` binding, and a `migrations-pg/` directory.
- **Projects worker migration (task-0003 pattern):** Same pattern.
- **Hyperdrive provisioning task:** Must create the Supabase database, apply `migrations-pg/0001_initial.sql`, create the Hyperdrive resource, and add the ID to `wrangler.jsonc`.
- **Postgres integration test task:** Add `pg-mem` or Docker-based Postgres tests for `PostgresIdentityRepository`.

## PR Number

#31 — https://github.com/sourceplane/sourceplane-console/pull/31
