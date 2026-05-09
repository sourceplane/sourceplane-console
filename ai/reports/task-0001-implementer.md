# task-0001-implementer

## Summary

Added the first production persistence seam for the Supabase/Postgres direction in `apps/identity-worker`. The Worker now selects a Postgres repository adapter (via Cloudflare Hyperdrive `sourceplane-db`) when the `IDENTITY_HYPERDRIVE` binding is present, and falls back to D1 for local development and all Vitest tests. Production environments without a Hyperdrive binding fail immediately with a clear 500 error instead of silently using D1.

## Files Changed

| File | Change |
|---|---|
| `apps/identity-worker/migrations/pg/0001_initial.sql` | New. Postgres-compatible identity schema in the `identity` namespace. Equivalent coverage to D1 migration 0001. |
| `apps/identity-worker/src/domain/pg-identity-repository.ts` | New. `PgIdentityRepository` implements `IdentityRepository` using `postgres` (postgres.js). All queries parameterized. Multi-step mutations (`ensureUser`, `revokeApiKeyAndServicePrincipal`) use transactions. |
| `apps/identity-worker/src/env.ts` | Added optional `IDENTITY_HYPERDRIVE?: Hyperdrive` binding. |
| `apps/identity-worker/src/app.ts` | Added `resolveIdentityRepository()`. Moved service construction inside `try/catch` so binding-missing errors are handled as 500 responses. |
| `apps/identity-worker/wrangler.jsonc` | Added `hyperdrive` binding (`d9c62c4acf934dd7bb82f63ed02db564`) in `preview` and `production` envs. |
| `apps/identity-worker/package.json` | Added `postgres@^3.4.9` dependency. Updated test script to include both test files. |
| `apps/identity-worker/test/repository-selection.test.ts` | New. 3 tests covering D1 fallback, production hard-fail, and Pg adapter construction. |
| `apps/identity-worker/README.md` | Updated to document dual-path persistence, repository selection table, migration instructions, and secret requirements. |
| `.gitignore` | Re-added `# orun per-job staged workspaces / .orun/runs/` (was removed by git stash during verification). |

## Checks Run

| Gate | Result |
|---|---|
| `npm exec --yes pnpm@10.7.1 -- lint` | ✓ Pass |
| `npm exec --yes pnpm@10.7.1 -- typecheck` | ✓ Pass |
| `npm exec --yes pnpm@10.7.1 -- test` | ✓ Pass (9/9 identity tests, 59 total across repo) |
| `npm exec --yes pnpm@10.7.1 -- build` | ✓ Pass |
| `wrangler deploy --dry-run` (local env, wrangler 4.84.1) | ✓ Pass |
| `wrangler deploy --dry-run --env preview` (wrangler 4.84.1) | ✓ Pass — Hyperdrive binding `d9c62c4acf934dd7bb82f63ed02db564` shown |
| `/Users/irinelinson/.local/bin/kiox -- orun plan --changed` | ✓ Pass — 1 component × 3 envs → 3 jobs planned |
| `/Users/irinelinson/.local/bin/kiox -- orun run --changed` | ✗ 2 of 3 jobs failed (see note below) |

### orun run note

The 2 failing orun jobs (`dev/verify-deploy-cloudflare-worker-turbo`, `production/verify-deploy-cloudflare-worker-turbo`) are **pre-existing failures**. Verified by stashing all changes and running `orun run --changed` against the unmodified baseline — same 2 jobs failed with the same errors:

- `production` job: `CLOUDFLARE_ACCOUNT_ID` env var not present in local orun runner (requires CI environment).
- `dev` job: wrangler build error "Build failed with 7 errors" in the orun-isolated workspace. The same `wrangler deploy --dry-run` passes locally with wrangler 4.84.1, suggesting a workspace isolation or node version mismatch in the orun runner (node 25.6.1 vs component spec `nodeVersion: "22"`).

My changes do not introduce new orun failures.

### Hyperdrive verification

```
wrangler hyperdrive list

id                               | name           | user     | host                                | port | scheme     | database
d9c62c4acf934dd7bb82f63ed02db564 | sourceplane-db | postgres | db.kfgwglxvxoiisoakkndm.supabase.co | 5432 | PostgreSQL | postgres
```

The `sourceplane-db` Hyperdrive config is confirmed active in the Cloudflare account (`f9270f828799775bebf9315248fdf717`). The Hyperdrive ID is used verbatim in `wrangler.jsonc` for the `preview` and `production` environments.

## Assumptions

1. `postgres` (postgres.js) is compatible with the Cloudflare Workers runtime via the `nodejs_compat` compatibility flag (already set in `wrangler.jsonc`). Local wrangler dry-runs confirm the bundle compiles.
2. The Supabase Postgres database is accessible through the `sourceplane-db` Hyperdrive at deploy time. This task does not apply the `migrations/pg/0001_initial.sql` migration — that requires a one-time run against the Supabase database using Supabase dashboard credentials (not committed).
3. ISO 8601 string timestamps stored by the D1 path are compatible with Postgres `TIMESTAMPTZ`. The Pg adapter normalizes Postgres `Date` objects back to ISO strings at the mapping layer, so the `IdentityRepository` contract is preserved.
4. `role_names_json` is stored as `TEXT` (JSON string) in Postgres to match the D1 approach, avoiding a Postgres-specific `jsonb` dependency in the schema.

## Spec Proposals

None required. The implementation is consistent with the normative specs.

## Remaining Gaps

1. **Live Postgres execution tests**: The new `repository-selection.test.ts` verifies adapter selection and hard-fail behavior but does not execute real queries against Postgres. A full integration test against a live Postgres instance (e.g. via a Supabase test database or a Docker Postgres container) is not wired in this repo yet. This is recorded as a follow-up gap.

2. **Postgres migration apply step**: `migrations/pg/0001_initial.sql` needs to be applied manually to the Supabase database before the identity worker can serve traffic in preview or production. No automated migration runner for Postgres is set up in this PR (D1 migrations continue to use wrangler). A follow-up task should establish the Postgres migration apply workflow.

3. **orun runner pre-existing failures**: The orun `dev` and `production` verify-deploy jobs fail for reasons unrelated to this PR (node version mismatch, missing `CLOUDFLARE_ACCOUNT_ID`). These should be investigated in a separate task.

4. **Preview D1 binding**: The `preview` environment still has both `IDENTITY_DB` (D1) and `IDENTITY_HYPERDRIVE`. Since Hyperdrive takes precedence, D1 is effectively unused in preview. The D1 binding can be removed from preview in a follow-up once the Pg migration is applied and verified.

## Next Task Dependencies

- Postgres migration apply: Apply `migrations/pg/0001_initial.sql` to the Supabase database and verify identity endpoints are functional in preview.
- Membership migration: Repeat the same Postgres adapter pattern for `apps/membership-worker` once this PR is verified.
- Projects migration: Same for `apps/projects-worker`.

## PR Number

PR #33: https://github.com/sourceplane/sourceplane-console/pull/33
