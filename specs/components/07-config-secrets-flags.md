# Config, Secrets, And Feature Flags

Status: Ready for implementation

Primary monorepo targets:

- `apps/config-worker`

Primary dependencies:

- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/05-projects-environments.md`
- `specs/components/06-resources-and-component-registry.md`

Cloudflare primitives:

- Workers
- D1
- KV for read-heavy resolved config cache
- Secrets Store for envelope-encryption keys

## Intent

Provide versioned non-secret configuration, encrypted secret storage, and feature-flag evaluation for organizations, projects, environments, and resources.

## Scope

- config versions and promotion
- encrypted tenant secrets
- effective config resolution by scope
- feature flag definitions and evaluation
- secret rotation metadata

## Out Of Scope

- platform-level Worker deployment secrets
- resource provisioning workflows
- payment-provider secrets beyond storage primitives

## Hard Contracts To Honor

- Event envelope in `specs/contracts/event-envelope.schema.yaml`
- Tenant scope rules in `specs/contracts/tenancy-and-rbac.md`

## Required Capabilities

### Public/Internal Methods

- `createConfigVersion`
- `promoteConfigVersion`
- `listConfigVersions`
- `resolveEffectiveConfig`
- `putSecret`
- `rotateSecret`
- `listSecretMetadata`
- `evaluateFlag`
- `listFlags`

### Events

- `config.version_created`
- `config.promoted`
- `secret.stored`
- `secret.rotated`
- `feature.updated`

### Secret Rules

- Secret payloads must be encrypted before persistence.
- Plaintext secret values must never appear in logs, audit payloads, or emitted event payloads.
- V1 should prefer write-only and metadata-listing secret APIs unless a tightly controlled reveal flow is explicitly needed.

## Data Ownership

This component owns:

- config sets and versions
- config entries
- secret metadata and encrypted payloads
- feature flag definitions and evaluation rules

## Agent Freedom

- The agent may choose exact config inheritance semantics as long as they are explicit and deterministic.
- The agent may cache resolved config in KV if cache invalidation is driven by version changes.
- Feature flags may begin with simple rule types before richer targeting arrives.

## Acceptance Criteria

- Config can be versioned and promoted per environment.
- Secrets are encrypted at rest and never returned accidentally in audit or API list views.
- Runtime and edge components can resolve effective config through the published contract.

## Extraction Seam

Other components may depend on resolved config, but they must not read config storage directly or implement competing secret stores.
