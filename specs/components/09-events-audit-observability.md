# Events, Audit, And Observability

Status: Ready for implementation

Primary monorepo targets:

- `apps/events-worker`

Primary dependencies:

- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/00-foundation-and-tooling.md`

Platform dependencies:

- Workers
- Queues
- Hyperdrive binding to primary Supabase Postgres
- Supabase Postgres for the canonical event log, audit index, and delivery metadata
- Workers Analytics Engine
- R2 for dead-letter or replay archives

## Intent

Provide the starter event backbone, immutable audit trail, security-event history, and minimum observability primitives needed by all other components.

## Scope

- publish and persist domain events
- fan out events to subscribers
- record audit entries
- expose audit query APIs
- expose security-event query APIs
- write operational analytics and counters
- dead-letter handling for failed async deliveries

## Out Of Scope

- billing logic
- domain-specific business decisions
- replacing all application logging

## Hard Contracts To Honor

- Event contract in `specs/contracts/event-envelope.schema.yaml`

## Required Capabilities

### Internal Methods

- `publishEvent`
- `recordAudit`
- `queryAudit`
- `querySecurityEvents`
- `registerSubscriber` or static subscriber configuration

### Required Audit Coverage

At minimum, audit entries are required for:

- login and session security events
- organization creation, update, archival, and deletion
- member invitation, acceptance, removal, and role changes
- project creation, update, archival, and deletion
- API-key and service-principal creation, update, and revocation
- webhook endpoint changes and delivery disabling
- billing customer, subscription, invoice, and entitlement changes
- config, secret metadata, and feature-flag changes
- support/admin actions and impersonation when enabled

### Architectural Rule

Cloudflare Queues are not a full multi-subscriber event bus. V1 must therefore include an event-router or fanout layer that:

- persists the canonical event once,
- determines subscribers,
- forwards to one or more delivery queues,
- tracks failures independently from the source mutation.

### Events

This component primarily transports other components' events, but it may emit:

- `event.delivery_failed`
- `audit.recorded`
- `dead_letter.created`

## Data Ownership

This component owns:

- canonical event log
- audit entries
- subscriber metadata
- dead-letter records
- delivery attempts

## Agent Freedom

- Subscriber registration may be static configuration in V1 if dynamic registration is unnecessary.
- The agent may store full event payloads in Supabase Postgres, R2, or a mixed model depending on size and query needs.
- Operational metrics may use Analytics Engine, structured logs, or both.

## Acceptance Criteria

- Every mutating domain action can publish a shared event envelope.
- Audit history is queryable by organization and target resource.
- Security events are queryable by organization, user, and target where applicable.
- Failed async deliveries are visible and retryable without mutating the original source data.

## Extraction Seam

Other components publish to the event contract, not directly to queue internals. This is what allows migration to Kafka, NATS, or an external event platform later.
