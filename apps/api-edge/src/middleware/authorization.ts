import type { AuthorizationRequest, AuthorizationResource, PublicRouteGroup, ScopeKind } from "@sourceplane/contracts";

import type { AuthContext, TenantContext } from "../types.js";

export function buildAuthorizationRequest(options: {
  auth: AuthContext;
  method: string;
  routeGroup: PublicRouteGroup;
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
    action: deriveAuthorizationAction(options.routeGroup, options.method),
    context: {
      attributes: {
        method: options.method,
        routeGroup: options.routeGroup
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

function deriveAuthorizationAction(routeGroup: PublicRouteGroup, method: string): string {
  const resourceName = routeGroup.slice(4).replace(/\//g, "_").replace(/s$/, "");

  return `${resourceName}.${actionSuffixForMethod(method)}`;
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