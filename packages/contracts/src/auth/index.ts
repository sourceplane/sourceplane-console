import { z } from "zod";

import { assertWithSchema, isWithSchema } from "../internal/validation.js";

const nullableIdentifierSchema = z.string().min(1).nullable();
const emailAddressSchema = z.string().email().max(320);
const isoDatetimeSchema = z.string().datetime({ offset: true });
const userActorSchema = z
  .object({
    type: z.literal("user"),
    id: z.string().min(1)
  })
  .strict();
const servicePrincipalActorSchema = z
  .object({
    type: z.literal("service_principal"),
    id: z.string().min(1)
  })
  .strict();

export const actorTypes = ["user", "service_principal", "workflow", "system"] as const;
export const identityCredentialKinds = ["session", "api_key"] as const;
export const authDeliveryModes = ["email", "local_debug"] as const;
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
export type IdentityCredentialKind = (typeof identityCredentialKinds)[number];
export type AuthDeliveryMode = (typeof authDeliveryModes)[number];
export type ScopeKind = (typeof scopeKinds)[number];
export type OrganizationRole = (typeof organizationRoles)[number];
export type ProjectRole = (typeof projectRoles)[number];
export type RoleName = (typeof roleNames)[number];

export const actorTypeSchema = z.enum(actorTypes);
export const identityCredentialKindSchema = z.enum(identityCredentialKinds);
export const authDeliveryModeSchema = z.enum(authDeliveryModes);
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
export const authorizationRoleAssignmentScopeSchema = z.union([
  organizationScopeSchema,
  projectScopeSchema,
  environmentScopeSchema,
  resourceScopeSchema
]);
export const authorizationRoleAssignmentMembershipFactSchema = z
  .object({
    kind: z.literal("role_assignment"),
    role: roleNameSchema,
    scope: authorizationRoleAssignmentScopeSchema
  })
  .strict();
export const authorizationMembershipFactSchema = z.union([
  authorizationRoleAssignmentMembershipFactSchema,
  z.record(z.string(), z.unknown())
]);
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
export const identityResolveRequestSchema = z
  .object({
    token: z.string().min(1)
  })
  .strict();
export const identityResolveResultSchema = z
  .object({
    actor: rbacActorSchema.nullable(),
    organizationId: nullableIdentifierSchema.optional(),
    sessionId: nullableIdentifierSchema.optional()
  })
  .strict();
export const loginStartRequestSchema = z
  .object({
    email: emailAddressSchema
  })
  .strict();
export const loginDeliverySchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("email"),
      emailHint: z.string().min(1)
    })
    .strict(),
  z
    .object({
      code: z.string().min(1),
      emailHint: z.string().min(1),
      mode: z.literal("local_debug")
    })
    .strict()
]);
export const loginStartResponseSchema = z
  .object({
    challengeId: z.string().min(1),
    delivery: loginDeliverySchema,
    expiresAt: isoDatetimeSchema
  })
  .strict();
export const loginCompleteRequestSchema = z
  .object({
    challengeId: z.string().min(1),
    code: z.string().trim().min(6).max(12)
  })
  .strict();
export const identityUserSchema = z
  .object({
    createdAt: isoDatetimeSchema,
    id: z.string().min(1),
    primaryEmail: emailAddressSchema
  })
  .strict();
export const issuedSessionSchema = z
  .object({
    actor: userActorSchema,
    expiresAt: isoDatetimeSchema,
    id: z.string().min(1),
    organizationId: nullableIdentifierSchema,
    token: z.string().min(1),
    tokenType: z.literal("bearer")
  })
  .strict();
export const sessionViewSchema = z
  .object({
    actor: userActorSchema,
    expiresAt: isoDatetimeSchema,
    id: z.string().min(1),
    organizationId: nullableIdentifierSchema
  })
  .strict();
export const loginCompleteResponseSchema = z
  .object({
    session: issuedSessionSchema,
    user: identityUserSchema
  })
  .strict();
export const resolveSessionResponseSchema = z
  .object({
    authenticated: z.boolean(),
    session: sessionViewSchema.nullable(),
    user: identityUserSchema.nullable()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.authenticated && (!value.session || !value.user)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Authenticated session responses must include session and user details.",
        path: ["session"]
      });
    }

    if (!value.authenticated && (value.session !== null || value.user !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unauthenticated session responses must not include session or user details.",
        path: ["authenticated"]
      });
    }
  });
