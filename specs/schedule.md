# Development Schedule

Status: Planning baseline

Assumption: 4-6 autopilot coding agents plus 1 human reviewer or lead architect.

## Scheduling Principles

- Front-load contracts and seams, not feature polish.
- Land the minimum platform skeleton first, then parallelize bounded contexts.
- Treat org -> project SaaS starter flows as the baseline product before optional resource/runtime work.
- Hold metering and billing until tenant, project, policy, and audit contracts are stable.
- Do not start extraction work until the monorepo contracts have seen real usage.

## Recommended 8-Week Plan

### Week 0: Architecture lock

- Review and freeze the constitution.
- Review and freeze `specs/product-overview.md` and `specs/domain-model.md`.
- Review and freeze shared contract docs.
- Confirm Supabase Postgres ownership model, schema namespace rules, and migration strategy.
- Confirm Cloudflare account layout, environment naming, and deployment permissions.
- Pin stack-tectonic version in `intent.yaml` and orun runtime in `kiox.yaml`.
- Confirm environment lane policies (dev / staging / production) and approval gates.

Exit criteria:

- Shared contract docs approved.
- Delegation order confirmed.
- Database and migration ownership model approved.
- `intent.yaml` and `kiox.yaml` merged to main.
- `orun plan` runs cleanly against the discovery roots.

### Week 1: Foundation

- Implement the workspace, tooling, root scripts, and Worker scaffolds.
- Materialize `packages/contracts` from the spec docs.
- Stand up the public edge Worker skeleton.
- Establish Supabase Postgres migration conventions and Hyperdrive adapter seams.
- Each new app and package must include a `component.yaml` so orun discovers it automatically.

Delegation lanes:

- Agent A: foundation and tooling
- Agent B: contract package and validators
- Agent C: edge API scaffold
- Agent D: database migration and repository-adapter conventions

Exit criteria:

- Monorepo builds locally.
- At least one Worker deploys.
- Contract tests exist.
- Repository adapters hide Supabase/Hyperdrive details from domain logic.
- `orun plan --changed` produces a non-empty job matrix for every changed component.

### Weeks 2-3: Tenant core

- Identity
- Organizations and membership
- Invitations
- Projects and environments
- Policy and authorization

Delegation lanes:

- Agent A: identity
- Agent B: organizations, membership, and invitations
- Agent C: projects and environments
- Agent D: policy and RBAC

Exit criteria:

- A user can sign in, create an organization, invite a member, create a project, and create an environment through the public API.
- The invitation accept flow works end to end.
- Project data cannot be queried, cached, authorized, or audited by `projectId` alone.

### Weeks 3-4: Starter operations

- Events, audit, and observability
- Config, secrets, settings, and feature flags
- API keys and service principals
- Notifications
- Webhooks and integrations

Delegation lanes:

- Agent A: event fanout, audit, and security-event queries
- Agent B: config, settings, secrets, and flags
- Agent C: API keys and service-principal hardening
- Agent D: notifications
- Agent E: webhooks and delivery tracking

Exit criteria:

- All starter mutations emit events and create audit entries.
- API keys can be created and revoked under an organization.
- Webhook endpoints can be created and delivery attempts are observable.
- Invitations and security notifications can be queued through the notification contract.

### Weeks 4-5: Usage and billing

- Metering
- Quotas
- Usage summaries
- Billing customers, plans, subscriptions, invoices, and entitlements
- Payment-provider adapter seam

Delegation lanes:

- Agent A: raw usage ingestion and idempotency
- Agent B: rollups and quota checks
- Agent C: plans, subscriptions, and entitlements
- Agent D: provider adapter and webhook handling

Exit criteria:

- Usage can be recorded, summarized, and queried per organization and project.
- Plan and entitlement changes affect behavior through contracts, not hardcoded UI checks.
- Billing provider webhooks update starter-owned billing state.

### Weeks 5-6: Product surfaces

- Web console
- CLI and TypeScript SDK
- Admin/support console baseline

Delegation lanes:

- Agent A: web console
- Agent B: CLI
- Agent C: SDK and generated types
- Agent D: admin/support read-only diagnostics and audit

Exit criteria:

- A user can complete the auth -> org -> invite -> project -> environment -> settings -> API key -> webhook -> audit -> usage -> billing flow from UI and CLI where appropriate.
- Support diagnostics are available only through audited support paths.

### Weeks 6-7: Optional resource extension

- Resources and component registry
- Optional component manifests
- Optional runtime orchestration
- Reconciliation loops
- Deployment status and failure reporting

Delegation lanes:

- Agent A: resources and registry
- Agent B: component manifest validation and generated forms
- Agent C: workflow engine and status model
- Agent D: runtime adapters and locking

Exit criteria:

- A resource-backed component can move through a full requested-to-ready lifecycle if the product extension is enabled.
- Baseline SaaS starter flows continue to work when resource/runtime modules are disabled.

### Weeks 7-8: Hardening and launch readiness

- Stability and security hardening
- Cross-component smoke tests
- Load and abuse-path testing
- Support runbooks
- Production launch approvals

Delegation lanes:

- Agent A: auth, policy, and tenant-isolation hardening
- Agent B: billing, metering, and webhook hardening
- Agent C: UI/CLI/SDK end-to-end verification
- Agent D: operational docs and runbooks

Exit criteria:

- Production launch blockers are tracked and either resolved or explicitly accepted.
- Human reviewer has approved architecture, database schema, auth/RBAC, billing flow, and production deployment.

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
- Merge tenant core before starter operations.
- Merge audit/event contracts before webhooks, notifications, billing, and support depend on them.
- Merge metering before billing.
- Merge optional runtime after resources and events are stable enough to avoid duplicate contract churn.

## First Extraction Candidates

These are the most likely components to move out of the monorepo first after traction:

1. `billing-worker`
2. `metering-worker`
3. `webhooks-worker`
4. `notifications-worker`
5. `identity-worker`
6. `runtime-worker` if optional resource orchestration becomes product-critical
