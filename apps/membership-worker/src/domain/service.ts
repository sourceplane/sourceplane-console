import {
  roleNames,
  type AcceptOrganizationInviteResponse,
  type AuthorizationMembershipResolveRequest,
  type AuthorizationMembershipResolveResponse,
  type CreateOrganizationInviteResponse,
  type CreateOrganizationResponse,
  type GetOrganizationResponse,
  type ListOrganizationMembersResponse,
  type ListOrganizationsResponse,
  type OrganizationInvite,
  type OrganizationInviteDelivery,
  type OrganizationRole,
  type RemoveOrganizationMemberResponse,
  type RbacActor,
  type UpdateOrganizationMemberResponse,
  type UpdateOrganizationResponse
} from "@sourceplane/contracts";
import { SourceplaneHttpError } from "@sourceplane/shared";

import type { IdentityDirectory } from "../clients/identity.js";
import { MembershipCrypto } from "./crypto.js";
import { createMembershipEvent } from "./events.js";
import type {
  InviteRecord,
  MembershipRecord,
  MembershipRepository,
  OrganizationRecord,
  RoleAssignmentFactRecord,
  RoleAssignmentRecord
} from "./repository.js";
import { isOrganizationSlug, normalizeOrganizationSlug, slugifyOrganizationName } from "./slug.js";

const defaultInviteLifetimeDays = 7;
const roleOrder = new Map<string, number>(roleNames.map((roleName, index) => [roleName, index]));

type UserActor = RbacActor & { type: "user" };

export interface RequestMetadata {
  idempotencyKey: string | null;
  ipAddress: string | null;
  requestId: string;
  sessionId: string | null;
  traceparent: string | null;
}

export interface CreateOrganizationInput extends RequestMetadata {
  actor: UserActor;
  name: string;
  slug?: string;
}

export interface ListOrganizationsInput {
  actor: UserActor;
}

export interface GetOrganizationInput {
  organizationId: string;
}

export interface UpdateOrganizationInput extends RequestMetadata {
  actor: UserActor;
  name?: string;
  organizationId: string;
  slug?: string;
}

export interface ListMembersInput {
  organizationId: string;
}

export interface InviteMemberInput extends RequestMetadata {
  actor: UserActor;
  email: string;
  expiresAt?: string | null;
  organizationId: string;
  role: OrganizationRole;
}

export interface AcceptInviteInput extends RequestMetadata {
  actor: UserActor;
  inviteId: string;
  token: string;
}

export interface UpdateMemberRoleInput extends RequestMetadata {
  actor: UserActor;
  memberId: string;
  organizationId: string;
  role: OrganizationRole;
}

export interface RemoveMemberInput extends RequestMetadata {
  actor: UserActor;
  memberId: string;
  organizationId: string;
}

export interface MembershipService {
  acceptInvite(input: AcceptInviteInput): Promise<AcceptOrganizationInviteResponse>;
  createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResponse>;
  getOrganization(input: GetOrganizationInput): Promise<GetOrganizationResponse>;
  inviteMember(input: InviteMemberInput): Promise<CreateOrganizationInviteResponse>;
  listMembers(input: ListMembersInput): Promise<ListOrganizationMembersResponse>;
  listOrganizationsForActor(input: ListOrganizationsInput): Promise<ListOrganizationsResponse>;
  removeMember(input: RemoveMemberInput): Promise<RemoveOrganizationMemberResponse>;
  resolveAuthorizationMemberships(input: AuthorizationMembershipResolveRequest): Promise<AuthorizationMembershipResolveResponse>;
  updateMemberRole(input: UpdateMemberRoleInput): Promise<UpdateOrganizationMemberResponse>;
  updateOrganization(input: UpdateOrganizationInput): Promise<UpdateOrganizationResponse>;
}

export interface MembershipServiceDependencies {
  identityDirectory: IdentityDirectory;
  now?: () => Date;
  repository: MembershipRepository;
  serviceName: string;
  tokenHashSecret: string;
}

