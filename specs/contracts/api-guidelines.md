# API Guidelines

Status: Normative

## Scope

This document defines the public HTTP contract style and the internal service-boundary rules that every component must follow.

## Public API Shape

### Versioning

- Public routes are prefixed with `/v1`.
- Breaking changes require a new version prefix or a documented compatibility shim.

### Path conventions

- Use nouns for resources and sub-resources.
- Prefer nested scope when it clarifies tenancy:
  - `/v1/organizations/{orgId}/projects`
  - `/v1/projects/{projectId}/environments`
  - `/v1/resources/{resourceId}`
- Avoid verb-heavy routes unless the action is truly non-CRUD:
  - acceptable: `/v1/deployments/{deploymentId}/cancel`

### Request and response encoding

- JSON is the default wire format.
- Success envelope:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123",
    "cursor": null
  }
}
```

- Error envelope:

```json
{
  "error": {
    "code": "forbidden",
    "message": "You do not have access to this resource.",
    "details": {},
    "requestId": "req_123"
  }
}
```

### Pagination

- Use cursor pagination for list endpoints.
- Cursor names should be opaque to clients.

### Idempotency

- `POST` endpoints that create or trigger side effects must accept `Idempotency-Key`.
- The server must scope idempotency records by actor and route.

### Traceability

- Every request gets a request ID.
- Forward `traceparent` when present.
- Async operations must preserve causation and correlation IDs in emitted events.

## Authentication And Context

- Public auth uses bearer tokens and/or secure session cookies.
- The public edge resolves the acting user or service principal before dispatching to internal services.
- Organization selection must be explicit in path, token claims, or request context. Silent tenant guessing is prohibited.

## Internal Service Boundaries

### Service bindings

- Internal synchronous calls should use Cloudflare service bindings.
- Prefer RPC style for domain commands and queries.
- Do not expose raw persistence operations over service bindings.

### Internal command shape

Internal RPC methods should resemble domain operations:

- `createProject(input)`
- `listResources(scope)`
- `resolveSession(token)`
- `authorize(input)`

They should not resemble transport or database primitives:

- not `postProjects`
- not `insertProjectRow`
- not `runQuery`

## Error Code Set

All components must use the shared semantic error set:

- `bad_request`
- `unauthenticated`
- `forbidden`
- `not_found`
- `conflict`
- `rate_limited`
- `validation_failed`
- `precondition_failed`
- `unsupported`
- `internal_error`

## Route Ownership

The public edge owns:

- auth context resolution
- request normalization
- rate limiting
- request IDs
- response envelopes
- mapping domain errors to HTTP status codes

Domain Workers own:

- validation against domain contracts
- business rules
- persistence
- domain events

## Minimum Public Surface For V1

The public API must support:

- auth and session management
- organizations and memberships
- projects and environments
- resources and component catalog
- config and secret management metadata
- deployments and status
- audit queries
- usage summaries
- billing summaries and entitlements
