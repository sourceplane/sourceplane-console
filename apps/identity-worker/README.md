# @sourceplane/identity-worker

Identity bounded-context Worker for Sourceplane.

This app owns:

- passwordless first-party sign-in with email one-time codes
- user bootstrap records
- opaque bearer sessions and internal auth resolution
- service-principal backed API keys
- persistence via D1 (local/test) or Supabase Postgres via Hyperdrive (production)
- an identity event outbox

## Public Surface Through The Edge

The edge forwards `/v1/auth/*` traffic to `/internal/edge/v1/auth/*` on this Worker.

Implemented routes:

- `POST /v1/auth/login/start`
- `POST /v1/auth/login/complete`
- `GET /v1/auth/session`
- `POST /v1/auth/logout`
- `GET /v1/auth/api-keys`
- `POST /v1/auth/api-keys`
- `DELETE /v1/auth/api-keys/:apiKeyId`

Internal hooks:

- `GET /internal/ping`
- `POST /internal/auth/resolve`

## Storage And Secrets

### Repository selection

The Worker selects its persistence backend at request time:

| Condition | Backend |
|---|---|
| `IDENTITY_HYPERDRIVE` binding present | **Postgres** (Supabase via Hyperdrive) |
| `IDENTITY_HYPERDRIVE` absent, non-production env | **D1** (local/test SQLite) |
| `IDENTITY_HYPERDRIVE` absent, `ENVIRONMENT=production` | **500 error** (hard fail) |

### D1 (local development and tests)

Wrangler binds `IDENTITY_DB` to a D1 database for local `wrangler dev` and all Vitest test runs. Migrations live under `migrations/` (SQLite-compatible DDL) and are applied automatically by the test harness.

### Postgres / Hyperdrive (preview and production)

The normative production persistence is Supabase Postgres reached through the `sourceplane-db` Hyperdrive binding (`d9c62c4acf934dd7bb82f63ed02db564`). The Postgres schema lives in `migrations/pg/0001_initial.sql` under the `identity` schema namespace. Apply it once to the Supabase database before deploying:

```sql
-- Run against the Supabase Postgres database (not via Hyperdrive)
\i migrations/pg/0001_initial.sql
```

Do **not** commit raw Supabase connection strings. Use `wrangler hyperdrive get <id>` to inspect the Hyperdrive config; use temporary credentials from the Supabase dashboard for one-off migration runs.

### Secrets

Required:

- `IDENTITY_TOKEN_HASH_SECRET` — set with `wrangler secret put IDENTITY_TOKEN_HASH_SECRET`

Optional generic email delivery:

- vars: `AUTH_EMAIL_API_URL`, `AUTH_EMAIL_FROM`
- secret: `AUTH_EMAIL_API_TOKEN`

If no email provider is configured in `local`, login-start returns a safe `local_debug` delivery payload so tests and local development can complete the flow without leaking codes in preview or production.

## Validation

1. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker lint`
2. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker typecheck`
3. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker test`
