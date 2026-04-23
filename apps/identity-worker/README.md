# @sourceplane/identity-worker

Identity bounded-context Worker for Sourceplane.

This app owns:

- passwordless first-party sign-in with email one-time codes
- user bootstrap records
- opaque bearer sessions and internal auth resolution
- service-principal backed API keys
- D1-backed persistence plus an identity event outbox

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

Wrangler binds `IDENTITY_DB` to the Worker D1 database. Migrations live under `migrations/`.

Required secret:

- `IDENTITY_TOKEN_HASH_SECRET`

Optional generic email delivery configuration:

- vars: `AUTH_EMAIL_API_URL`, `AUTH_EMAIL_FROM`
- secret: `AUTH_EMAIL_API_TOKEN`

If no email provider is configured in `local`, login-start returns a safe `local_debug` delivery payload so tests and local development can complete the flow without leaking codes in preview or production.

## Validation

1. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker lint`
2. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker typecheck`
3. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/identity-worker test`