export function createMembershipService(dependencies: MembershipServiceDependencies): MembershipService {
  const crypto = new MembershipCrypto(dependencies.tokenHashSecret);
  const now = dependencies.now ?? (() => new Date());

  return {
    async acceptInvite(input: AcceptInviteInput): Promise<AcceptOrganizationInviteResponse> {
      const timestamp = now().toISOString();
      const invite = await dependencies.repository.findInviteById(input.inviteId);

      if (!invite) {
        throw new SourceplaneHttpError(404, "not_found", "The requested invite was not found.", {
          inviteId: input.inviteId
        });
      }

      const inviteStatus = deriveInviteStatus(invite, timestamp);
      if (inviteStatus === "accepted") {
        throw new SourceplaneHttpError(409, "conflict", "This invite has already been accepted.", {
          inviteId: invite.id
        });
      }

      if (inviteStatus === "revoked") {
        throw new SourceplaneHttpError(412, "precondition_failed", "This invite has already been revoked.", {
          inviteId: invite.id
        });
      }

      if (inviteStatus === "expired") {
        throw new SourceplaneHttpError(412, "precondition_failed", "This invite has expired.", {
          inviteId: invite.id
        });
      }

      const parsedToken = crypto.parseInviteToken(input.token);
      if (!parsedToken || parsedToken.inviteId !== invite.id) {
        throw invalidInviteAcceptanceError(invite.id);
      }

      const secretMatches = await crypto.matchesInviteSecret(parsedToken.secret, invite.tokenHash);
      if (!secretMatches) {
        throw invalidInviteAcceptanceError(invite.id);
      }

      const acceptingUser = await dependencies.identityDirectory.getUserById(input.actor.id, {
        requestId: input.requestId,
        traceparent: input.traceparent
      });

      if (!acceptingUser) {
        throw new SourceplaneHttpError(401, "unauthenticated", "Authentication is required for this route.");
      }

      if (normalizeEmail(acceptingUser.primaryEmail) !== invite.normalizedEmail) {
        throw invalidInviteAcceptanceError(invite.id);
      }

      const organization = await getOrganizationOrThrow(dependencies.repository, invite.organizationId);
      const existingMembership = await dependencies.repository.findMembershipByUserId(invite.organizationId, input.actor.id);
      const membershipToCreate = existingMembership
        ? null
        : createOrganizationMembership({
            createdAt: timestamp,
            organizationId: invite.organizationId,
            role: invite.role,
            userId: input.actor.id
          });
      const roleAssignmentToCreate = membershipToCreate
        ? createOrganizationRoleAssignment({
            createdAt: timestamp,
            membershipId: membershipToCreate.id,
            organizationId: invite.organizationId,
            role: invite.role,
            userId: input.actor.id
          })
        : null;
      const events = [
        createMembershipEvent({
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
          ipAddress: input.ipAddress,
          occurredAt: timestamp,
          organizationId: invite.organizationId,
          payload: {
            inviteId: invite.id,
            membershipId: membershipToCreate?.id ?? existingMembership?.id ?? null,
            userId: input.actor.id
          },
          requestId: input.requestId,
          sessionId: input.sessionId,
          source: dependencies.serviceName,
          subject: {
            id: invite.id,
            kind: "organization_invite"
          },
          type: "invite.accepted"
        })
      ];

      if (membershipToCreate) {
        events.push(
          createMembershipEvent({
            actor: input.actor,
            idempotencyKey: input.idempotencyKey,
            ipAddress: input.ipAddress,
            occurredAt: timestamp,
            organizationId: invite.organizationId,
            payload: {
              memberId: membershipToCreate.id,
              organizationId: invite.organizationId,
              role: membershipToCreate.role,
              userId: membershipToCreate.userId
            },
            requestId: input.requestId,
            sessionId: input.sessionId,
            source: dependencies.serviceName,
            subject: {
              id: membershipToCreate.id,
              kind: "organization_membership"
            },
            type: "membership.added"
          })
        );
      }

      const acceptedInvite = await dependencies.repository.acceptInvite({
        acceptedAt: timestamp,
        acceptedByUserId: input.actor.id,
        events,
        inviteId: invite.id,
        membership: membershipToCreate,
        organizationId: invite.organizationId,
        roleAssignment: roleAssignmentToCreate
      });

      if (!acceptedInvite.invite || !acceptedInvite.membership) {
        throw new SourceplaneHttpError(409, "conflict", "The invite could not be accepted.", {
          inviteId: invite.id
        });
      }

      return {
        invite: mapInviteRecord(acceptedInvite.invite, timestamp),
        membership: mapMembershipRecord(acceptedInvite.membership),
        organization: mapOrganizationRecord(organization)
      };
    },

    async createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResponse> {
      const timestamp = now().toISOString();
      const slug = input.slug ? normalizeOrganizationSlug(input.slug) : slugifyOrganizationName(input.name);

      if (!isOrganizationSlug(slug)) {
        throw new SourceplaneHttpError(400, "validation_failed", "The organization slug is invalid.", {
          field: "slug"
        });
      }

      const existingOrganization = await dependencies.repository.findOrganizationBySlug(slug);
      if (existingOrganization) {
        throw new SourceplaneHttpError(409, "conflict", "An organization with that slug already exists.", {
          slug
        });
      }

      const organization: OrganizationRecord = {
        createdAt: timestamp,
        id: createId("org"),
        name: input.name,
        slug,
        updatedAt: timestamp
      };
      const membership = createOrganizationMembership({
        createdAt: timestamp,
        organizationId: organization.id,
        role: "owner",
        userId: input.actor.id
      });
      const roleAssignment = createOrganizationRoleAssignment({
        createdAt: timestamp,
        membershipId: membership.id,
        organizationId: organization.id,
        role: "owner",
        userId: input.actor.id
      });

      try {
        await dependencies.repository.createOrganizationWithOwner({
          events: [
            createMembershipEvent({
              actor: input.actor,
              idempotencyKey: input.idempotencyKey,
              ipAddress: input.ipAddress,
              occurredAt: timestamp,
              organizationId: organization.id,
              payload: {
                name: organization.name,
                organizationId: organization.id,
                slug: organization.slug
              },
              requestId: input.requestId,
              sessionId: input.sessionId,
              source: dependencies.serviceName,
              subject: {
                id: organization.id,
                kind: "organization",
                name: organization.name
              },
              type: "organization.created"
            }),
            createMembershipEvent({
              actor: input.actor,
              idempotencyKey: input.idempotencyKey,
              ipAddress: input.ipAddress,
              occurredAt: timestamp,
              organizationId: organization.id,
              payload: {
                memberId: membership.id,
                organizationId: organization.id,
                role: membership.role,
                userId: membership.userId
              },
              requestId: input.requestId,
              sessionId: input.sessionId,
              source: dependencies.serviceName,
              subject: {
                id: membership.id,
                kind: "organization_membership"
              },
              type: "membership.added"
            })
          ],
          membership,
          organization,
          roleAssignment
        });
      } catch (error) {
        if (isUniqueConstraintFor(error, "organizations.slug")) {
          throw new SourceplaneHttpError(409, "conflict", "An organization with that slug already exists.", {
            slug
          });
        }

        throw error;
      }

      return {
        membership: mapMembershipRecord(membership),
        organization: mapOrganizationRecord(organization)
      };
    },

    async getOrganization(input: GetOrganizationInput): Promise<GetOrganizationResponse> {
      const organization = await getOrganizationOrThrow(dependencies.repository, input.organizationId);

      return {
        organization: mapOrganizationRecord(organization)
      };
    },

    async inviteMember(input: InviteMemberInput): Promise<CreateOrganizationInviteResponse> {
      const timestamp = now().toISOString();
      await getOrganizationOrThrow(dependencies.repository, input.organizationId);
      const actorMembership = await requireActorMembership(dependencies.repository, input.organizationId, input.actor.id);

      ensureActorCanManageRole(actorMembership.role, input.role, null);

      const normalizedEmail = normalizeEmail(input.email);
      const expiresAt = input.expiresAt ?? addDays(now(), defaultInviteLifetimeDays).toISOString();

      if (isExpired(expiresAt, timestamp)) {
        throw new SourceplaneHttpError(400, "bad_request", "Invite expiry must be in the future.", {
          field: "expiresAt"
        });
      }

      await dependencies.repository.deactivateExpiredInvitesForEmail(input.organizationId, normalizedEmail, timestamp);

      const existingInvite = await dependencies.repository.findPendingInviteByEmail(input.organizationId, normalizedEmail);
      if (existingInvite) {
        throw new SourceplaneHttpError(409, "conflict", "An active invite already exists for that email address.", {
          email: normalizedEmail,
          organizationId: input.organizationId
        });
      }

      const inviteId = createId("inv");
      const issuedToken = await crypto.issueInviteToken(inviteId);
      const invite: InviteRecord = {
        acceptedAt: null,
        acceptedByUserId: null,
        createdAt: timestamp,
        createdByUserId: input.actor.id,
        email: input.email,
        expiresAt,
        id: inviteId,
        isActive: true,
        normalizedEmail,
        organizationId: input.organizationId,
        revokedAt: null,
        revokedByUserId: null,
        role: input.role,
        tokenHash: issuedToken.secretHash
      };

      try {
        await dependencies.repository.createInvite({
          currentTime: timestamp,
          event: createMembershipEvent({
            actor: input.actor,
            idempotencyKey: input.idempotencyKey,
            ipAddress: input.ipAddress,
            occurredAt: timestamp,
            organizationId: input.organizationId,
            payload: {
              email: invite.email,
              expiresAt: invite.expiresAt,
              inviteId: invite.id,
              organizationId: invite.organizationId,
              role: invite.role
            },
            requestId: input.requestId,
            sessionId: input.sessionId,
            source: dependencies.serviceName,
            subject: {
              id: invite.id,
              kind: "organization_invite"
            },
            type: "invite.created"
          }),
          invite
        });
      } catch (error) {
        if (isUniqueConstraintFor(error, "organization_invites.organization_id") || isUniqueConstraintFor(error, "idx_org_invites_active_email")) {
          throw new SourceplaneHttpError(409, "conflict", "An active invite already exists for that email address.", {
            email: normalizedEmail,
            organizationId: input.organizationId
          });
        }

        throw error;
      }

      return {
        delivery: createLocalDebugInviteDelivery(issuedToken.token),
        invite: mapInviteRecord(invite, timestamp)
      };
    },

    async listMembers(input: ListMembersInput): Promise<ListOrganizationMembersResponse> {
      await getOrganizationOrThrow(dependencies.repository, input.organizationId);
      const members = await dependencies.repository.listMembers(input.organizationId);

      return {
        members: members.map(mapMembershipRecord)
      };
    },

    async listOrganizationsForActor(input: ListOrganizationsInput): Promise<ListOrganizationsResponse> {
      const organizations = await dependencies.repository.listOrganizationsForUser(input.actor.id);

      return {
        organizations: organizations.map((organization) => ({
          createdAt: organization.createdAt,
          id: organization.id,
          joinedAt: organization.joinedAt,
          memberId: organization.memberId,
          name: organization.name,
          role: organization.role,
          slug: organization.slug,
          updatedAt: organization.updatedAt
        }))
      };
    },

    async removeMember(input: RemoveMemberInput): Promise<RemoveOrganizationMemberResponse> {
      await getOrganizationOrThrow(dependencies.repository, input.organizationId);
      const actorMembership = await requireActorMembership(dependencies.repository, input.organizationId, input.actor.id);
      const targetMembership = await getMembershipOrThrow(dependencies.repository, input.organizationId, input.memberId);
      const timestamp = now().toISOString();

      ensureActorCanManageRole(actorMembership.role, targetMembership.role, targetMembership.role);

      if (targetMembership.role === "owner") {
        const ownerCount = await dependencies.repository.countOwners(input.organizationId);

        if (ownerCount <= 1) {
          throw new SourceplaneHttpError(412, "precondition_failed", "The last organization owner cannot be removed.", {
            organizationId: input.organizationId
          });
        }
      }

      const removed = await dependencies.repository.removeMembership({
        event: createMembershipEvent({
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
          ipAddress: input.ipAddress,
          occurredAt: timestamp,
          organizationId: input.organizationId,
          payload: {
            memberId: targetMembership.id,
            organizationId: targetMembership.organizationId,
            role: targetMembership.role,
            userId: targetMembership.userId
          },
          requestId: input.requestId,
          sessionId: input.sessionId,
          source: dependencies.serviceName,
          subject: {
            id: targetMembership.id,
            kind: "organization_membership"
          },
          type: "membership.removed"
        }),
        memberId: input.memberId,
        organizationId: input.organizationId
      });

      if (!removed) {
        throw new SourceplaneHttpError(404, "not_found", "The requested member was not found.", {
          memberId: input.memberId,
          organizationId: input.organizationId
        });
      }

      return {
        memberId: input.memberId,
        removed: true
      };
    },

    async resolveAuthorizationMemberships(
      input: AuthorizationMembershipResolveRequest
    ): Promise<AuthorizationMembershipResolveResponse> {
      if (input.subject.type !== "user") {
        return {
          memberships: []
        };
      }

      const roleAssignments = await dependencies.repository.listRoleAssignmentsForUser(input.resource.orgId, input.subject.id);

      return {
        memberships: roleAssignments
          .slice()
          .sort(compareRoleAssignments)
          .map((roleAssignment) => ({
            kind: "role_assignment" as const,
            role: roleAssignment.role,
            scope: mapRoleAssignmentScope(roleAssignment)
          }))
      };
    },

    async updateMemberRole(input: UpdateMemberRoleInput): Promise<UpdateOrganizationMemberResponse> {
      await getOrganizationOrThrow(dependencies.repository, input.organizationId);
      const actorMembership = await requireActorMembership(dependencies.repository, input.organizationId, input.actor.id);
      const targetMembership = await getMembershipOrThrow(dependencies.repository, input.organizationId, input.memberId);

      ensureActorCanManageRole(actorMembership.role, input.role, targetMembership.role);

      if (targetMembership.role === input.role) {
        return {
          membership: mapMembershipRecord(targetMembership)
        };
      }

      if (targetMembership.role === "owner" && input.role !== "owner") {
        const ownerCount = await dependencies.repository.countOwners(input.organizationId);

        if (ownerCount <= 1) {
          throw new SourceplaneHttpError(412, "precondition_failed", "The last organization owner cannot be reassigned.", {
            organizationId: input.organizationId
          });
        }
      }

      const timestamp = now().toISOString();
      const updatedMembership = await dependencies.repository.updateMembershipRole({
        event: createMembershipEvent({
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
          ipAddress: input.ipAddress,
          occurredAt: timestamp,
          organizationId: input.organizationId,
          payload: {
            memberId: targetMembership.id,
            newRole: input.role,
            oldRole: targetMembership.role,
            organizationId: input.organizationId,
            userId: targetMembership.userId
          },
          requestId: input.requestId,
          sessionId: input.sessionId,
          source: dependencies.serviceName,
          subject: {
            id: targetMembership.id,
            kind: "organization_membership"
          },
          type: "membership.updated"
        }),
        memberId: input.memberId,
        organizationId: input.organizationId,
        role: input.role,
        updatedAt: timestamp
      });

      if (!updatedMembership) {
        throw new SourceplaneHttpError(404, "not_found", "The requested member was not found.", {
          memberId: input.memberId,
          organizationId: input.organizationId
        });
      }

      return {
        membership: mapMembershipRecord(updatedMembership)
      };
    },

    async updateOrganization(input: UpdateOrganizationInput): Promise<UpdateOrganizationResponse> {
      const existingOrganization = await getOrganizationOrThrow(dependencies.repository, input.organizationId);
      const slug = input.slug ? normalizeOrganizationSlug(input.slug) : existingOrganization.slug;
      const name = input.name ?? existingOrganization.name;

      if (!isOrganizationSlug(slug)) {
        throw new SourceplaneHttpError(400, "validation_failed", "The organization slug is invalid.", {
          field: "slug"
        });
      }

      const conflictingOrganization = await dependencies.repository.findOrganizationBySlug(slug);
      if (conflictingOrganization && conflictingOrganization.id !== input.organizationId) {
        throw new SourceplaneHttpError(409, "conflict", "An organization with that slug already exists.", {
          slug
        });
      }

      const timestamp = now().toISOString();
      let updatedOrganization: OrganizationRecord | null = null;

      try {
        updatedOrganization = await dependencies.repository.updateOrganization({
          event: createMembershipEvent({
            actor: input.actor,
            idempotencyKey: input.idempotencyKey,
            ipAddress: input.ipAddress,
            occurredAt: timestamp,
            organizationId: input.organizationId,
            payload: {
              name,
              organizationId: input.organizationId,
              slug
            },
            requestId: input.requestId,
            sessionId: input.sessionId,
            source: dependencies.serviceName,
            subject: {
              id: input.organizationId,
              kind: "organization",
              name
            },
            type: "organization.updated"
          }),
          name,
          organizationId: input.organizationId,
          slug,
          updatedAt: timestamp
        });
      } catch (error) {
        if (isUniqueConstraintFor(error, "organizations.slug")) {
          throw new SourceplaneHttpError(409, "conflict", "An organization with that slug already exists.", {
            slug
          });
        }

        throw error;
      }

      if (!updatedOrganization) {
        throw new SourceplaneHttpError(404, "not_found", "The requested organization was not found.", {
          organizationId: input.organizationId
        });
      }

      return {
        organization: mapOrganizationRecord(updatedOrganization)
      };
    }
  };
}

