import type { OrganizationRole, RoleName, ScopeKind, SourceplaneEventEnvelope } from "@sourceplane/contracts";

export interface OrganizationRecord {
  createdAt: string;
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
}

export interface OrganizationListItemRecord extends OrganizationRecord {
  joinedAt: string;
  memberId: string;
  role: OrganizationRole;
}

export interface MembershipRecord {
  createdAt: string;
  id: string;
  organizationId: string;
  role: OrganizationRole;
  updatedAt: string;
  userId: string;
}

export interface InviteRecord {
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  createdAt: string;
  createdByUserId: string;
  email: string;
  expiresAt: string;
  id: string;
  isActive: boolean;
  normalizedEmail: string;
  organizationId: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  role: OrganizationRole;
  tokenHash: string;
}

export interface RoleAssignmentRecord {
  createdAt: string;
  environmentId: string | null;
  id: string;
  membershipId: string;
  organizationId: string;
  projectId: string | null;
  resourceId: string | null;
  role: RoleName;
  scopeKey: string;
  scopeKind: ScopeKind;
  updatedAt: string;
  userId: string;
}

export interface RoleAssignmentFactRecord {
  environmentId: string | null;
  organizationId: string;
  projectId: string | null;
  resourceId: string | null;
  role: RoleName;
  scopeKind: ScopeKind;
}

export interface CreateOrganizationWithOwnerInput {
  events: readonly SourceplaneEventEnvelope[];
  membership: MembershipRecord;
  organization: OrganizationRecord;
  roleAssignment: RoleAssignmentRecord;
}

export interface CreateInviteInput {
  currentTime: string;
  event: SourceplaneEventEnvelope;
  invite: InviteRecord;
}

export interface AcceptInviteInput {
  acceptedAt: string;
  acceptedByUserId: string;
  events: readonly SourceplaneEventEnvelope[];
  inviteId: string;
  membership: MembershipRecord | null;
  organizationId: string;
  roleAssignment: RoleAssignmentRecord | null;
}

export interface UpdateOrganizationInput {
  event: SourceplaneEventEnvelope;
  name: string;
  organizationId: string;
  slug: string;
  updatedAt: string;
}

export interface UpdateMembershipRoleInput {
  event: SourceplaneEventEnvelope;
  memberId: string;
  organizationId: string;
  role: OrganizationRole;
  updatedAt: string;
}

export interface RemoveMembershipInput {
  event: SourceplaneEventEnvelope;
  memberId: string;
  organizationId: string;
}

export interface MembershipRepository {
  acceptInvite(input: AcceptInviteInput): Promise<{ invite: InviteRecord | null; membership: MembershipRecord | null }>;
  countOwners(organizationId: string): Promise<number>;
  createInvite(input: CreateInviteInput): Promise<void>;
  createOrganizationWithOwner(input: CreateOrganizationWithOwnerInput): Promise<void>;
  deactivateExpiredInvitesForEmail(organizationId: string, normalizedEmail: string, currentTime: string): Promise<void>;
  findInviteById(inviteId: string): Promise<InviteRecord | null>;
  findMembershipById(organizationId: string, memberId: string): Promise<MembershipRecord | null>;
  findMembershipByUserId(organizationId: string, userId: string): Promise<MembershipRecord | null>;
  findOrganizationById(organizationId: string): Promise<OrganizationRecord | null>;
  findOrganizationBySlug(slug: string): Promise<OrganizationRecord | null>;
  findPendingInviteByEmail(organizationId: string, normalizedEmail: string): Promise<InviteRecord | null>;
  listMembers(organizationId: string): Promise<MembershipRecord[]>;
  listOrganizationsForUser(userId: string): Promise<OrganizationListItemRecord[]>;
  listRoleAssignmentsForUser(organizationId: string, userId: string): Promise<RoleAssignmentFactRecord[]>;
  removeMembership(input: RemoveMembershipInput): Promise<boolean>;
  updateMembershipRole(input: UpdateMembershipRoleInput): Promise<MembershipRecord | null>;
  updateOrganization(input: UpdateOrganizationInput): Promise<OrganizationRecord | null>;
}
