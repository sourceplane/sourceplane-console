# Tenancy And RBAC Contract

Status: Normative

## Core Principle

Every meaningful entity belongs to an organization. Authorization starts with tenant scope, then applies role and policy checks.

## Canonical Actors

- `user`: an interactive human account
- `service_principal`: a non-human actor used by automation, CLI tokens, or integrations
- `workflow`: a runtime-owned actor executing orchestrated steps
- `system`: reserved for platform-internal maintenance actions

## Canonical Scope Objects

- `organization`
- `project`
- `environment`
- `resource`

Project, environment, and resource scope always nest under an organization.

## Minimum Roles

### Organization roles

- `owner`
- `admin`
- `builder`
- `viewer`
- `billing_admin`

### Project roles

- `project_admin`
- `project_builder`
- `project_viewer`

Environment- and resource-specific rules may narrow access further, but may not widen access beyond the enclosing organization role.

## Role Semantics

- `owner`: full control, including billing, destructive actions, and role management
- `admin`: manage org settings, members, projects, environments, and resources
- `builder`: create and mutate projects, environments, resources, configs, and deployments
- `viewer`: read-only access to allowed scopes
- `billing_admin`: billing and plan management without general operational admin rights

## Authorization Contract

The policy service evaluates a request shaped like this:

```json
{
  "subject": {
    "type": "user",
    "id": "usr_123"
  },
  "action": "resource.create",
  "resource": {
    "kind": "project",
    "id": "prj_123",
    "orgId": "org_123",
    "environmentId": null
  },
  "context": {
    "memberships": [],
    "attributes": {}
  }
}
```

And returns:

```json
{
  "allow": true,
  "reason": "org_admin",
  "policyVersion": 1,
  "derivedScope": {
    "orgId": "org_123",
    "projectId": "prj_123"
  }
}
```

## Required Rules

- Authorization is deny-by-default.
- Every mutating route requires an explicit acting subject.
- API keys and service principals must be bound to an organization and a role set.
- Cross-organization access is forbidden unless a future super-admin model is explicitly introduced.
- Destructive actions require elevated roles and full audit logging.

## Responsibility Split

- Identity owns user, session, and API-key facts.
- Membership owns organizations, invites, and role assignments.
- Policy owns authorization decisions and policy evaluation.
- Domain services may perform local invariant checks, but they must not invent parallel authorization systems.

## Audit Requirements

Every authorization-protected mutation must capture:

- subject ID and type,
- resolved organization,
- resolved role or policy reason,
- request ID,
- resource target.

## V1 Policy Scope

V1 may implement policy as code-backed RBAC plus a small attribute layer. It does not need a user-facing policy language yet. The contract above is the stable seam; the implementation behind it may evolve later.
