# Sourceplane SaaS Implementation Specs

This repository currently holds the implementation spec pack for Sourceplane: a Cloudflare-first, resource-oriented control plane for reusable micro-SaaS products.

The codebase is intentionally spec-led right now. Human implementers and autopilot coding agents should treat the files under `specs/` as the current source of truth until the first working monorepo is scaffolded.

## What Is Being Built

- A Cloudflare-first control plane that starts as a monorepo.
- A bounded-context architecture whose components can later move into separate repos and independent deployments.
- A common contract layer for API shape, event shape, tenancy, authorization, resources, and component manifests.
- A product surface that supports UI, CLI, and SDK clients from the same contracts.

## Read Order

1. `specs/constitution.md`
2. `specs/repo.md`
3. `specs/contracts/api-guidelines.md`
4. `specs/contracts/tenancy-and-rbac.md`
5. `specs/contracts/event-envelope.schema.yaml`
6. `specs/contracts/resource-contract.schema.yaml`
7. `specs/contracts/component-manifest.schema.yaml`
8. `specs/components/*`
9. `specs/schedule.md`

## Delegation Order

This is the recommended order for delegating implementation to coding agents:

1. Workspace foundation and tooling
2. Shared contracts package and contract tests
3. Edge API worker
4. Identity
5. Policy and authorization
6. Organizations and membership
7. Projects and environments
8. Resources and component registry
9. Config, secrets, and feature flags
10. Events, audit, and observability
11. Runtime orchestration
12. Web console
13. CLI and SDK
14. Metering
15. Billing
16. Stabilization, extraction seams, and production hardening

## Parallelization Rules

- Do not delegate feature work before the foundation and contract layer exists.
- After foundation lands, `identity`, `policy`, and `edge API` may proceed in parallel.
- `organizations`, `projects`, and `resources` may proceed once auth context and tenancy contracts are fixed.
- `web console` and `CLI/SDK` may proceed once the public API routes and response shapes are stable.
- `metering` must precede `billing`.
- `runtime orchestration` must not invent its own resource or component schema; it must consume the shared contracts.

## Spec Index

- Global rules: `specs/constitution.md`
- Monorepo structure and extraction model: `specs/repo.md`
- Shared contracts: `specs/contracts/`
- Component specs: `specs/components/`
- Schedule and sequencing: `specs/schedule.md`

## Non-Negotiable Principle

Agents are free to choose implementation details, libraries, and internal structure as long as they preserve the shared contracts and constitutional rules. If an implementation needs to break a contract, the spec must be updated first and downstream components must be informed before code is merged.