function compareRoleAssignments(left: RoleAssignmentFactRecord, right: RoleAssignmentFactRecord): number {
  const scopeRankDifference = scopeRank(left.scopeKind) - scopeRank(right.scopeKind);

  if (scopeRankDifference !== 0) {
    return scopeRankDifference;
  }

  const roleRankDifference = (roleOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER) - (roleOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER);

  if (roleRankDifference !== 0) {
    return roleRankDifference;
  }

  return left.organizationId.localeCompare(right.organizationId);
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function createLocalDebugInviteDelivery(token: string): OrganizationInviteDelivery {
  return {
    acceptToken: token,
    mode: "local_debug"
  };
}

function createOrganizationMembership(input: {
  createdAt: string;
  organizationId: string;
  role: OrganizationRole;
  userId: string;
}): MembershipRecord {
  return {
    createdAt: input.createdAt,
    id: createId("mbr"),
    organizationId: input.organizationId,
    role: input.role,
    updatedAt: input.createdAt,
    userId: input.userId
  };
}

function createOrganizationRoleAssignment(input: {
  createdAt: string;
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  userId: string;
}): RoleAssignmentRecord {
  return {
    createdAt: input.createdAt,
    environmentId: null,
    id: createId("ras"),
    membershipId: input.membershipId,
    organizationId: input.organizationId,
    projectId: null,
    resourceId: null,
    role: input.role,
    scopeKey: createOrganizationScopeKey(input.organizationId),
    scopeKind: "organization",
    updatedAt: input.createdAt,
    userId: input.userId
  };
}

function createOrganizationScopeKey(organizationId: string): string {
  return `organization:${organizationId}`;
}

function deriveInviteStatus(invite: InviteRecord, currentTime: string): OrganizationInvite["status"] {
  if (invite.acceptedAt) {
    return "accepted";
  }

  if (invite.revokedAt) {
    return "revoked";
  }

  if (isExpired(invite.expiresAt, currentTime)) {
    return "expired";
  }

  return "pending";
}

function ensureActorCanManageRole(
  actorRole: OrganizationRole,
  requestedRole: OrganizationRole,
  targetRole: OrganizationRole | null
): void {
  if (actorRole !== "owner" && actorRole !== "admin") {
    throw new SourceplaneHttpError(403, "forbidden", "The authenticated actor cannot manage organization members.");
  }

  if (requestedRole === "owner" && actorRole !== "owner") {
    throw new SourceplaneHttpError(403, "forbidden", "Only organization owners can assign the owner role.");
  }

  if (targetRole === "owner" && actorRole !== "owner") {
    throw new SourceplaneHttpError(403, "forbidden", "Only organization owners can modify existing owners.");
  }
}

async function getMembershipOrThrow(
  repository: MembershipRepository,
  organizationId: string,
  memberId: string
): Promise<MembershipRecord> {
  const membership = await repository.findMembershipById(organizationId, memberId);

  if (!membership) {
    throw new SourceplaneHttpError(404, "not_found", "The requested member was not found.", {
      memberId,
      organizationId
    });
  }

  return membership;
}

async function getOrganizationOrThrow(repository: MembershipRepository, organizationId: string): Promise<OrganizationRecord> {
  const organization = await repository.findOrganizationById(organizationId);

  if (!organization) {
    throw new SourceplaneHttpError(404, "not_found", "The requested organization was not found.", {
      organizationId
    });
  }

  return organization;
}

function invalidInviteAcceptanceError(inviteId: string): SourceplaneHttpError {
  return new SourceplaneHttpError(403, "forbidden", "The invite could not be accepted.", {
    inviteId
  });
}

function isExpired(expiresAt: string, currentTime: string): boolean {
  return Date.parse(expiresAt) <= Date.parse(currentTime);
}

function isUniqueConstraintFor(error: unknown, fragment: string): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed") && error.message.includes(fragment);
}

