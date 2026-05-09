# Monorepo Spec

Status: Normative

## Intent

This repository starts as a Cloudflare-first monorepo for a reusable multi-tenant SaaS starter bootstrap. It should let implementation move quickly across identity, organizations, projects, membership, billing, audit, usage, notifications, webhooks, admin/support, and optional product extensions while preserving clean seams for later extraction into separate repos and deployments.

## Canonical Repo Shape

```text
intent.yaml                Orun intent — composition sources, discovery roots, environment lanes
kiox.yaml                  Orun runtime pin

/apps
  /api-edge                Public HTTP entry Worker
    component.yaml         Component descriptor (type: cloudflare-worker-turbo)
  /web-console             Cloudflare Pages or Workers-based UI
    component.yaml         Component descriptor (type: cloudflare-pages-turbo)
  /identity-worker
    component.yaml
  /policy-worker
    component.yaml
  /membership-worker
    component.yaml
  /projects-worker
    component.yaml
  /notifications-worker
    component.yaml
  /webhooks-worker
    component.yaml
  /admin-worker
    component.yaml
  /resources-worker
    component.yaml         Optional starter extension for project-scoped resources
  /config-worker
    component.yaml
  /events-worker
    component.yaml
  /runtime-worker
    component.yaml         Optional starter extension for long-running resource workflows
  /metering-worker
    component.yaml
  /billing-worker
    component.yaml

/packages
  /contracts               Shared API, tenancy, event, starter, resource, and manifest types
    component.yaml         Component descriptor (type: turbo-package)
  /sdk                     Public TypeScript SDK
    component.yaml
  /cli                     Public CLI package
    component.yaml
  /ui                      Shared UI components and generated form helpers
    component.yaml
  /shared                  Generic helpers only: errors, logging, ids, tracing
    component.yaml
  /testing                 Test utilities, fixtures, contract assertions
    component.yaml

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
- Starter-domain asynchronous work uses Cloudflare Queues and Workers behind the owning bounded context.
- Long-running product-resource orchestration may live in `apps/runtime-worker` using Cloudflare Workflows by default; Durable Objects may be used for locks and strongly consistent coordination.

### State ownership

- Each bounded context owns its own persistence.
- The primary relational store is Supabase Postgres, reached from Workers through Cloudflare Hyperdrive.
- In V1, a single Supabase project/database may host multiple bounded contexts, but each context must own a logical schema or table namespace, service credentials, and migrations that can be extracted without rewriting clients.
- No Worker may query another domain's tables or schemas directly.
- Shared caches in KV must be derived, disposable copies of source-of-truth data.
- Every project-scoped table, cache key, event, and query must carry `org_id + project_id`; never rely on `project_id` alone.

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

## Platform Resource Mapping

Use platform primitives deliberately:

- Workers: HTTP ingress and internal domain services
- Service bindings: internal synchronous calls
- Supabase Postgres: source-of-truth relational state for bounded contexts
- Hyperdrive: Worker-to-Postgres connectivity, pooling, and regional routing at the adapter layer
- D1: optional edge-local cache, test adapter, or managed customer resource; not the source of truth for starter domain state
- KV: read-heavy cache and idempotency records
- R2: artifacts, manifest bundles, export files, dead-letter archives
- Queues: asynchronous delivery and fanout steps
- Workflows: durable multistep orchestration
- Durable Objects: per-resource locking, coordination, and strongly consistent local state where needed
- Secrets Store and Worker secrets: platform credentials and envelope-encryption keys
- Workers Analytics Engine: usage telemetry and operational analytics

## Primary Database Operating Model

Supabase Postgres is the primary operational database for product-owned relational state, including identity, membership, projects, config metadata, canonical events, audit indexes, usage rollups, billing state, notifications, webhooks, support actions, and optional resource/runtime metadata.

- Workers connect to Supabase Postgres through Hyperdrive bindings. Raw connection strings and Supabase service keys must stay in platform configuration and must not leak into domain logic.
- The V1 Supabase database already exists and Cloudflare Hyperdrive is already configured for it as `sourceplane-db`.
- Workers that need the primary database must use the configured `sourceplane-db` Hyperdrive binding/resource instead of inventing a second database binding.
- Local database verification may use temporary credentials generated through `wrangler` when needed. Temporary credentials must never be committed, logged in full, or copied into source files.
- Repository adapters own SQL, pooling assumptions, transaction boundaries, and Hyperdrive-specific behavior. Domain services receive typed repositories or unit-of-work abstractions, not platform database clients.
- Each bounded context owns its schema or table namespace and migration history. Cross-context foreign keys are prohibited; use opaque IDs, service calls, and published events instead.
- Every tenant-scoped table must include `org_id` directly or have an auditable path to `org_id` through a table owned by the same bounded context.
- Domain mutations and outbox/event inserts that describe the same state change should commit atomically in the same Postgres transaction.
- Supabase Auth, Realtime, Storage, and Edge Functions are not platform source-of-truth services unless a future spec explicitly adopts them. Sourceplane-owned identity remains in the identity component.

## Operational Access And Resource Verification

Agents may assume full authenticated access to `gh` and `wrangler` for repository, CI, Cloudflare, and deployment work in task scope.

- The Cloudflare account ID is `f9270f828799775bebf9315248fdf717`.
- GitHub Actions has the Cloudflare API credential needed for CI and deploy workflows.
- GitHub Actions must also expose the Cloudflare account ID to jobs that create, inspect, or deploy Cloudflare resources.
- Any task that creates or updates a Cloudflare resource must verify the resource exists after creation using `wrangler` or the Cloudflare API, then record that verification in the implementer or verifier report.
- Verifiers must not rely only on successful deploy or migration command exit codes when a Cloudflare resource is created. They must inspect the resulting Cloudflare resource state directly.

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
- move its owned Supabase schema/tables or replace the repository adapter,
- optionally front the external service with the same Worker contract,
- keep Hyperdrive or standard outbound connectivity only at the adapter layer.

## Composition and CI Model

This repo uses [orun](https://orun-api.sourceplane.ai) with [stack-tectonic](https://github.com/sourceplane/stack-tectonic) for composition-driven CI and deployment.

- **`intent.yaml`** at the repo root declares the stack-tectonic OCI source, discovery roots (`apps/`, `packages/`), and environment lane policies (dev → staging → production).
- **`component.yaml`** in each app and package describes the composition type, environment subscriptions, and inputs. No app or package is wired into the CI workflow directly.
- **`kiox.yaml`** pins the orun runtime version.

Composition types used:

| Type                      | Used by                                     |
| ------------------------- | ------------------------------------------- |
| `cloudflare-worker-turbo` | All Workers in `apps/` except `web-console` |
| `cloudflare-pages-turbo`  | `apps/web-console`                          |
| `turbo-package`           | All packages in `packages/`                 |

The CI workflow (`ci.yml`) runs `orun plan --changed` on every PR and push to main, then fans out `orun run` jobs per changed component. Deployment lanes are encoded in `intent.yaml` environments — there is no separate deploy workflow.

Adding a new app or package requires only a `component.yaml` alongside the code. The workflow does not need to change.

## CI And Quality Gates

Every change must pass the gates enforced by the matched stack-tectonic composition:

- lint
- typecheck
- unit tests
- contract tests
- integration tests for the changed component
- local `/Users/irinelinson/.local/bin/kiox -- orun plan --changed`
- local `/Users/irinelinson/.local/bin/kiox -- orun run --changed`

Changes that affect `packages/contracts`, `specs/`, or shared auth, tenancy, project, billing, audit, resource, or webhook flows require downstream smoke tests for every impacted component.

If `orun plan --changed` produces no component jobs, the matching `orun run --changed` result should be recorded as a no-op instead of skipped silently.
