# @sourceplane/web-console

Operator-facing web console that talks exclusively to the public `/v1/*` surface
exposed by `apps/api-edge`. The console never imports Worker bindings or other
backend internals — every call goes through the typed `@sourceplane/sdk` client
against the edge.

## Local development

```bash
# from the repo root
pnpm install
pnpm --filter @sourceplane/api-edge dev      # terminal 1, serves on :8787
pnpm --filter @sourceplane/web-console dev   # terminal 2, serves on :4173
```

Then open http://127.0.0.1:4173 and follow the magic-link login flow. In local
mode the identity worker returns the one-time code in the response payload, and
the console surfaces it inline so no email plumbing is required.

## Environment variables

| Variable             | Default                  | Notes                                                                            |
| -------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`  | `http://127.0.0.1:8787`  | Edge worker base URL. In production set to `/` when fronted by the same hostname. |

In production deploys the console is hosted as a Workers Assets binding behind a
route on the same edge zone, so the SDK can simply use the relative `/`
base URL. For preview / dev environments hosted under a different origin add the
console origin to the edge worker's `WEB_CONSOLE_ORIGINS` (comma-separated) so
preflight requests succeed.

## Routes

Live routes backed by today's public API:

- `/login` — magic-link request + verification (`/v1/auth/login/start`, `/login/complete`)
- `/orgs` — list and create organizations (`/v1/organizations`)
- `/orgs/:orgId/projects` — list, create, archive projects
- `/orgs/:orgId/members` — members, role updates, invites
- `/orgs/:orgId/settings` — rename organization
- `/orgs/:orgId/projects/:projectId/environments` — list and provision additional environments
- `/orgs/:orgId/projects/:projectId/settings` — rename project
- `/invites/:inviteId?token=…` — accept-invite landing route

Placeholder routes — the navigation links are present but render an
`EmptyState` referencing the spec for the upstream task that owns the API:

| Route                          | Spec                                                | Future task |
| ------------------------------ | --------------------------------------------------- | ----------- |
| `/orgs/:orgId/components`      | `specs/components/06-resources-and-component-registry.md` | Task 6      |
| `/orgs/:orgId/resources`       | `specs/components/06-resources-and-component-registry.md` | Task 6      |
| `/orgs/:orgId/config`          | `specs/components/09-config-and-secrets.md`         | Task 9      |
| `/orgs/:orgId/audit`           | `specs/components/11-events-and-audit.md`           | Task 11     |
| `/orgs/:orgId/usage`           | `specs/components/13-metering-and-usage.md`         | Task 13     |
| `/orgs/:orgId/billing`         | `specs/components/14-billing-and-plans.md`          | Task 14     |

## Build

```bash
pnpm --filter @sourceplane/web-console build
```

The Vite build emits to `dist/`, which is consumed by the existing `worker.ts`
assets binding for `wrangler deploy`.
