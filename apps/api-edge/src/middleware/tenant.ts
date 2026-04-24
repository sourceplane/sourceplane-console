import { internalOrgIdHeaderName } from "@sourceplane/contracts";

import type { TenantContext } from "../types.js";

export function extractTenantContext(pathname: string, headers?: Headers): TenantContext {
  const segments = pathname.split("/").filter(Boolean);
  const organizationSegment = segmentAfter(segments, "organizations");
  const pathOrgId = organizationSegment && !isReservedOrganizationSubresource(organizationSegment) ? organizationSegment : null;
  const headerOrgId = headers?.get(internalOrgIdHeaderName) ?? null;
  const orgId = pathOrgId ?? headerOrgId;
  const projectId = segmentAfter(segments, "projects");
  const environmentId = segmentAfter(segments, "environments");
  const resourceId = segmentAfter(segments, "resources");

  return {
    environmentId,
    orgId,
    projectId,
    resourceId,
    scopeKind: resolveScopeKind({ environmentId, orgId, projectId, resourceId })
  };
}

function resolveScopeKind(context: Omit<TenantContext, "scopeKind">): TenantContext["scopeKind"] {
  if (context.resourceId) {
    return "resource";
  }

  if (context.environmentId) {
    return "environment";
  }

  if (context.projectId) {
    return "project";
  }

  if (context.orgId) {
    return "organization";
  }

  return null;
}

function segmentAfter(segments: string[], segmentName: string): string | null {
  const index = segments.indexOf(segmentName);
  const value = index >= 0 ? segments[index + 1] : undefined;

  return value ?? null;
}

function isReservedOrganizationSubresource(segment: string): boolean {
  return segment === "invites";
}