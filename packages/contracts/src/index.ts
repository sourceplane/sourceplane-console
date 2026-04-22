export const sourceplaneStages = ["local", "preview", "production"] as const;

export type DeploymentEnvironment = (typeof sourceplaneStages)[number];

export const sourceplaneErrorCodes = [
  "bad_request",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "validation_failed",
  "precondition_failed",
  "unsupported",
  "internal_error"
] as const;

export type SourceplaneErrorCode = (typeof sourceplaneErrorCodes)[number];

export const publicRouteGroups = [
  "/v1/auth",
  "/v1/organizations",
  "/v1/projects",
  "/v1/environments",
  "/v1/resources",
  "/v1/components",
  "/v1/config",
  "/v1/deployments",
  "/v1/audit",
  "/v1/usage",
  "/v1/billing"
] as const;

export type PublicRouteGroup = (typeof publicRouteGroups)[number];

export const organizationRoles = ["owner", "admin", "builder", "viewer", "billing_admin"] as const;
export const projectRoles = ["project_admin", "project_builder", "project_viewer"] as const;
export const resourcePhases = [
  "draft",
  "pending",
  "provisioning",
  "ready",
  "degraded",
  "failed",
  "deleting",
  "deleted"
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];
export type ProjectRole = (typeof projectRoles)[number];
export type ResourcePhase = (typeof resourcePhases)[number];

export const contractSchemaPaths = {
  componentManifest: "schemas/component-manifest.schema.yaml",
  eventEnvelope: "schemas/event-envelope.schema.yaml",
  resourceContract: "schemas/resource-contract.schema.yaml"
} as const;

export type ContractSchemaName = keyof typeof contractSchemaPaths;

export interface ApiMeta {
  requestId: string;
  cursor: string | null;
}

export interface ApiSuccessEnvelope<TData> {
  data: TData;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: SourceplaneErrorCode;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

export interface ServiceStatus {
  name: string;
  status: "ok" | "pending";
}
