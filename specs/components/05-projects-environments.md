# Projects And Environments

Status: Ready for implementation

Primary monorepo targets:

- `apps/projects-worker`

Primary dependencies:

- `specs/contracts/api-guidelines.md`
- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/03-policy-authorization.md`
- `specs/components/04-organizations-membership.md`

Cloudflare primitives:

- Workers
- D1

## Intent

Provide the primary operating scopes under an organization: projects and environments.

## Scope

- project CRUD and archival
- environment CRUD and archival
- project metadata
- environment metadata and lifecycle state
- default environment bootstrapping rules

## Out Of Scope

- resource provisioning
- config storage
- billing ownership

## Hard Contracts To Honor

- Multitenant scope rules from `specs/contracts/tenancy-and-rbac.md`
- Event envelope from `specs/contracts/event-envelope.schema.yaml`

## Required Capabilities

### Public/Internal Methods

- `createProject`
- `getProject`
- `listProjects`
- `archiveProject`
- `createEnvironment`
- `getEnvironment`
- `listEnvironments`
- `archiveEnvironment`

### Events

- `project.created`
- `project.updated`
- `project.archived`
- `environment.created`
- `environment.updated`
- `environment.archived`

## Data Ownership

This component owns:

- projects
- environments
- project-level metadata and lifecycle markers

## Agent Freedom

- The agent may implement fixed default environments or customizable defaults as long as the contract stays stable.
- Project slugs, display names, and metadata shape may evolve if they remain additive.

## Acceptance Criteria

- A valid organization member with the correct role can create a project.
- A project can own multiple environments.
- Other components can reference project and environment IDs without direct DB coupling.

## Extraction Seam

Projects and environments are pure scope boundaries. They should remain simple and independently extractable even as resources and runtime become more complex.
