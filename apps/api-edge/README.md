# @sourceplane/api-edge

Public HTTP facade Worker for Sourceplane.

This app owns transport concerns only:

- route matching for the public `/v1` API
- request ID creation and propagation
- trace header propagation
- JSON parsing and response normalization
- auth-context resolution hooks
- tenant-context extraction
- idempotency handling for side-effecting routes
- forwarding to downstream domain Workers through typed client adapters

It does not own domain persistence or business rules.

## Public Surface

The edge currently exposes:

- `/healthz`
- `/readyz`
- `/v1`
- `/v1/system/routes`
- `/v1/auth/ping`
- route-group handlers for:
	- `/v1/auth/*`
	- `/v1/organizations/*`
	- `/v1/projects/*`
	- `/v1/environments/*`
	- `/v1/resources/*`
	- `/v1/components/*`
	- `/v1/config/*`
	- `/v1/deployments/*`
	- `/v1/audit/*`
	- `/v1/usage/*`
	- `/v1/billing/*`

Every successful and error response is normalized through `@sourceplane/contracts`.

## Bindings

Optional downstream service bindings are typed in `src/env.ts`:

- `IDENTITY`
- `POLICY`
- `MEMBERSHIP`
- `PROJECTS`
- `RESOURCES`
- `CONFIG`
- `RUNTIME`
- `EVENTS`
- `METERING`
- `BILLING`

The edge-owned idempotency store is:

- `EDGE_IDEMPOTENCY` as a Cloudflare KV binding

Missing downstream bindings fail with standardized `unsupported` responses instead of crashing the Worker.

## Internal Integration Contract For Later Workers

Later domain Workers can plug into the edge without restructuring route code by exposing service-binding entrypoints with these conventions:

1. Forwarded public route handling:
	 - edge forwards domain requests to `/internal/edge{publicPath}` on the target binding
	 - forwarded headers include request ID, traceparent, optional idempotency key, resolved actor headers, and resolved tenant headers
2. Identity-specific hooks:
	 - `GET /internal/ping`
	 - `POST /internal/auth/resolve` returning a shared success envelope whose `data` is shaped like:

```json
{
	"data": {
		"actor": {
			"type": "user",
			"id": "usr_123"
		},
		"organizationId": "org_123",
		"sessionId": "ses_123"
	},
	"meta": {
		"cursor": null,
		"requestId": "req_123"
	},
}
```

3. Policy-specific hook:
	 - `POST /internal/authorize` using the shared authorization request and response contracts from `@sourceplane/contracts`

Downstream Workers may later replace these HTTP-shaped service-binding endpoints with RPC adapters as long as the client interfaces in `api-edge` remain stable.

## Current Assumptions

- `/v1/organizations/*` routes delegate to `MEMBERSHIP`.
- `/v1/environments/*` delegates to `PROJECTS` because projects and environments share the same bounded context in the current schedule.
- `/v1/components/*` delegates to `RESOURCES` because component definitions and manifests are part of the resource/component surface.
- `/v1/audit/*` delegates to `EVENTS` until a separate audit query Worker exists.
- Edge-side policy authorization is optional until the policy Worker exposes its contract; the hook is ready, but the edge does not invent policy decisions when the binding is absent.

## Validation

Run package-scoped checks with:

1. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/api-edge lint`
2. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/api-edge typecheck`
3. `npm exec --yes pnpm@10.7.1 -- --filter @sourceplane/api-edge test`
