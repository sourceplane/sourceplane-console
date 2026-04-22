# Web Console

Status: Ready for implementation

Primary monorepo targets:

- `apps/web-console`
- optional shared UI helpers in `packages/ui`

Primary dependencies:

- `specs/contracts/api-guidelines.md`
- `specs/contracts/component-manifest.schema.yaml`
- `specs/components/01-edge-api.md`
- `specs/components/06-resources-and-component-registry.md`
- `specs/components/08-runtime-orchestration.md`

Cloudflare primitives:

- Cloudflare Pages or Workers-based web app
- optional service Worker only for frontend hosting concerns

## Intent

Provide the operator-facing control plane UI for humans without creating a second, UI-only system contract.

## Scope

- sign-in and session flows
- organization and project switching
- project and environment management
- component catalog browsing
- resource creation and status views
- config and secret metadata management
- audit and usage views
- billing summary views

## Out Of Scope

- a generic CMS
- direct calls to internal service bindings
- bypassing the public API

## Hard Contracts To Honor

- Public API rules in `specs/contracts/api-guidelines.md`
- Component manifest schema in `specs/contracts/component-manifest.schema.yaml`

## Required Capabilities

### UX Principles

- Generate or strongly assist input forms from component manifests where practical.
- Reflect resource `status.phase` and deployment history clearly.
- Keep organization, project, and environment scope visible at all times.

### Required Flows

- sign in
- create organization
- create project
- create environment
- create resource from a component definition
- view deployment status
- inspect audit history

## Agent Freedom

- The agent may choose React and its routing stack or another modern frontend stack that deploys well on Cloudflare.
- The agent may build a small design system in `packages/ui`.
- Generated forms may be fully automatic or manifest-assisted, but they must remain driven by the shared component contract.

## Acceptance Criteria

- A non-CLI user can complete the baseline control-plane flow without hidden admin endpoints.
- The UI does not invent fields or workflows that are absent from the public API contracts.
- Resource configuration inputs come from manifest definitions, not hardcoded per-component forms where avoidable.

## Extraction Seam

The web console is a client of the platform, not part of the platform core. It must remain replaceable without changing domain contracts.
