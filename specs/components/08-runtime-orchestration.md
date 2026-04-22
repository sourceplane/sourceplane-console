# Runtime Orchestration

Status: Ready for implementation

Primary monorepo targets:

- `apps/runtime-worker`

Primary dependencies:

- `specs/contracts/resource-contract.schema.yaml`
- `specs/contracts/component-manifest.schema.yaml`
- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/06-resources-and-component-registry.md`
- `specs/components/07-config-secrets-flags.md`
- `specs/components/09-events-audit-observability.md`

Cloudflare primitives:

- Workflows as the default durable orchestration mechanism
- Durable Objects for per-resource locking and strong coordination where needed
- Queues for async triggers
- D1 for deployment metadata
- R2 for artifacts if required by component handlers

## Intent

Turn desired resource state into actual runtime state by executing versioned component logic safely, durably, and observably.

## Scope

- deployment planning
- workflow execution
- retries and failure handling
- reconciliation triggers
- per-resource locking
- status updates back into the resource model

## Out Of Scope

- owning component definitions
- public API transport concerns
- long-term billing aggregation

## Hard Contracts To Honor

- Resource contract in `specs/contracts/resource-contract.schema.yaml`
- Component manifest contract in `specs/contracts/component-manifest.schema.yaml`
- Event envelope in `specs/contracts/event-envelope.schema.yaml`

## Required Capabilities

### Public/Internal Methods

- `deployResource`
- `reconcileResource`
- `getDeployment`
- `listDeploymentsForResource`
- `cancelDeployment`

### Events

- `deployment.started`
- `deployment.step_completed`
- `deployment.completed`
- `deployment.failed`
- `resource.status_changed`

### Runtime Rules

- Deployment execution must be idempotent.
- Only one active deployment may mutate a given resource at a time.
- Status transitions must be reflected back into the canonical resource contract.
- Failure payloads must be user-readable and safe to expose in the control plane.

## Data Ownership

This component owns:

- deployments
- deployment steps
- workflow instance metadata
- lock state references

## Agent Freedom

- The agent may implement orchestration with Cloudflare Workflows, or use Durable Objects as a supplement for locking and coordination.
- The agent may choose the internal plugin-handler loading model as long as component manifests remain the external contract.
- Provider-specific adapters may live in separate packages if they stay behind the runtime interface.

## Acceptance Criteria

- A new resource can trigger a deployment and transition through provisioning to ready or failed.
- Duplicate deployment requests with the same intent do not create duplicate side effects.
- Runtime execution can later move to another repo or compute environment without changing the resource contract.

## Extraction Seam

Runtime owns execution, not state authority. Resources remain the canonical desired-state record, which allows runtime to move independently later.
