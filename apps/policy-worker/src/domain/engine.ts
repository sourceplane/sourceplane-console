import {
  isAuthorizationRoleAssignmentMembershipFact,
  isOrganizationRole,
  isProjectRole,
  type ActorType,
  type AuthorizationRequest,
  type AuthorizationResponse,
  type AuthorizationRoleAssignmentMembershipFact,
  type AuthorizationRoleAssignmentScope,
  type ResolvedTenantScope,
  type RoleName
} from "@sourceplane/contracts";

export interface PolicyRoleMap {
  readonly roles: Readonly<Record<RoleName, readonly string[]>>;
  readonly version: number;
}

export interface PolicyOverride {
  readonly actionPatterns: readonly string[];
  readonly effect: "allow" | "deny";
  readonly reason: string;
  readonly requiredRoles?: readonly RoleName[];
  readonly scope?: Partial<ResolvedTenantScope>;
  readonly subjectTypes?: readonly ActorType[];
}

export interface PolicyEngineOptions {
  readonly overrides?: readonly PolicyOverride[];
  readonly roleMap?: PolicyRoleMap;
}

export interface PolicyEngine {
  readonly overrides: readonly PolicyOverride[];
  readonly roleMap: PolicyRoleMap;
  authorize(input: AuthorizationRequest): AuthorizationResponse;
}

const operationalResourcePatterns = ["project.*", "environment.*", "resource.*", "component.*", "config.*", "deployment.*"] as const;
const readOnlyOperationalPatterns = [
  "organization.read",
  "project.read",
  "environment.read",
  "resource.read",
  "component.read",
  "config.read",
  "deployment.read",
  "audit.read",
  "usage.read"
] as const;

export const defaultPolicyRoleMap: PolicyRoleMap = {
  version: 1,
  roles: {
    owner: ["*"],
    admin: [
      "organization.read",
      "organization.update",
      "organization.member.list",
      "organization.member.update",
      "organization.member.remove",
      "organization.invite.create",
      "organization.invite.revoke",
      "membership.*",
      "invite.*",
      ...operationalResourcePatterns,
      "audit.read",
      "usage.read"
    ],
    builder: [
      "organization.read",
      ...operationalResourcePatterns
    ],
    viewer: readOnlyOperationalPatterns,
    billing_admin: ["organization.read", "billing.*", "usage.read"],
    project_admin: [
      "project.read",
      "project.update",
      "project.delete",
      "environment.*",
      "resource.*",
      "component.*",
      "config.*",
      "deployment.*",
      "audit.read",
      "usage.read"
    ],
    project_builder: [
      "project.read",
      "project.update",
      "environment.*",
      "resource.*",
      "component.*",
      "config.*",
      "deployment.*"
    ],
    project_viewer: [
      "project.read",
      "environment.read",
      "resource.read",
      "component.read",
      "config.read",
      "deployment.read",
      "audit.read",
      "usage.read"
    ]
  }
} as const;

export function createPolicyEngine(options: PolicyEngineOptions = {}): PolicyEngine {
  const roleMap = options.roleMap ?? defaultPolicyRoleMap;
  const overrides = options.overrides ?? [];

  return {
    overrides,
    roleMap,
    authorize(input: AuthorizationRequest): AuthorizationResponse {
      return evaluateAuthorization(input, {
        overrides,
        roleMap
      });
    }
  };
}

export function evaluateAuthorization(
  input: AuthorizationRequest,
  options: PolicyEngineOptions = {}
): AuthorizationResponse {
  const roleMap = options.roleMap ?? defaultPolicyRoleMap;
  const overrides = options.overrides ?? [];
  const derivedScope = deriveResolvedTenantScope(input);
  const memberships = normalizeMembershipFacts(input);
  const applicableMemberships = memberships.filter((membership) => roleScopeIsValid(membership) && scopeContains(membership.scope, derivedScope));
  const overrideDecision = evaluateOverrides({
    applicableMemberships,
    derivedScope,
    input,
    overrides,
    policyVersion: roleMap.version
  });

  if (overrideDecision) {
    return overrideDecision;
  }

  if (input.subject.type === "workflow" || input.subject.type === "system") {
    return deny("deny.subject_type_requires_override", derivedScope, roleMap.version);
  }

  if (applicableMemberships.length === 0) {
    return deny("deny.no_matching_membership", derivedScope, roleMap.version);
  }

  const grantingMembership = applicableMemberships.find((membership) => roleAllowsAction(roleMap, membership.role, input.action));

  if (!grantingMembership) {
    return deny("deny.action_not_permitted", derivedScope, roleMap.version);
  }

  return {
    allow: true,
    reason: `allow.role.${grantingMembership.role}`,
    policyVersion: roleMap.version,
    derivedScope
  };
}

function evaluateOverrides(options: {
  applicableMemberships: AuthorizationRoleAssignmentMembershipFact[];
  derivedScope: ResolvedTenantScope;
  input: AuthorizationRequest;
  overrides: readonly PolicyOverride[];
  policyVersion: number;
}): AuthorizationResponse | null {
  for (const override of options.overrides) {
    if (!matchesOverride(override, options.input, options.derivedScope, options.applicableMemberships)) {
      continue;
    }

    return {
      allow: override.effect === "allow",
      reason: override.reason,
      policyVersion: options.policyVersion,
      derivedScope: options.derivedScope
    };
  }

  return null;
}

