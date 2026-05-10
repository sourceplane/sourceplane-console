# Tooling Scripts

This directory holds repo-level helper scripts that are safe to reuse from CI and local workflows.

- `resolve-changed-apps.mjs`: maps a git diff to deployable workspace app names.
- `resolve-deploy-environment.mjs`: resolves the Wrangler deploy target environment from CLI args, `DEPLOY_ENV`, or CI inference. Imported by `run-wrangler-deploy.mjs` and tested in `test/`.
- `run-wrangler-deploy.mjs`: shared Cloudflare Worker deploy helper used by all `apps/` Workers and the web console.

## Deploy environment resolution

`run-wrangler-deploy.mjs` requires a known deploy target (`preview` or `production`). It resolves the environment in this order:

1. **`--env preview|production`** CLI argument — always wins.
2. **`DEPLOY_ENV` environment variable** — useful when a CI wrapper sets the environment without forwarding CLI args.
3. **CI inference** — when `CI=true` and `GITHUB_REF=refs/heads/main`, the environment is inferred as `production`. This is the Orun / GitHub Actions production deploy path. The `cloudflare-worker-turbo` composition only reaches `pnpm run deploy` for the production environment on the production branch; staging and dev jobs are skipped before they call this script.

If none of the above yields a valid environment the script exits with a non-zero code, preserving the **local-dev safety guarantee**: a developer running `pnpm run deploy` from their shell without flags will never accidentally deploy to production.

