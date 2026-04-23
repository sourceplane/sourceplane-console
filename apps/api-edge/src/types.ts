import type { PublicRouteGroup, RbacActor, ScopeKind } from "@sourceplane/contracts";

export type PublicRouteClientKey =
  | "audit"
  | "billing"
  | "config"
  | "identity"
  | "membership"
  | "metering"
  | "projects"
  | "resources"
  | "runtime";

export interface RouteMatch {
  group: PublicRouteGroup;
  subpath: string;
}

export interface EdgeRequestContext {
  idempotencyKey: string | null;
  method: string;
  pathname: string;
  requestId: string;
  routeMatch: RouteMatch | null;
  traceparent: string | null;
}

export interface TenantContext {
  environmentId: string | null;
  orgId: string | null;
  projectId: string | null;
  resourceId: string | null;
  scopeKind: ScopeKind | null;
}

export interface ResolvedActor extends RbacActor {
  authenticationSource: "bearer_token";
}

export interface AuthContext {
  actor: ResolvedActor | null;
  bearerToken: string | null;
  organizationId: string | null;
  sessionId: string | null;
}

export interface ServiceRequestMetadata {
  auth: AuthContext;
  request: Request;
  requestContext: EdgeRequestContext;
  tenant: TenantContext;
}

export interface PublicRouteClientRequest extends ServiceRequestMetadata {
  jsonBody: unknown;
  method: string;
  publicPathname: string;
  publicSearch: string;
}

export interface DomainRouteResult {
  cursor?: string | null;
  data: unknown;
  status?: number;
}