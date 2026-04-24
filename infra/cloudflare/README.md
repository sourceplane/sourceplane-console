# Cloudflare Environments

This scaffold uses three deployment stages:

- `local`: default values in each app `wrangler.jsonc` for local development
- `preview`: non-production Cloudflare environment for PR or main-branch previews
- `production`: stable environment for promoted deploys

Internal workers should not expose a public `workers.dev` surface in preview or production. They are deployed so service bindings can target them, but they remain reachable only through internal bindings.

Secrets policy:

- do not commit `.env` files
- use `wrangler secret put <NAME>` for Worker secrets
- use Cloudflare Secrets Store for shared platform credentials where appropriate
- document secret names in workflow or app READMEs, not secret values

Required GitHub secrets for deploy workflows:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

For D1-backed Workers, commit the stable `database_name` in `wrangler.jsonc` and let `tooling/scripts/run-wrangler-deploy.mjs` resolve preview/production `database_id` values from the authenticated Cloudflare account at deploy time. The same deploy script must apply migrations with `wrangler d1 migrations apply --remote` for preview/production so the hosted databases stay in sync with the repository schema.

For KV-backed bindings such as `EDGE_IDEMPOTENCY`, commit placeholder IDs in `wrangler.jsonc` and let the same deploy script resolve or create the real preview/production namespace IDs before `wrangler deploy` runs.
