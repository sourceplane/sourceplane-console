# Organizations And Membership

Status: Ready for implementation

Primary monorepo targets:

- `apps/membership-worker`

Primary dependencies:

- `specs/contracts/api-guidelines.md`
- `specs/contracts/event-envelope.schema.yaml`
- `specs/contracts/tenancy-and-rbac.md`
- `specs/components/02-identity.md`
- `specs/components/03-policy-authorization.md`

Cloudflare primitives:

- Workers
- D1
- Queues optional for invite email dispatch

## Intent

Own the tenant boundary: organizations, memberships, invites, and role assignments.

## Scope

- create and update organizations
- list organizations for an actor
- membership creation, update, and removal
- invitation lifecycle
- organization switching metadata

## Out Of Scope

- sign-in and session management
- project and environment lifecycle
- billing plan logic

## Hard Contracts To Honor

- Organization-scoped tenancy model in `specs/contracts/tenancy-and-rbac.md`
- Event envelope in `specs/contracts/event-envelope.schema.yaml`

## Required Capabilities

### Public/Internal Methods

- `createOrganization`
- `getOrganization`
- `listOrganizationsForSubject`
- `inviteMember`
- `acceptInvite`
- `listMembers`
- `updateMemberRole`
- `removeMember`

### Events

- `organization.created`
- `organization.updated`
- `membership.added`
- `membership.updated`
- `membership.removed`
- `invite.created`
- `invite.accepted`
- `invite.revoked`

## Data Ownership

This component owns:

- organizations
- memberships
- invitations
- role assignments

## Agent Freedom

- The agent may choose slug-based or ID-based org addressing externally as long as the API contract is consistent.
- Invite delivery may start as an internal queue event with a stub mailer adapter.
- Org settings beyond the basics may be deferred if the core tenant flows work.

## Acceptance Criteria

- A new signed-in user can create an organization.
- Additional users can be invited and assigned roles.
- Membership changes become visible to policy evaluation through the published contract.
- Organization data can be extracted later without rewriting identity.

## Extraction Seam

Identity may know who the user is, but only membership knows which organizations and roles the actor has. That seam must stay intact.
