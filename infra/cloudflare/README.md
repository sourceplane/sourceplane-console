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