export const servicePrincipalViewSchema = z
  .object({
    id: z.string().min(1),
    organizationId: z.string().min(1),
    roleNames: z.array(roleNameSchema).min(1)
  })
  .strict();
export const apiKeyViewSchema = z
  .object({
    createdAt: isoDatetimeSchema,
    expiresAt: isoDatetimeSchema.nullable(),
    id: z.string().min(1),
    label: z.string().min(1).max(120),
    lastUsedAt: isoDatetimeSchema.nullable(),
    prefix: z.string().min(1),
    revokedAt: isoDatetimeSchema.nullable(),
    servicePrincipal: servicePrincipalViewSchema
  })
  .strict();
export const listApiKeysResponseSchema = z
  .object({
    apiKeys: z.array(apiKeyViewSchema)
  })
  .strict();
export const createApiKeyRequestSchema = z
  .object({
    expiresAt: isoDatetimeSchema.nullable().optional(),
    label: z.string().min(1).max(120),
    organizationId: z.string().min(1),
    roleNames: z.array(roleNameSchema).min(1)
  })
  .strict();
export const createApiKeyResponseSchema = z
  .object({
    apiKey: apiKeyViewSchema,
    token: z.string().min(1)
  })
  .strict();
export const revokeApiKeyResponseSchema = z
  .object({
    apiKeyId: z.string().min(1),
    revoked: z.literal(true)
  })
  .strict();
export const logoutResponseSchema = z
  .object({
    revoked: z.literal(true),
    sessionId: z.string().min(1)
  })
  .strict();
export const credentialActorSchema = z.union([userActorSchema, servicePrincipalActorSchema]);

export type RbacActor = z.infer<typeof rbacActorSchema>;
export type IdentityResolveRequest = z.infer<typeof identityResolveRequestSchema>;
export type IdentityResolveResult = z.infer<typeof identityResolveResultSchema>;
export type LoginStartRequest = z.infer<typeof loginStartRequestSchema>;
export type LoginDelivery = z.infer<typeof loginDeliverySchema>;
export type LoginStartResponse = z.infer<typeof loginStartResponseSchema>;
export type LoginCompleteRequest = z.infer<typeof loginCompleteRequestSchema>;
export type IdentityUser = z.infer<typeof identityUserSchema>;
export type IssuedSession = z.infer<typeof issuedSessionSchema>;
export type SessionView = z.infer<typeof sessionViewSchema>;
export type LoginCompleteResponse = z.infer<typeof loginCompleteResponseSchema>;
export type ResolveSessionResponse = z.infer<typeof resolveSessionResponseSchema>;
export type ServicePrincipalView = z.infer<typeof servicePrincipalViewSchema>;
export type ApiKeyView = z.infer<typeof apiKeyViewSchema>;
export type ListApiKeysResponse = z.infer<typeof listApiKeysResponseSchema>;
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
export type RevokeApiKeyResponse = z.infer<typeof revokeApiKeyResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type CredentialActor = z.infer<typeof credentialActorSchema>;
export type OrganizationScope = z.infer<typeof organizationScopeSchema>;
export type ProjectScope = z.infer<typeof projectScopeSchema>;
export type EnvironmentScope = z.infer<typeof environmentScopeSchema>;
export type ResourceScope = z.infer<typeof resourceScopeSchema>;
export type TenantScope = z.infer<typeof tenantScopeSchema>;
export type AuthorizationResource = z.infer<typeof rbacResourceSchema>;
export type AuthorizationRoleAssignmentScope = z.infer<typeof authorizationRoleAssignmentScopeSchema>;
export type AuthorizationRoleAssignmentMembershipFact = z.infer<typeof authorizationRoleAssignmentMembershipFactSchema>;
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

export function assertValidIdentityResolveResult(value: unknown): IdentityResolveResult {
  return assertWithSchema("IdentityResolveResult", identityResolveResultSchema, value);
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

export function isAuthorizationRoleAssignmentMembershipFact(
  value: unknown
): value is AuthorizationRoleAssignmentMembershipFact {
  return isWithSchema(authorizationRoleAssignmentMembershipFactSchema, value);
}

export function isIdentityResolveResult(value: unknown): value is IdentityResolveResult {
  return isWithSchema(identityResolveResultSchema, value);
}