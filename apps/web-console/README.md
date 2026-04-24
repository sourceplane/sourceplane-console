# @sourceplane/web-console

Operator-facing web console that talks only to the public `/v1/*` API exposed by
`apps/api-edge`. The browser never calls Worker bindings directly.

## Where to open it

| Surface | URL | Notes |
| --- | --- | --- |
| Local Vite dev | `http://127.0.0.1:4173` | Cross-origin to local edge on `:8787`; local CORS is preconfigured. |
| Preview workers.dev | `https://sourceplane-web-console-preview.rahulvarghesepullely.workers.dev` | Browser auto-targets `sourceplane-api-edge-preview` on the same workers.dev account hostname. |
| Preview custom domains | `https://console.sourceplane.ai` and `https://www.console.sourceplane.ai` | Routed to the preview console worker; `/v1*` is routed to preview `api-edge` on the same hostname. |

Deep links such as `/login`, `/orgs/:orgId/projects`, and invite acceptance
routes are SPA-safe: refreshing the page serves `index.html` instead of a blank
404 response.

## Login and test flow

### Local

```bash
pnpm install
pnpm --filter @sourceplane/api-edge dev
pnpm --filter @sourceplane/web-console dev
```

1. Open `http://127.0.0.1:4173/login`.
2. Enter any email.
3. The identity worker is in `local_debug` delivery mode, so the one-time code is
   returned in the response and shown inline by the console.
4. Click **Verify**.
5. Create an organization, invite a second email, accept the invite, create a
   project, then create an extra environment.

### Preview workers.dev

1. Open `https://sourceplane-web-console-preview.rahulvarghesepullely.workers.dev/login`.
2. Enter any email.
3. Preview is explicitly configured with `AUTH_LOGIN_DELIVERY_MODE=local_debug`,
   so the login code is surfaced in the UI even though no external email provider
   is required.
4. Continue with the same org → invite → project → environment flow as local.

### Preview custom domains

1. Open `https://console.sourceplane.ai/login` or `https://www.console.sourceplane.ai/login`.
2. Sign in with any email.
3. The console and `/v1/*` API are routed on the same hostname, so no browser
   CORS setup is required on this path.
4. Verify the full flow in the UI:
   - create an organization
   - invite a teammate
   - accept the invite
   - create a project
   - create an extra environment

## Browser/runtime behavior

- Localhost defaults to `http://127.0.0.1:8787`.
- Preview `workers.dev` hostnames automatically map from
  `sourceplane-web-console-preview.*.workers.dev` to
  `sourceplane-api-edge-preview.*.workers.dev`.
- Custom domains default to same-origin `/`, relying on Cloudflare route
  precedence to send `/v1*`, `/healthz`, and `/readyz` to `api-edge`.
- `VITE_API_BASE_URL` still overrides the runtime default when you need to point a
  build at a different edge URL.

## Cloudflare config owned here

- `apps/web-console/wrangler.jsonc`
  - local `API_BASE_URL=http://127.0.0.1:8787`
  - preview `workers_dev=true`
  - preview Custom Domains for `console.sourceplane.ai` and `www.console.sourceplane.ai`
  - Worker observability enabled
- `apps/api-edge/wrangler.jsonc`
  - local `WEB_CONSOLE_ORIGINS=http://127.0.0.1:4173`
  - preview `workers_dev=true`
  - preview origin allowlist for workers.dev + custom domains
  - preview routes for `console.sourceplane.ai/v1*`, `/healthz`, `/readyz` and
    the matching `www.` host
- `apps/identity-worker/wrangler.jsonc`
  - local and preview `AUTH_LOGIN_DELIVERY_MODE=local_debug`
  - Worker observability enabled

## Routes

Live routes backed by today's public API:

- `/login` — magic-link request + verification
- `/orgs` — list and create organizations
- `/orgs/:orgId/projects` — list, create, archive projects
- `/orgs/:orgId/members` — members, role updates, invites
- `/orgs/:orgId/settings` — rename organization
- `/orgs/:orgId/projects/:projectId/environments` — list and provision additional environments
- `/orgs/:orgId/projects/:projectId/settings` — rename project
- `/invites/:inviteId?token=…` — accept-invite landing route

Placeholder routes stay intentionally honest about future work:

| Route | Spec | Future task |
| --- | --- | --- |
| `/orgs/:orgId/components` | `specs/components/06-resources-and-component-registry.md` | Task 6 |
| `/orgs/:orgId/resources` | `specs/components/06-resources-and-component-registry.md` | Task 6 |
| `/orgs/:orgId/config` | `specs/components/09-config-and-secrets.md` | Task 9 |
| `/orgs/:orgId/audit` | `specs/components/11-events-and-audit.md` | Task 11 |
| `/orgs/:orgId/usage` | `specs/components/13-metering-and-usage.md` | Task 13 |
| `/orgs/:orgId/billing` | `specs/components/14-billing-and-plans.md` | Task 14 |

## Build

```bash
pnpm --filter @sourceplane/web-console build
```

The Vite build emits `dist/`, and the Cloudflare Worker serves that directory via
the existing assets binding with runtime config injection for browser-safe
deployments.
