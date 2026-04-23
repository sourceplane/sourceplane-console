import {
  idempotencyHeaderName,
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalEnvironmentIdHeaderName,
  internalOrgIdHeaderName,
  internalProjectIdHeaderName,
  internalResourceIdHeaderName,
  internalSessionIdHeaderName,
  publicRouteGroups,
  requestIdHeaderName,
  traceparentHeaderName,
  type PublicRouteGroup
} from "@sourceplane/contracts";
import { createRequestId } from "@sourceplane/shared";

import type { AuthContext, EdgeRequestContext, RouteMatch, TenantContext } from "../types.js";

export {
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalEnvironmentIdHeaderName,
  internalOrgIdHeaderName,
  internalProjectIdHeaderName,
  internalResourceIdHeaderName,
  internalSessionIdHeaderName
};

export function createEdgeRequestContext(request: Request, routeMatch: RouteMatch | null): EdgeRequestContext {
  const url = new URL(request.url);

  return {
    idempotencyKey: request.headers.get(idempotencyHeaderName),
    method: request.method.toUpperCase(),
    pathname: url.pathname,
    requestId: createRequestId(),
    routeMatch,
    traceparent: request.headers.get(traceparentHeaderName)
  };
}

export function matchPublicRoute(pathname: string): RouteMatch | null {
  const routeGroup = publicRouteGroups.find(
    (group) => pathname === group || pathname.startsWith(`${group}/`)
  ) satisfies PublicRouteGroup | undefined;

  if (!routeGroup) {
    return null;
  }

  return {
    group: routeGroup,
    subpath: pathname.slice(routeGroup.length) || "/"
  };
}

export function isMutatingMethod(method: string): boolean {
  return ["DELETE", "PATCH", "POST", "PUT"].includes(method.toUpperCase());
}

export function buildForwardHeaders(options: {
  auth: AuthContext;
  request: Request;
  requestContext: EdgeRequestContext;
  tenant: TenantContext;
}): Headers {
  const headers = new Headers({
    [requestIdHeaderName]: options.requestContext.requestId
  });

  if (options.requestContext.traceparent) {
    headers.set(traceparentHeaderName, options.requestContext.traceparent);
  }

  if (options.requestContext.idempotencyKey) {
    headers.set(idempotencyHeaderName, options.requestContext.idempotencyKey);
  }

  const authorization = options.request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }

  const cookie = options.request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }

  if (options.auth.actor) {
    headers.set(internalActorTypeHeaderName, options.auth.actor.type);
    headers.set(internalActorIdHeaderName, options.auth.actor.id);
  }

  if (options.auth.sessionId) {
    headers.set(internalSessionIdHeaderName, options.auth.sessionId);
  }

  const orgId = options.tenant.orgId ?? options.auth.organizationId;
  if (orgId) {
    headers.set(internalOrgIdHeaderName, orgId);
  }

  if (options.tenant.projectId) {
    headers.set(internalProjectIdHeaderName, options.tenant.projectId);
  }

  if (options.tenant.environmentId) {
    headers.set(internalEnvironmentIdHeaderName, options.tenant.environmentId);
  }

  if (options.tenant.resourceId) {
    headers.set(internalResourceIdHeaderName, options.tenant.resourceId);
  }

  return headers;
}