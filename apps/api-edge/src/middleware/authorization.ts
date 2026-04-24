import type { AuthorizationRequest, AuthorizationResource, PublicRouteGroup, ScopeKind } from "@sourceplane/contracts";

import type { AuthContext, TenantContext } from "../types.js";

export function buildAuthorizationRequest(options: {
  auth: AuthContext;
  method: string;
  routeGroup: PublicRouteGroup;
  subpath: string;
  tenant: TenantContext;
}): AuthorizationRequest | null {
  if (!options.auth.actor) {
    return null;
  }

  const authorizationResource = buildAuthorizationResource(options.routeGroup, options.tenant, options.auth);
  if (!authorizationResource) {
    return null;
  }

  return {
    action: deriveAuthorizationAction(options.routeGroup, options.subpath, options.method),
    context: {
      attributes: {
        method: options.method,
        routeGroup: options.routeGroup,
        subpath: options.subpath
      },
      memberships: []
    },
    resource: authorizationResource,
    subject: {
      id: options.auth.actor.id,
      type: options.auth.actor.type
    }
  };
}

function buildAuthorizationResource(
  routeGroup: PublicRouteGroup,
  tenant: TenantContext,
  auth: AuthContext
): AuthorizationResource | null {
  const orgId = tenant.orgId ?? auth.organizationId;
  const projectId = tenant.projectId;
  const environmentId = tenant.environmentId;
  const resourceId = tenant.resourceId;

  if (!orgId) {
    return null;
  }

  const kind = resolveResourceKind(tenant.scopeKind, routeGroup);
  const id = resourceId ?? environmentId ?? projectId ?? orgId;

  return {
    environmentId,
    id,
    kind,
    orgId,
    projectId
  };
}

function deriveAuthorizationAction(routeGroup: PublicRouteGroup, subpath: string, method: string): string {
  if (routeGroup === "/v1/organizations") {
    return deriveOrganizationAuthorizationAction(subpath, method);
  }

  const resourceName = routeGroup.slice(4).replace(/\//g, "_").replace(/s$/, "");

  return `${resourceName}.${actionSuffixForMethod(method)}`;
}

function deriveOrganizationAuthorizationAction(subpath: string, method: string): string {
  const normalizedSubpath = subpath === "/" ? "/" : subpath.replace(/\/$/u, "");
  const segments = normalizedSubpath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return method.toUpperCase() === "POST" ? "organization.create" : "organization.list";
  }

  if (segments[0] === "invites" && segments[2] === "accept") {
    return "organization.invite.accept";
  }

  if (segments[1] === "members" && segments.length === 2) {
    return "organization.member.list";
  }

  if (segments[1] === "members" && segments.length === 3) {
    return method.toUpperCase() === "DELETE" ? "organization.member.remove" : "organization.member.update";
  }

  if (segments[1] === "invites" && segments.length === 2) {
    return method.toUpperCase() === "POST" ? "organization.invite.create" : "organization.invite.list";
  }

  if (segments[1] === "invites" && segments.length === 3) {
    return method.toUpperCase() === "DELETE" ? "organization.invite.revoke" : `organization.invite.${actionSuffixForMethod(method)}`;
  }

  return `organization.${actionSuffixForMethod(method)}`;
}

function actionSuffixForMethod(method: string): string {
  switch (method.toUpperCase()) {
    case "DELETE":
      return "delete";
    case "PATCH":
      return "update";
    case "POST":
      return "create";
    case "PUT":
      return "upsert";
    default:
      return "read";
  }
}

function resolveResourceKind(scopeKind: ScopeKind | null, routeGroup: PublicRouteGroup): AuthorizationResource["kind"] {
  if (scopeKind) {
    return scopeKind;
  }

  switch (routeGroup) {
    case "/v1/projects":
      return "project";
    case "/v1/environments":
      return "environment";
    case "/v1/resources":
      return "resource";
    default:
      return "organization";
  }
}