function mapInviteRecord(invite: InviteRecord, currentTime: string): OrganizationInvite {
  return {
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
    email: invite.email,
    expiresAt: invite.expiresAt,
    id: invite.id,
    organizationId: invite.organizationId,
    revokedAt: invite.revokedAt,
    role: invite.role,
    status: deriveInviteStatus(invite, currentTime)
  };
}

function mapMembershipRecord(membership: MembershipRecord) {
  return {
    createdAt: membership.createdAt,
    id: membership.id,
    organizationId: membership.organizationId,
    role: membership.role,
    updatedAt: membership.updatedAt,
    userId: membership.userId
  };
}

function mapOrganizationRecord(organization: OrganizationRecord) {
  return {
    createdAt: organization.createdAt,
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    updatedAt: organization.updatedAt
  };
}

function mapRoleAssignmentScope(roleAssignment: RoleAssignmentFactRecord) {
  switch (roleAssignment.scopeKind) {
    case "organization":
      return {
        kind: "organization" as const,
        orgId: roleAssignment.organizationId
      };
    case "project":
      return {
        kind: "project" as const,
        orgId: roleAssignment.organizationId,
        projectId: requireScopeValue(roleAssignment.projectId, "projectId", roleAssignment.scopeKind)
      };
    case "environment":
      return {
        kind: "environment" as const,
        environmentId: requireScopeValue(roleAssignment.environmentId, "environmentId", roleAssignment.scopeKind),
        orgId: roleAssignment.organizationId,
        projectId: requireScopeValue(roleAssignment.projectId, "projectId", roleAssignment.scopeKind)
      };
    case "resource":
      return {
        kind: "resource" as const,
        environmentId: requireScopeValue(roleAssignment.environmentId, "environmentId", roleAssignment.scopeKind),
        orgId: roleAssignment.organizationId,
        projectId: requireScopeValue(roleAssignment.projectId, "projectId", roleAssignment.scopeKind),
        resourceId: requireScopeValue(roleAssignment.resourceId, "resourceId", roleAssignment.scopeKind)
      };
  }

  throw new Error(`Unsupported scope kind: ${String(roleAssignment.scopeKind)}`);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function requireActorMembership(
  repository: MembershipRepository,
  organizationId: string,
  actorId: string
): Promise<MembershipRecord> {
  const membership = await repository.findMembershipByUserId(organizationId, actorId);

  if (!membership) {
    throw new SourceplaneHttpError(403, "forbidden", "The authenticated actor is not a member of this organization.", {
      organizationId
    });
  }

  return membership;
}

function scopeRank(scopeKind: RoleAssignmentFactRecord["scopeKind"]): number {
  switch (scopeKind) {
    case "organization":
      return 1;
    case "project":
      return 2;
    case "environment":
      return 3;
    case "resource":
      return 4;
  }
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function requireScopeValue(value: string | null, fieldName: string, scopeKind: RoleAssignmentFactRecord["scopeKind"]): string {
  if (!value) {
    throw new Error(`Missing ${fieldName} for ${scopeKind} scope role assignment.`);
  }

  return value;
}
