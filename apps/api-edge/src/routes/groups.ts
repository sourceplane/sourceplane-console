import type { PublicRouteGroup } from "@sourceplane/contracts";

import type { PublicRouteClientKey } from "../types.js";

export interface PublicRouteDefinition {
  clientKey: PublicRouteClientKey;
  group: PublicRouteGroup;
  summary: string;
}

export const publicRouteDefinitions = [
  {
    clientKey: "identity",
    group: "/v1/auth",
    summary: "auth and session management"
  },
  {
    clientKey: "membership",
    group: "/v1/organizations",
    summary: "organizations, memberships, and invites"
  },
  {
    clientKey: "projects",
    group: "/v1/projects",
    summary: "projects and environments"
  },
  {
    clientKey: "projects",
    group: "/v1/environments",
    summary: "environment lifecycle and queries"
  },
  {
    clientKey: "resources",
    group: "/v1/resources",
    summary: "resource lifecycle"
  },
  {
    clientKey: "resources",
    group: "/v1/components",
    summary: "component catalog and manifests"
  },
  {
    clientKey: "config",
    group: "/v1/config",
    summary: "config metadata and secret descriptors"
  },
  {
    clientKey: "runtime",
    group: "/v1/deployments",
    summary: "deployment orchestration and status"
  },
  {
    clientKey: "audit",
    group: "/v1/audit",
    summary: "audit and event query surface"
  },
  {
    clientKey: "metering",
    group: "/v1/usage",
    summary: "usage summaries"
  },
  {
    clientKey: "billing",
    group: "/v1/billing",
    summary: "billing summaries and entitlements"
  }
] as const satisfies readonly PublicRouteDefinition[];

export function getPublicRouteDefinition(group: PublicRouteGroup): PublicRouteDefinition {
  const routeDefinition = publicRouteDefinitions.find((definition) => definition.group === group);

  if (!routeDefinition) {
    throw new Error(`Unknown public route group: ${group}`);
  }

  return routeDefinition;
}