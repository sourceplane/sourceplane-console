# Development Schedule

Status: Planning baseline

Assumption: 4-6 autopilot coding agents plus 1 human reviewer or lead architect.

## Scheduling Principles

- Front-load contracts and seams, not feature polish.
- Land the minimum platform skeleton first, then parallelize bounded contexts.
- Hold metering and billing until the core resource lifecycle is stable.
- Do not start extraction work until the monorepo contracts have seen real usage.

## Recommended 8-Week Plan

### Week 0: Architecture lock

- Review and freeze the constitution.
- Review and freeze shared contract docs.
- Confirm Cloudflare account layout, environment naming, and deployment permissions.

Exit criteria:

- Shared contract docs approved.
- Delegation order confirmed.

### Week 1: Foundation

- Implement the workspace, tooling, root scripts, CI, and Worker scaffolds.
- Materialize `packages/contracts` from the spec docs.
- Stand up the public edge Worker skeleton.

Delegation lanes:

- Agent A: foundation and tooling
- Agent B: contract package and validators
- Agent C: edge API scaffold

Exit criteria:

- Monorepo builds locally.
- At least one Worker deploys.
- Contract tests exist.

### Weeks 2-3: Tenant core

- Identity
- Policy and authorization
- Organizations and membership
- Projects and environments

Delegation lanes:

- Agent A: identity
- Agent B: policy
- Agent C: organizations and membership
- Agent D: projects and environments

Exit criteria:

- A user can sign in, create an organization, create a project, and create an environment through the public API.

### Weeks 3-4: Resource core

- Resources and component registry
- Config, secrets, and feature flags
- Events, audit, and observability

Delegation lanes:

- Agent A: resources and registry
- Agent B: config and secrets
- Agent C: event fanout and audit

Exit criteria:

- Resources can be created against a component definition.
- All mutations emit events and create audit entries.

### Weeks 4-5: Runtime

- Runtime orchestration
- Reconciliation loops
- Deployment status and failure reporting

Delegation lanes:

- Agent A: workflow engine and status model
- Agent B: runtime adapters and locking
- Agent C: integration into resources and config

Exit criteria:

- A resource-backed component can move through a full requested-to-ready lifecycle.

### Weeks 5-6: Product surfaces

- Web console
- CLI and TypeScript SDK

Delegation lanes:

- Agent A: web console
- Agent B: CLI
- Agent C: SDK and generated types

Exit criteria:

- A user can complete the basic org -> project -> environment -> resource flow from both UI and CLI.

### Weeks 6-7: Monetization layer

- Metering
- Quotas
- Usage summaries

Delegation lanes:

- Agent A: raw usage ingestion and idempotency
- Agent B: rollups and quota checks

Exit criteria:

- Usage can be recorded, summarized, and queried per org/project/resource.

### Weeks 7-8: Billing and hardening

- Billing
- Entitlements
- Payment-provider adapter
- Stability and security hardening

Delegation lanes:

- Agent A: plans and subscriptions
- Agent B: entitlements and policy integration
- Agent C: provider adapter and webhook handling

Exit criteria:

- Plan and entitlement changes affect system behavior through contracts, not hardcoded UI checks.

## Delegation Checklist Per Component

Before assigning a component to an autopilot agent:

- confirm its upstream dependencies are merged,
- point the agent to the exact component spec,
- point the agent to the shared contracts it must honor,
- define the write scope,
- confirm whether the component may add new contracts or must use existing ones only.

## Merge Policy

- Merge foundation before any domain component.
- Merge contract changes before dependent implementations.
- Merge metering before billing.
- Merge runtime after resources and events are stable enough to avoid duplicate contract churn.

## First Extraction Candidates

These are the most likely components to move out of the monorepo first after traction:

1. `runtime-worker`
2. `metering-worker`
3. `billing-worker`
4. `resources-worker`
5. `identity-worker`
