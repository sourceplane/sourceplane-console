# Web Console

Status: Ready for implementation

Primary monorepo targets:

- `apps/web-console`
- optional shared UI helpers in `packages/ui`

Primary dependencies:

- `specs/contracts/api-guidelines.md`
- `specs/product-overview.md`
- optional `specs/contracts/component-manifest.schema.yaml`
- `specs/components/01-edge-api.md`
- `specs/components/04-organizations-membership.md`
- `specs/components/05-projects-environments.md`

Cloudflare primitives:

- Cloudflare Pages or Workers-based web app
- optional service Worker only for frontend hosting concerns

## Intent

Provide the usable SaaS starter console for humans without creating a second, UI-only system contract. The first screen after auth should be the working app surface, not a marketing page.

## Scope

- sign-in and session flows
- organization and project switching
- organization settings, members, and invitations
- project and environment management
- account, API-key, and security settings
- config and secret metadata management
- audit and usage views
- billing summary views
- notification preferences
- webhook configuration and delivery status
- admin/support workflows where enabled
- optional component catalog browsing
- optional resource creation and status views

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
- Reflect optional resource `status.phase` and deployment history clearly when resource extensions are enabled.
- Keep organization, project, and environment scope visible at all times.

### Required Flows

- sign in
- create organization
- invite and remove members
- accept invitation
- create project
- create environment
- manage account, API keys, and security settings
- manage project config and secrets metadata
- inspect audit history
- review usage and quota state
- review billing summary, subscription state, and invoices
- configure webhooks and notification preferences
- optionally create resources from component definitions
- optionally view deployment status

## Agent Freedom

- The agent may choose React and its routing stack or another modern frontend stack that deploys well on Cloudflare.
- The agent may build a small design system in `packages/ui`.
- Generated forms may be fully automatic or manifest-assisted, but they must remain driven by the shared component contract.

## Acceptance Criteria

- A non-CLI user can complete the baseline SaaS starter flow without hidden admin endpoints.
- The UI does not invent fields or workflows that are absent from the public API contracts.
- Optional resource configuration inputs come from manifest definitions, not hardcoded per-component forms where avoidable.

## Extraction Seam

The web console is a client of the platform, not part of the platform core. It must remain replaceable without changing domain contracts.
