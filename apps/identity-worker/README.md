# @sourceplane/identity-worker

Identity bounded-context Worker for Sourceplane.

This app owns:

- passwordless first-party sign-in with email one-time codes
- user bootstrap records
- opaque bearer sessions and internal auth resolution
- service-principal backed API keys
- persistence via D1 (local/test) or Supabase Postgres via Cloudflare Hyperdrive (production)
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

### D1 – Local Development And Tests

For local development and the test suite the Worker uses a Cloudflare D1 database bound as `IDENTITY_DB`. D1 migrations live under `migrations/` and are applied automatically by `wrangler dev --local` and the `@sourceplane/testing` helpers.

### Supabase/Postgres – Production (via Hyperdrive)

In production the Worker prefers a Postgres connection provided by Cloudflare Hyperdrive. The binding must be named `IDENTITY_HYPERDRIVE` and configured in `wrangler.jsonc` for the target environment.

**The binding is not committed to `wrangler.jsonc` because the Hyperdrive ID requires a real Cloudflare account and Supabase project.** A follow-up provisioning task is required to:

1. Create the Supabase Postgres database.
2. Apply the Postgres migration at `migrations-pg/0001_initial.sql` (uses the `identity` schema).
3. Create a Cloudflare Hyperdrive resource pointing at the Supabase connection string.
4. Add the resulting Hyperdrive ID to `wrangler.jsonc` under `env.production.hyperdrive`:

```jsonc
"hyperdrive": [
  {
    "binding": "IDENTITY_HYPERDRIVE",
    "id": "<cloudflare-hyperdrive-id>"
  }
]
```

If `IDENTITY_HYPERDRIVE` is absent in production the Worker returns HTTP 500 immediately rather than silently falling back to D1.

### Required Secret

- `IDENTITY_TOKEN_HASH_SECRET` – set with `wrangler secret put IDENTITY_TOKEN_HASH_SECRET` in every environment.

### Optional Email Delivery

- vars: `AUTH_EMAIL_API_URL`, `AUTH_EMAIL_FROM`
- secret: `AUTH_EMAIL_API_TOKEN`

If no email provider is configured in `local`, login-start returns a safe `local_debug` delivery payload so tests and local development can complete the flow without leaking codes in preview or production.

## Validation

1. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker lint`
2. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker typecheck`
3. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker test`
