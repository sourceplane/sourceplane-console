# Sourceplane Constitution

Status: Normative

Applies to: every package, app, migration, API, event, UI surface, CLI command, and coding agent working in this monorepo.

## Purpose

Sourceplane is not a single-purpose SaaS app. It is a reusable control plane framework for building and operating micro-SaaS products. The implementation must preserve that property even when short-term delivery pressure pushes toward convenience.

## Constitutional Rules

### 1. Cloudflare-first now, extraction-safe later

- V1 must run fully on Cloudflare-managed primitives wherever practical.
- Internal boundaries must still assume that any component may later move behind an external service or its own repo.
- No domain may depend on a hosting-specific detail outside its adapter layer.

### 2. Contract-first development

- Shared contracts are defined before or alongside implementation.
- Public APIs, internal RPC surfaces, event envelopes, resource documents, and component manifests are versioned contracts.
- A component may change its internals freely, but it may not silently change a shared contract.

### 3. Organization-scoped multitenancy from day one

- The organization is the primary tenant boundary.
- Every persistent domain record must be traceable to an organization, directly or indirectly.
- User-only ownership models are prohibited except for pre-organization bootstrap records such as pending sign-up sessions.

### 4. Everything important is addressable as a resource

- Runtime-managed entities must follow a resource-oriented model with `kind`, `spec`, and `status`.
- Project and environment are first-class scope boundaries.
- Components are reusable definitions that create or manage resources; they are not ad hoc scripts.

### 5. API, CLI, and UI parity

- The public API is the primary interface.
- The CLI and web console must use the same public contracts.
- No feature may exist only in the UI if it can affect system state.

### 6. Events are first-class system behavior

- Every meaningful state mutation emits a domain event.
- Audit history, metering, notifications, and runtime automation must derive from events rather than bespoke side channels.
- Cloudflare-native event fanout may be implemented differently from Kafka-like systems, but the event contract must remain stable.

### 7. Business logic stays pure

- Domain logic belongs in domain modules, not transport handlers and not platform adapters.
- Workers, service bindings, D1, KV, Queues, R2, Secrets Store, Workflows, and Durable Objects are implementation adapters, not business policy.
- Business rules must be testable without deploying to Cloudflare.

### 8. Secure by default

- Secrets are encrypted at rest and redacted in logs, audit messages, and error payloads.
- Authorization is deny-by-default.
- Every mutating request must be attributable to an actor, service principal, or workflow instance.

### 9. Observe and explain the system

- Every mutating request gets a request ID and trace context.
- Every mutation is auditable.
- Every asynchronous workflow exposes state transitions and failure reasons in a user-readable form.

### 10. Backward compatibility is deliberate

- `v1` contracts must remain backward compatible unless a documented breaking-change process is followed.
- Deprecations need an explicit migration note.
- Extraction of a component from the monorepo must not require client-visible contract changes.

### 11. Bounded contexts are real

- Identity, policy, membership, projects, resources, config, runtime, events, metering, and billing are separate concerns even if some are deployed together in early iterations.
- Cross-domain data access is forbidden outside published contracts.
- Shared code may exist only for contracts, testing utilities, and generic infrastructure helpers.

### 12. The component manifest is a product primitive

- Component definitions must be portable and versioned.
- Component manifests must be sufficient to drive validation, API handling, CLI flows, and UI form generation.
- Runtime orchestration must consume the manifest rather than hardcoding per-component behavior.

## Definition Of Done

Work is not complete unless all of the following are true:

- It respects this constitution.
- It references or updates the relevant shared contract.
- It includes tests at the correct layer.
- It emits the required domain events and audit records for mutations.
- It preserves extraction seams.
- It documents any new operational dependency.

## Change Control

If a coding agent or human implementer needs to violate the constitution, they must first update this document and the affected contract docs, then sequence downstream changes explicitly. Silent drift is not allowed.
