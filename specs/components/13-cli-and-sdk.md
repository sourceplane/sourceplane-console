# CLI And SDK

Status: Ready for implementation

Primary monorepo targets:

- `packages/sdk`
- `packages/cli`

Primary dependencies:

- `specs/contracts/api-guidelines.md`
- `specs/contracts/resource-contract.schema.yaml`
- `specs/contracts/component-manifest.schema.yaml`
- `specs/components/01-edge-api.md`

Cloudflare primitives:

- none directly for the SDK and CLI, beyond talking to the public API

## Intent

Make the control plane scriptable and automation-friendly through a stable TypeScript SDK and a first-class CLI.

## Scope

- authenticated API client
- typed resource and component helpers
- CLI auth flow
- organization selection and context persistence
- project, environment, resource, and deployment commands
- machine-readable output modes

## Out Of Scope

- direct service-binding calls
- direct database access
- a separate private API surface

## Hard Contracts To Honor

- Public API rules in `specs/contracts/api-guidelines.md`
- Shared resource and component schemas

## Required Capabilities

### SDK

- typed client for the public API
- auth helpers
- pagination helpers
- error normalization

### CLI

- `login`
- `whoami`
- `org list`
- `org use`
- `project create`
- `env create`
- `component list`
- `resource create`
- `resource get`
- `deployment get`

### Output Rules

- Support human-readable default output.
- Support JSON output for automation.
- Surface request IDs and actionable error codes on failure.

## Agent Freedom

- V1 CLI may be implemented in TypeScript for speed even if a later Go CLI is desired.
- The SDK may be hand-written or partially generated from shared contracts.
- Command grammar may evolve as long as core capabilities and machine-readable output remain available.

## Acceptance Criteria

- Every major public control-plane flow available in the web console is also available through the CLI or SDK.
- SDK consumers do not need to know internal Worker topology.
- CLI output is stable enough for CI usage.

## Extraction Seam

The SDK and CLI bind to the public API only. That allows backend components to move independently later.
