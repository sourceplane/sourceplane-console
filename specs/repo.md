# Monorepo Spec

Status: Normative

## Intent

This repository starts as a Cloudflare-first monorepo so implementation can move quickly with strong shared contracts, while preserving clean seams for later extraction into separate repos and deployments.

## Canonical Repo Shape

```text
/apps
  /api-edge                Public HTTP entry Worker
  /web-console             Cloudflare Pages or Workers-based UI
  /identity-worker
  /policy-worker
  /membership-worker
  /projects-worker
  /resources-worker
  /config-worker
  /events-worker
  /runtime-worker
  /metering-worker
  /billing-worker

/packages
  /contracts               Shared API, event, resource, and manifest types
  /sdk                     Public TypeScript SDK
  /cli                     Public CLI package
  /ui                      Shared UI components and generated form helpers
  /shared                  Generic helpers only: errors, logging, ids, tracing
  /testing                 Test utilities, fixtures, contract assertions

/tooling
  /eslint
  /tsconfig
  /scripts

/infra
  /cloudflare              Wrangler configs, environments, bindings
  /ci                      CI templates and deployment pipelines

/specs
  ...this spec pack...
```

## Repo Rules

### Workspace and toolchain

- Use `pnpm` workspaces for package management.
- Use `turbo` or an equivalent task graph runner for build, test, typecheck, lint, and deploy pipelines.
- Use TypeScript across Workers, SDK, CLI, and shared packages for V1 velocity.
- Each deployable Worker keeps its own `wrangler.jsonc` and deployment pipeline.

### Deployment model

- The public entry point is `apps/api-edge`.
- Internal bounded contexts are separate Workers where service bindings add value.
- The web UI is a separate app and must talk to the public API, not internal Worker bindings.
- Asynchronous orchestration lives in `apps/runtime-worker` using Cloudflare Workflows by default; Durable Objects may be used for locks and strongly consistent coordination.

### State ownership

- Each bounded context owns its own persistence.
- In the Cloudflare-first phase, that usually means one D1 database per domain Worker or, if temporarily shared, table namespaces that can be extracted without rewriting clients.
- No Worker may query another domain's tables directly.
- Shared caches in KV must be derived, disposable copies of source-of-truth data.

### Internal communication

- Prefer Cloudflare service bindings for internal Worker-to-Worker communication.
- Prefer RPC-style service bindings for internal command/query boundaries.
- HTTP fetch between Workers is allowed only when mirroring a public contract is intentional.
- Background work uses Cloudflare Queues and/or Workflows, never fire-and-forget calls without delivery tracking.

### Shared package rules

- `packages/contracts` may contain shared types, schema validators, and contract tests.
- `packages/shared` may contain only generic utilities with no domain knowledge.
- Domain logic must not live in `packages/shared`.
- UI packages must not import internal Worker code.

## Cloudflare Resource Mapping

Use Cloudflare primitives deliberately:

- Workers: HTTP ingress and internal domain services
- Service bindings: internal synchronous calls
- D1: source-of-truth relational state for bounded contexts
- KV: read-heavy cache and idempotency records
- R2: artifacts, manifest bundles, export files, dead-letter archives
- Queues: asynchronous delivery and fanout steps
- Workflows: durable multistep orchestration
- Durable Objects: per-resource locking, coordination, and strongly consistent local state where needed
- Secrets Store and Worker secrets: platform credentials and envelope-encryption keys
- Workers Analytics Engine: usage telemetry and operational analytics

## Extraction Model

The monorepo is successful only if each bounded context can later move without changing public contracts.

A component is considered extraction-ready when:

- its persistence is owned only by that component,
- its internal consumers reach it only through contracts or service bindings,
- it has its own deployment config,
- it has no domain cross-imports,
- its public and event contracts already live in `packages/contracts`.

When a component outgrows Cloudflare-native storage or queueing:

- keep the public and internal contract stable,
- replace the adapter layer,
- optionally front the external service with the same Worker contract,
- use Hyperdrive or standard outbound connectivity only at the adapter layer.

## CI And Quality Gates

Every change must pass:

- lint
- typecheck
- unit tests
- contract tests
- integration tests for the changed component

Changes that affect `packages/contracts`, `specs/`, or shared auth/resource flows require downstream smoke tests for every impacted component.