function matchesOverride(
  override: PolicyOverride,
  input: AuthorizationRequest,
  derivedScope: ResolvedTenantScope,
  applicableMemberships: AuthorizationRoleAssignmentMembershipFact[]
): boolean {
  if (override.subjectTypes && !override.subjectTypes.includes(input.subject.type)) {
    return false;
  }

  if (!override.actionPatterns.some((pattern) => matchesActionPattern(pattern, input.action))) {
    return false;
  }

  if (override.scope && !matchesPartialScope(override.scope, derivedScope)) {
    return false;
  }

  if (override.requiredRoles) {
    return applicableMemberships.some((membership) => override.requiredRoles?.includes(membership.role));
  }

  return true;
}

function matchesPartialScope(partialScope: Partial<ResolvedTenantScope>, derivedScope: ResolvedTenantScope): boolean {
  return Object.entries(partialScope).every(([key, value]) => {
    const scopeKey = key as keyof ResolvedTenantScope;

    return value === undefined || derivedScope[scopeKey] === value;
  });
}

function normalizeMembershipFacts(input: AuthorizationRequest): AuthorizationRoleAssignmentMembershipFact[] {
  return input.context.memberships.filter(isAuthorizationRoleAssignmentMembershipFact);
}

function roleScopeIsValid(membership: AuthorizationRoleAssignmentMembershipFact): boolean {
  if (isOrganizationRole(membership.role)) {
    return true;
  }

  if (!isProjectRole(membership.role)) {
    return false;
  }

  return resolveProjectId(membership.scope) !== undefined;
}

function roleAllowsAction(roleMap: PolicyRoleMap, role: RoleName, action: string): boolean {
  const patterns = roleMap.roles[role] ?? [];

  return patterns.some((pattern) => matchesActionPattern(pattern, action));
}

function matchesActionPattern(pattern: string, action: string): boolean {
  if (pattern === "*") {
    return true;
  }

  if (pattern.endsWith(".*")) {
    return action.startsWith(`${pattern.slice(0, -2)}.`);
  }

  return pattern === action;
}

function scopeContains(scope: AuthorizationRoleAssignmentScope, derivedScope: ResolvedTenantScope): boolean {
  if (scope.orgId !== derivedScope.orgId) {
    return false;
  }

  const projectId = resolveProjectId(scope);
  if (projectId && projectId !== derivedScope.projectId) {
    return false;
  }

  const environmentId = resolveEnvironmentId(scope);
  if (environmentId && environmentId !== derivedScope.environmentId) {
    return false;
  }

  const resourceId = resolveResourceId(scope);
  if (resourceId && resourceId !== derivedScope.resourceId) {
    return false;
  }

  return true;
}

function resolveProjectId(scope: AuthorizationRoleAssignmentScope): string | undefined {
  if ("projectId" in scope && typeof scope.projectId === "string") {
    return scope.projectId;
  }

  return undefined;
}

function resolveEnvironmentId(scope: AuthorizationRoleAssignmentScope): string | undefined {
  if ("environmentId" in scope && typeof scope.environmentId === "string") {
    return scope.environmentId;
  }

  return undefined;
}

function resolveResourceId(scope: AuthorizationRoleAssignmentScope): string | undefined {
  if ("resourceId" in scope && typeof scope.resourceId === "string") {
    return scope.resourceId;
  }

  return undefined;
}

function deriveResolvedTenantScope(input: AuthorizationRequest): ResolvedTenantScope {
  const { resource } = input;

  switch (resource.kind) {
    case "organization":
      return {
        orgId: resource.orgId
      };
    case "project": {
      const projectId = resource.projectId ?? (resource.id !== resource.orgId ? resource.id : undefined);

      return stripUndefinedValues(
        projectId
          ? {
              orgId: resource.orgId,
              projectId
            }
          : {
              orgId: resource.orgId
            }
      );
    }
    case "environment": {
      const projectId = resource.projectId ?? undefined;
      const environmentId = resource.environmentId ?? resource.id;

      return stripUndefinedValues(
        projectId
          ? {
              orgId: resource.orgId,
              projectId,
              environmentId
            }
          : {
              orgId: resource.orgId,
              environmentId
            }
      );
    }
    case "resource": {
      const projectId = resource.projectId ?? undefined;
      const environmentId = resource.environmentId ?? undefined;

      return stripUndefinedValues({
        orgId: resource.orgId,
        ...(projectId ? { projectId } : {}),
        ...(environmentId ? { environmentId } : {}),
        resourceId: resource.id
      });
    }
  }
}

function stripUndefinedValues(scope: {
  orgId: string;
  projectId?: string;
  environmentId?: string;
  resourceId?: string;
}): ResolvedTenantScope {
  return Object.fromEntries(Object.entries(scope).filter((entry) => entry[1] !== undefined)) as ResolvedTenantScope;
}

function deny(reason: string, derivedScope: ResolvedTenantScope, policyVersion: number): AuthorizationResponse {
  return {
    allow: false,
    reason,
    policyVersion,
    derivedScope
  };
}