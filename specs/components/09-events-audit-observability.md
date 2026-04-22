# Events, Audit, And Observability

Status: Ready for implementation

Primary monorepo targets:

- `apps/events-worker`

Primary dependencies:

- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/00-foundation-and-tooling.md`

Cloudflare primitives:

- Workers
- Queues
- D1
- Workers Analytics Engine
- R2 for dead-letter or replay archives

## Intent

Provide the platform event backbone, the audit trail, and the minimum observability primitives needed by all other components.

## Scope

- publish and persist domain events
- fan out events to subscribers
- record audit entries
- expose audit query APIs
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
- `registerSubscriber` or static subscriber configuration

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
- The agent may store full event payloads in D1, R2, or a mixed model depending on size and query needs.
- Operational metrics may use Analytics Engine, structured logs, or both.

## Acceptance Criteria

- Every mutating domain action can publish a shared event envelope.
- Audit history is queryable by organization and target resource.
- Failed async deliveries are visible and retryable without mutating the original source data.

## Extraction Seam

Other components publish to the event contract, not directly to queue internals. This is what allows migration to Kafka, NATS, or an external event platform later.
