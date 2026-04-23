import { z } from "zod";

import { assertWithSchema, isWithSchema } from "../internal/validation.js";

const nullableIdentifierSchema = z.string().min(1).nullable();

export const actorTypes = ["user", "service_principal", "workflow", "system"] as const;
export const scopeKinds = ["organization", "project", "environment", "resource"] as const;
export const organizationRoles = ["owner", "admin", "builder", "viewer", "billing_admin"] as const;
export const projectRoles = ["project_admin", "project_builder", "project_viewer"] as const;
export const roleNames = [
  "owner",
  "admin",
  "builder",
  "viewer",
  "billing_admin",
  "project_admin",
  "project_builder",
  "project_viewer"
] as const;

export type ActorType = (typeof actorTypes)[number];
export type ScopeKind = (typeof scopeKinds)[number];
export type OrganizationRole = (typeof organizationRoles)[number];
export type ProjectRole = (typeof projectRoles)[number];
export type RoleName = (typeof roleNames)[number];

export const actorTypeSchema = z.enum(actorTypes);
export const scopeKindSchema = z.enum(scopeKinds);
export const organizationRoleSchema = z.enum(organizationRoles);
export const projectRoleSchema = z.enum(projectRoles);
export const roleNameSchema = z.enum(roleNames);
export const rbacActorSchema = z
  .object({
    type: actorTypeSchema,
    id: z.string().min(1)
  })
  .strict();
export const organizationScopeSchema = z
  .object({
    kind: z.literal("organization"),
    orgId: z.string().min(1)
  })
  .strict();
export const projectScopeSchema = z
  .object({
    kind: z.literal("project"),
    orgId: z.string().min(1),
    projectId: z.string().min(1)
  })
  .strict();
export const environmentScopeSchema = z
  .object({
    kind: z.literal("environment"),
    orgId: z.string().min(1),
    projectId: z.string().min(1),
    environmentId: z.string().min(1)
  })
  .strict();
export const resourceScopeSchema = z
  .object({
    kind: z.literal("resource"),
    orgId: z.string().min(1),
    projectId: z.string().min(1),
    environmentId: z.string().min(1),
    resourceId: z.string().min(1)
  })
  .strict();
export const tenantScopeSchema = z.union([
  organizationScopeSchema,
  projectScopeSchema,
  environmentScopeSchema,
  resourceScopeSchema
]);
export const rbacResourceSchema = z
  .object({
    kind: scopeKindSchema,
    id: z.string().min(1),
    orgId: z.string().min(1),
    projectId: nullableIdentifierSchema.optional(),
    environmentId: nullableIdentifierSchema.optional()
  })
  .strict();
export const authorizationMembershipFactSchema = z.record(z.string(), z.unknown());
export const authorizationContextSchema = z
  .object({
    memberships: z.array(authorizationMembershipFactSchema),
    attributes: z.record(z.string(), z.unknown())
  })
  .strict();
export const authorizationRequestSchema = z
  .object({
    subject: rbacActorSchema,
    action: z.string().min(1),
    resource: rbacResourceSchema,
    context: authorizationContextSchema
  })
  .strict();
export const resolvedTenantScopeSchema = z
  .object({
    orgId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    environmentId: z.string().min(1).optional(),
    resourceId: z.string().min(1).optional()
  })
  .strict();
export const authorizationResponseSchema = z
  .object({
    allow: z.boolean(),
    reason: z.string().min(1),
    policyVersion: z.number().int().min(1),
    derivedScope: resolvedTenantScopeSchema.optional()
  })
  .strict();

export type RbacActor = z.infer<typeof rbacActorSchema>;
export type OrganizationScope = z.infer<typeof organizationScopeSchema>;
export type ProjectScope = z.infer<typeof projectScopeSchema>;
export type EnvironmentScope = z.infer<typeof environmentScopeSchema>;
export type ResourceScope = z.infer<typeof resourceScopeSchema>;
export type TenantScope = z.infer<typeof tenantScopeSchema>;
export type AuthorizationResource = z.infer<typeof rbacResourceSchema>;
export type AuthorizationMembershipFact = z.infer<typeof authorizationMembershipFactSchema>;
export type AuthorizationContext = z.infer<typeof authorizationContextSchema>;
export type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;
export type ResolvedTenantScope = z.infer<typeof resolvedTenantScopeSchema>;
export type AuthorizationResponse = z.infer<typeof authorizationResponseSchema>;

export function assertValidAuthorizationRequest(value: unknown): AuthorizationRequest {
  return assertWithSchema("AuthorizationRequest", authorizationRequestSchema, value);
}

export function assertValidAuthorizationResponse(value: unknown): AuthorizationResponse {
  return assertWithSchema("AuthorizationResponse", authorizationResponseSchema, value);
}

export function isActorType(value: string): value is ActorType {
  return actorTypes.includes(value as ActorType);
}

export function isOrganizationRole(value: string): value is OrganizationRole {
  return organizationRoles.includes(value as OrganizationRole);
}

export function isProjectRole(value: string): value is ProjectRole {
  return projectRoles.includes(value as ProjectRole);
}

export function isRoleName(value: string): value is RoleName {
  return roleNames.includes(value as RoleName);
}

export function isAuthorizationRequest(value: unknown): value is AuthorizationRequest {
  return isWithSchema(authorizationRequestSchema, value);
}

export function isAuthorizationResponse(value: unknown): value is AuthorizationResponse {
  return isWithSchema(authorizationResponseSchema, value);
}