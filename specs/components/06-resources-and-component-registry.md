# Resources And Component Registry

Status: Ready for implementation

Primary monorepo targets:

- `apps/resources-worker`

Primary dependencies:

- `specs/contracts/resource-contract.schema.yaml`
- `specs/contracts/component-manifest.schema.yaml`
- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/05-projects-environments.md`

Cloudflare primitives:

- Workers
- D1
- R2 for stored manifests or packaged artifacts
- KV for catalog cache if needed

## Intent

Provide the core control-plane abstraction: resources backed by versioned component definitions.

## Scope

- component definition registration
- component version publication
- manifest validation
- resource CRUD
- resource relationship graph
- resource desired state updates

## Out Of Scope

- executing deployment steps
- long-running orchestration
- billing calculations

## Hard Contracts To Honor

- `specs/contracts/resource-contract.schema.yaml`
- `specs/contracts/component-manifest.schema.yaml`
- `specs/contracts/event-envelope.schema.yaml`

## Required Capabilities

### Public/Internal Methods

- `registerComponentDefinition`
- `publishComponentVersion`
- `getComponentDefinition`
- `listComponentDefinitions`
- `createResource`
- `getResource`
- `listResources`
- `updateResourceSpec`
- `deleteResource`
- `getResourceGraph`

### Events

- `component.registered`
- `component.version_published`
- `resource.created`
- `resource.updated`
- `resource.deleted`

### Validation

- Resource specs must validate against the owning component definition.
- Component manifests must validate against the shared manifest schema before publication.
- Resource type, component version, and scope must be internally consistent.

## Data Ownership

This component owns:

- component definitions
- component versions
- resource records
- resource dependencies and relationships

## Agent Freedom

- The agent may choose whether manifests are stored directly in D1, in R2 with D1 metadata, or both.
- The agent may choose how resource graph queries are represented internally.
- Resource patch semantics may use full replace or structured partial update if the public contract is explicit.

## Acceptance Criteria

- A component definition can be published and later resolved by version.
- A resource can be created under a project and environment using a valid component definition.
- Runtime orchestration can consume resource and manifest data without private table access.

## Extraction Seam

The registry decides what should exist. Runtime decides how it becomes real. That separation must remain clean.
