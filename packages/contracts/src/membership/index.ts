import { z } from "zod";

import {
  authorizationMembershipFactSchema,
  organizationRoleSchema,
  rbacActorSchema,
  rbacResourceSchema
} from "../auth/index.js";
import { assertWithSchema, isWithSchema } from "../internal/validation.js";

const emailAddressSchema = z.string().email().max(320);
const identifierSchema = z.string().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });
const slugSchema = z.string().trim().min(2).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const organizationInviteStatuses = ["pending", "accepted", "revoked", "expired"] as const;

export type OrganizationInviteStatus = (typeof organizationInviteStatuses)[number];

export const organizationInviteStatusSchema = z.enum(organizationInviteStatuses);
export const organizationSchema = z
  .object({
    createdAt: isoDatetimeSchema,
    id: identifierSchema,
    name: z.string().trim().min(1).max(120),
    slug: slugSchema,
    updatedAt: isoDatetimeSchema
  })
  .strict();
export const organizationListItemSchema = organizationSchema
  .extend({
    joinedAt: isoDatetimeSchema,
    memberId: identifierSchema,
    role: organizationRoleSchema
  })
  .strict();
export const organizationMemberSchema = z
  .object({
    createdAt: isoDatetimeSchema,
    id: identifierSchema,
    organizationId: identifierSchema,
    role: organizationRoleSchema,
    updatedAt: isoDatetimeSchema,
    userId: identifierSchema
  })
  .strict();
export const organizationInviteSchema = z
  .object({
    acceptedAt: isoDatetimeSchema.nullable(),
    createdAt: isoDatetimeSchema,
    email: emailAddressSchema,
    expiresAt: isoDatetimeSchema,
    id: identifierSchema,
    organizationId: identifierSchema,
    revokedAt: isoDatetimeSchema.nullable(),
    role: organizationRoleSchema,
    status: organizationInviteStatusSchema
  })
  .strict();
export const organizationInviteDeliverySchema = z.discriminatedUnion("mode", [
  z
    .object({
      acceptToken: z.string().min(1),
      mode: z.literal("local_debug")
    })
    .strict(),
  z
    .object({
      emailHint: z.string().min(1),
      mode: z.literal("email")
    })
    .strict()
]);
export const createOrganizationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema.optional()
  })
  .strict();
export const createOrganizationResponseSchema = z
  .object({
    membership: organizationMemberSchema,
    organization: organizationSchema
  })
  .strict();
export const listOrganizationsResponseSchema = z
  .object({
    organizations: z.array(organizationListItemSchema)
  })
  .strict();
export const getOrganizationResponseSchema = z
  .object({
    organization: organizationSchema
  })
  .strict();
export const updateOrganizationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional()
  })
  .strict()
  .refine((value) => value.name !== undefined || value.slug !== undefined, {
    message: "At least one updatable field must be provided.",
    path: ["name"]
  });
export const updateOrganizationResponseSchema = getOrganizationResponseSchema;
export const listOrganizationMembersResponseSchema = z
  .object({
    members: z.array(organizationMemberSchema)
  })
  .strict();
export const createOrganizationInviteRequestSchema = z
  .object({
    email: emailAddressSchema,
    expiresAt: isoDatetimeSchema.nullable().optional(),
    role: organizationRoleSchema
  })
  .strict();
export const createOrganizationInviteResponseSchema = z
  .object({
    delivery: organizationInviteDeliverySchema,
    invite: organizationInviteSchema
  })
  .strict();
export const acceptOrganizationInviteRequestSchema = z
  .object({
    token: z.string().min(1)
  })
  .strict();
export const acceptOrganizationInviteResponseSchema = z
  .object({
    invite: organizationInviteSchema,
    membership: organizationMemberSchema,
    organization: organizationSchema
  })
  .strict();
export const updateOrganizationMemberRequestSchema = z
  .object({
    role: organizationRoleSchema
  })
  .strict();
export const updateOrganizationMemberResponseSchema = z
  .object({
    membership: organizationMemberSchema
  })
  .strict();
export const removeOrganizationMemberResponseSchema = z
  .object({
    memberId: identifierSchema,
    removed: z.literal(true)
  })
  .strict();
export const authorizationMembershipResolveRequestSchema = z
  .object({
    resource: rbacResourceSchema,
    subject: rbacActorSchema
  })
  .strict();
export const authorizationMembershipResolveResponseSchema = z
  .object({
    memberships: z.array(authorizationMembershipFactSchema)
  })
  .strict();

export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationListItem = z.infer<typeof organizationListItemSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationInvite = z.infer<typeof organizationInviteSchema>;
export type OrganizationInviteDelivery = z.infer<typeof organizationInviteDeliverySchema>;
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;
export type CreateOrganizationResponse = z.infer<typeof createOrganizationResponseSchema>;
export type ListOrganizationsResponse = z.infer<typeof listOrganizationsResponseSchema>;
export type GetOrganizationResponse = z.infer<typeof getOrganizationResponseSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type UpdateOrganizationResponse = z.infer<typeof updateOrganizationResponseSchema>;
export type ListOrganizationMembersResponse = z.infer<typeof listOrganizationMembersResponseSchema>;
export type CreateOrganizationInviteRequest = z.infer<typeof createOrganizationInviteRequestSchema>;
export type CreateOrganizationInviteResponse = z.infer<typeof createOrganizationInviteResponseSchema>;
export type AcceptOrganizationInviteRequest = z.infer<typeof acceptOrganizationInviteRequestSchema>;
export type AcceptOrganizationInviteResponse = z.infer<typeof acceptOrganizationInviteResponseSchema>;
export type UpdateOrganizationMemberRequest = z.infer<typeof updateOrganizationMemberRequestSchema>;
export type UpdateOrganizationMemberResponse = z.infer<typeof updateOrganizationMemberResponseSchema>;
export type RemoveOrganizationMemberResponse = z.infer<typeof removeOrganizationMemberResponseSchema>;
export type AuthorizationMembershipResolveRequest = z.infer<typeof authorizationMembershipResolveRequestSchema>;
export type AuthorizationMembershipResolveResponse = z.infer<typeof authorizationMembershipResolveResponseSchema>;

export function assertValidAuthorizationMembershipResolveResponse(
  value: unknown
): AuthorizationMembershipResolveResponse {
  return assertWithSchema("AuthorizationMembershipResolveResponse", authorizationMembershipResolveResponseSchema, value);
}

export function isAuthorizationMembershipResolveResponse(
  value: unknown
): value is AuthorizationMembershipResolveResponse {
  return isWithSchema(authorizationMembershipResolveResponseSchema, value);
}
