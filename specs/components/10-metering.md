# Metering

Status: Ready for implementation

Primary monorepo targets:

- `apps/metering-worker`

Primary dependencies:

- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/06-resources-and-component-registry.md`
- `specs/components/09-events-audit-observability.md`

Cloudflare primitives:

- Workers
- Queues
- Workers Analytics Engine
- D1
- KV for hot quota lookups if needed

## Intent

Own usage ingestion, normalization, aggregation, and quota state. Billing consumes metering outputs; metering does not depend on billing rules.

## Scope

- raw usage ingestion
- idempotent event processing
- hourly and daily rollups
- quota calculations
- usage summary queries

## Out Of Scope

- invoices
- payment-provider integration
- plan catalog ownership

## Hard Contracts To Honor

- Event envelope in `specs/contracts/event-envelope.schema.yaml`
- The constitutional rule that billing consumes metering, not the reverse

## Required Capabilities

### Public/Internal Methods

- `recordUsage`
- `ingestUsageBatch`
- `getUsageSummary`
- `checkQuota`
- `listQuotaViolations`

### Events

- `usage.recorded`
- `usage.rollup_created`
- `quota.exceeded`

### Metering Rules

- Usage ingestion must support idempotency keys.
- Raw usage and aggregated usage must be distinguishable.
- Summaries must be queryable by organization, project, environment, and resource where applicable.

## Data Ownership

This component owns:

- raw usage records or pointers to them
- rollups
- quota definitions or derived quota state
- quota violation history

## Agent Freedom

- The agent may use Analytics Engine for raw writes and D1 for rollups.
- The agent may implement quotas as synchronous guards, async alerts, or both depending on the action path.
- The exact usage dimensions may start small as long as the ledger is additive and extensible.

## Acceptance Criteria

- Usage can be recorded exactly once for a given idempotency key.
- Aggregated summaries are stable enough for product usage views and billing consumption.
- Quota checks can be reused by edge and runtime flows.

## Extraction Seam

Metering is a ledger and policy input, not an invoice engine. Preserve that separation.
