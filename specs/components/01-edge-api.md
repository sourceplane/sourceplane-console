# Edge API Worker

Status: Ready for implementation

Primary monorepo targets:

- `apps/api-edge`
- optional helper packages under `packages/shared`

Primary dependencies:

- `specs/contracts/api-guidelines.md`
- `specs/contracts/tenancy-and-rbac.md`
- `specs/components/00-foundation-and-tooling.md`

Cloudflare primitives:

- Workers
- service bindings
- KV for idempotency and edge-safe caches
- optional rate limiting bindings

## Intent

Provide the single public HTTP entry point for the SaaS starter. The edge Worker is responsible for transport concerns, request context, tenant scope, and starter route composition, not source-of-truth business logic.

## Scope

- request routing
- auth context resolution
- request IDs and trace propagation
- response envelope normalization
- rate limiting and coarse abuse controls
- idempotency-key handling for side-effecting routes
- forwarding to internal Workers through service bindings

## Out Of Scope

- direct writes to domain Supabase Postgres schemas or any other domain-owned database tables
- independent authorization policy decisions
- domain-specific persistence logic

## Hard Contracts To Honor

- Public HTTP contract in `specs/contracts/api-guidelines.md`
- Tenant and role semantics in `specs/contracts/tenancy-and-rbac.md`

## Required Capabilities

### Public Routes

The edge must expose and route at least these route groups:

- `/v1/auth/*`
- `/v1/organizations/*`
- `/v1/organizations/{orgId}/members/*`
- `/v1/organizations/{orgId}/invites/*`
- `/v1/organizations/{orgId}/projects/*`
- `/v1/organizations/{orgId}/projects/{projectId}/environments/*`
- `/v1/organizations/{orgId}/projects/{projectId}/config/*`
- `/v1/organizations/{orgId}/projects/{projectId}/api-keys/*`
- `/v1/organizations/{orgId}/projects/{projectId}/webhooks/*`
- `/v1/organizations/{orgId}/audit/*`
- `/v1/organizations/{orgId}/usage/*`
- `/v1/organizations/{orgId}/billing/*`
- `/v1/organizations/{orgId}/notifications/*`
- `/v1/admin/*` when support/admin surfaces are enabled
- optional `/v1/organizations/{orgId}/projects/{projectId}/components/*`
- optional `/v1/organizations/{orgId}/projects/{projectId}/resources/*`
- optional `/v1/organizations/{orgId}/projects/{projectId}/deployments/*`

### Internal Calls

The edge must integrate with internal Workers for:

- identity
- policy
- membership
- projects
- config
- events or audit query surface
- metering summary
- billing summary
- notifications
- webhooks
- admin/support when enabled
- resources and runtime when optional product-resource extensions are enabled

### Security And Traceability

- Resolve the acting subject before invoking mutating domain commands.
- Attach request ID and tenant context to downstream calls.
- Reject project-scoped requests that do not carry both organization and project scope.
- Preserve `Idempotency-Key`, correlation ID, and trace headers.

## Data Ownership

The edge may own only transport-level derived state such as:

- idempotency records
- route-level cache metadata
- request throttling counters

It must not become a business database.

## Agent Freedom

- The agent may use raw Workers APIs, Hono, or another minimal routing layer.
- The agent may choose HTTP or RPC-style service-binding calls per downstream Worker, but RPC is preferred.
- The agent may choose the exact idempotency storage pattern as long as the behavior matches the contract.

## Acceptance Criteria

- All public responses use the shared envelope shape.
- Mutating routes require an authenticated or system-resolved actor.
- The edge can call each core bounded context without direct DB access.
- Swapping an internal Worker for an external service later does not require public API changes.

## Extraction Seam

`api-edge` remains the stable public facade even if domain services leave the monorepo. Its job is to shield clients from infrastructure movement.
