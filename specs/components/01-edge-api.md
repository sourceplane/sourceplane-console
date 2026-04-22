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

Provide the single public HTTP entry point for the platform. The edge Worker is responsible for transport concerns and request context, not source-of-truth business logic.

## Scope

- request routing
- auth context resolution
- request IDs and trace propagation
- response envelope normalization
- rate limiting and coarse abuse controls
- idempotency-key handling for side-effecting routes
- forwarding to internal Workers through service bindings

## Out Of Scope

- direct writes to domain D1 databases
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
- `/v1/projects/*`
- `/v1/environments/*`
- `/v1/resources/*`
- `/v1/components/*`
- `/v1/config/*`
- `/v1/deployments/*`
- `/v1/audit/*`
- `/v1/usage/*`
- `/v1/billing/*`

### Internal Calls

The edge must integrate with internal Workers for:

- identity
- policy
- membership
- projects
- resources
- config
- runtime
- events or audit query surface
- metering summary
- billing summary

### Security And Traceability

- Resolve the acting subject before invoking mutating domain commands.
- Attach request ID and tenant context to downstream calls.
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
