import {
  organizationRoleSchema,
  roleNameSchema,
  scopeKindSchema,
  type SourceplaneEventEnvelope
} from "@sourceplane/contracts";

import type {
  AcceptInviteInput,
  CreateInviteInput,
  CreateOrganizationWithOwnerInput,
  InviteRecord,
  MembershipRecord,
  MembershipRepository,
  OrganizationListItemRecord,
  OrganizationRecord,
  RemoveMembershipInput,
  RoleAssignmentFactRecord,
  UpdateMembershipRoleInput,
  UpdateOrganizationInput
} from "./repository.js";

interface OrganizationRow {
  created_at: string;
  id: string;
  name: string;
  slug: string;
  updated_at: string;
}

interface OrganizationListItemRow extends OrganizationRow {
  joined_at: string;
  member_id: string;
  role_name: string;
}

interface MembershipRow {
  created_at: string;
  id: string;
  organization_id: string;
  role_name: string;
  updated_at: string;
  user_id: string;
}

interface InviteRow {
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  created_at: string;
  created_by_user_id: string;
  email: string;
  expires_at: string;
  id: string;
  is_active: number;
  normalized_email: string;
  organization_id: string;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  role_name: string;
  token_hash: string;
}

interface RoleAssignmentFactRow {
  environment_id: string | null;
  organization_id: string;
  project_id: string | null;
  resource_id: string | null;
  role_name: string;
  scope_kind: string;
}

export class D1MembershipRepository implements MembershipRepository {
  constructor(private readonly database: D1Database) {}

  async acceptInvite(input: AcceptInviteInput): Promise<{ invite: InviteRecord | null; membership: MembershipRecord | null }> {
    const statements = [
      this.database
        .prepare(
          `UPDATE organization_invites
           SET accepted_at = ?, accepted_by_user_id = ?, is_active = 0
           WHERE id = ?
             AND accepted_at IS NULL
             AND revoked_at IS NULL
             AND is_active = 1
             AND expires_at > ?`
        )
        .bind(input.acceptedAt, input.acceptedByUserId, input.inviteId, input.acceptedAt)
    ];

    if (input.membership) {
      statements.push(
        this.database
          .prepare(
            `INSERT OR IGNORE INTO memberships (
               id,
               organization_id,
               user_id,
               created_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?)`
          )
          .bind(
            input.membership.id,
            input.membership.organizationId,
            input.membership.userId,
            input.membership.createdAt,
            input.membership.updatedAt
          )
      );
    }

    if (input.roleAssignment) {
      statements.push(
        this.database
          .prepare(
            `INSERT OR IGNORE INTO role_assignments (
               id,
               membership_id,
               subject_user_id,
               organization_id,
               scope_kind,
               scope_key,
               project_id,
               environment_id,
               resource_id,
               role_name,
               created_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            input.roleAssignment.id,
            input.roleAssignment.membershipId,
            input.roleAssignment.userId,
            input.roleAssignment.organizationId,
            input.roleAssignment.scopeKind,
            input.roleAssignment.scopeKey,
            input.roleAssignment.projectId,
            input.roleAssignment.environmentId,
            input.roleAssignment.resourceId,
            input.roleAssignment.role,
            input.roleAssignment.createdAt,
            input.roleAssignment.updatedAt
          )
      );
    }

    statements.push(...createEventStatements(this.database, input.events));

    const [inviteResult] = await runBatch(this.database, statements);
    const accepted = getChanges(inviteResult) > 0;

    if (!accepted) {
      return {
        invite: null,
        membership: null
      };
    }

    const invite = await this.findInviteById(input.inviteId);
    const membership = await this.findMembershipByUserId(input.organizationId, input.acceptedByUserId);

    return {
      invite,
      membership
    };
  }

  async countOwners(organizationId: string): Promise<number> {
    const ownerCount = await this.database
      .prepare(
        `SELECT COUNT(*) AS owner_count
         FROM role_assignments
         WHERE organization_id = ? AND scope_kind = 'organization' AND role_name = 'owner'`
      )
      .bind(organizationId)
      .first<number>("owner_count");

    return ownerCount ?? 0;
  }

  async createInvite(input: CreateInviteInput): Promise<void> {
    await runBatch(this.database, [
      this.database
        .prepare(
          `UPDATE organization_invites
           SET is_active = 0
           WHERE organization_id = ?
             AND normalized_email = ?
             AND is_active = 1
             AND accepted_at IS NULL
             AND revoked_at IS NULL
             AND expires_at <= ?`
        )
        .bind(input.invite.organizationId, input.invite.normalizedEmail, input.currentTime),
      this.database
        .prepare(
          `INSERT INTO organization_invites (
             id,
             organization_id,
             email,
             normalized_email,
             role_name,
             token_hash,
             created_at,
             expires_at,
             accepted_at,
             accepted_by_user_id,
             revoked_at,
             revoked_by_user_id,
             created_by_user_id,
             is_active
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, 1)`
        )
        .bind(
          input.invite.id,
          input.invite.organizationId,
          input.invite.email,
          input.invite.normalizedEmail,
          input.invite.role,
          input.invite.tokenHash,
          input.invite.createdAt,
          input.invite.expiresAt,
          input.invite.createdByUserId
        ),
      ...createEventStatements(this.database, [input.event])
    ]);
  }

  async createOrganizationWithOwner(input: CreateOrganizationWithOwnerInput): Promise<void> {
    await runBatch(this.database, [
      this.database
        .prepare(
          `INSERT INTO organizations (
             id,
             slug,
             name,
             created_at,
             updated_at
           ) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          input.organization.id,
          input.organization.slug,
          input.organization.name,
          input.organization.createdAt,
          input.organization.updatedAt
        ),
      this.database
        .prepare(
          `INSERT INTO memberships (
             id,
             organization_id,
             user_id,
             created_at,
             updated_at
           ) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          input.membership.id,
          input.membership.organizationId,
          input.membership.userId,
          input.membership.createdAt,
          input.membership.updatedAt
        ),
      this.database
        .prepare(
          `INSERT INTO role_assignments (
             id,
             membership_id,
             subject_user_id,
             organization_id,
             scope_kind,
             scope_key,
             project_id,
             environment_id,
             resource_id,
             role_name,
             created_at,
             updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.roleAssignment.id,
          input.roleAssignment.membershipId,
          input.roleAssignment.userId,
          input.roleAssignment.organizationId,
          input.roleAssignment.scopeKind,
          input.roleAssignment.scopeKey,
          input.roleAssignment.projectId,
          input.roleAssignment.environmentId,
          input.roleAssignment.resourceId,
          input.roleAssignment.role,
          input.roleAssignment.createdAt,
          input.roleAssignment.updatedAt
        ),
      ...createEventStatements(this.database, input.events)
    ]);
  }

  async deactivateExpiredInvitesForEmail(organizationId: string, normalizedEmail: string, currentTime: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE organization_invites
         SET is_active = 0
         WHERE organization_id = ?
           AND normalized_email = ?
           AND is_active = 1
           AND accepted_at IS NULL
           AND revoked_at IS NULL
           AND expires_at <= ?`
      )
      .bind(organizationId, normalizedEmail, currentTime)
      .run();
  }

  async findInviteById(inviteId: string): Promise<InviteRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT
           id,
           organization_id,
           email,
           normalized_email,
           role_name,
           token_hash,
           created_at,
           expires_at,
           accepted_at,
           accepted_by_user_id,
           revoked_at,
           revoked_by_user_id,
           created_by_user_id,
           is_active
         FROM organization_invites
         WHERE id = ?`
      )
      .bind(inviteId)
      .first<InviteRow>();

    return row ? mapInviteRow(row) : null;
  }

  async findMembershipById(organizationId: string, memberId: string): Promise<MembershipRecord | null> {
    return this.readMembership(
      `SELECT
         m.id,
         m.organization_id,
         m.user_id,
         m.created_at,
         m.updated_at,
         ra.role_name
       FROM memberships m
       JOIN role_assignments ra ON ra.membership_id = m.id AND ra.scope_kind = 'organization'
       WHERE m.organization_id = ? AND m.id = ?`,
      [organizationId, memberId]
    );
  }

  async findMembershipByUserId(organizationId: string, userId: string): Promise<MembershipRecord | null> {
    return this.readMembership(
      `SELECT
         m.id,
         m.organization_id,
         m.user_id,
         m.created_at,
         m.updated_at,
         ra.role_name
       FROM memberships m
       JOIN role_assignments ra ON ra.membership_id = m.id AND ra.scope_kind = 'organization'
       WHERE m.organization_id = ? AND m.user_id = ?`,
      [organizationId, userId]
    );
  }

  async findOrganizationById(organizationId: string): Promise<OrganizationRecord | null> {
    return this.readOrganization(
      `SELECT id, slug, name, created_at, updated_at
       FROM organizations
       WHERE id = ?`,
      [organizationId]
    );
  }

  async findOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
    return this.readOrganization(
      `SELECT id, slug, name, created_at, updated_at
       FROM organizations
       WHERE slug = ?`,
      [slug]
    );
  }

  async findPendingInviteByEmail(organizationId: string, normalizedEmail: string): Promise<InviteRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT
           id,
           organization_id,
           email,
           normalized_email,
           role_name,
           token_hash,
           created_at,
           expires_at,
           accepted_at,
           accepted_by_user_id,
           revoked_at,
           revoked_by_user_id,
           created_by_user_id,
           is_active
         FROM organization_invites
         WHERE organization_id = ?
           AND normalized_email = ?
           AND is_active = 1
           AND accepted_at IS NULL
           AND revoked_at IS NULL
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .bind(organizationId, normalizedEmail)
      .first<InviteRow>();

    return row ? mapInviteRow(row) : null;
  }

  async listMembers(organizationId: string): Promise<MembershipRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT
           m.id,
           m.organization_id,
           m.user_id,
           m.created_at,
           m.updated_at,
           ra.role_name
         FROM memberships m
         JOIN role_assignments ra ON ra.membership_id = m.id AND ra.scope_kind = 'organization'
         WHERE m.organization_id = ?
         ORDER BY m.created_at ASC, m.id ASC`
      )
      .bind(organizationId)
      .all<MembershipRow>();

    return result.results.map(mapMembershipRow);
  }

  async listOrganizationsForUser(userId: string): Promise<OrganizationListItemRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT
           org.id,
           org.slug,
           org.name,
           org.created_at,
           org.updated_at,
           m.id AS member_id,
           m.created_at AS joined_at,
           ra.role_name
         FROM memberships m
         JOIN organizations org ON org.id = m.organization_id
         JOIN role_assignments ra ON ra.membership_id = m.id AND ra.scope_kind = 'organization'
         WHERE m.user_id = ?
         ORDER BY LOWER(org.name) ASC, org.id ASC`
      )
      .bind(userId)
      .all<OrganizationListItemRow>();

    return result.results.map((row) => ({
      createdAt: row.created_at,
      id: row.id,
      joinedAt: row.joined_at,
      memberId: row.member_id,
      name: row.name,
      role: organizationRoleSchema.parse(row.role_name),
      slug: row.slug,
      updatedAt: row.updated_at
    }));
  }

  async listRoleAssignmentsForUser(organizationId: string, userId: string): Promise<RoleAssignmentFactRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT
           scope_kind,
           organization_id,
           project_id,
           environment_id,
           resource_id,
           role_name
         FROM role_assignments
         WHERE organization_id = ? AND subject_user_id = ?
         ORDER BY
           CASE scope_kind
             WHEN 'organization' THEN 1
             WHEN 'project' THEN 2
             WHEN 'environment' THEN 3
             ELSE 4
           END ASC,
           role_name ASC`
      )
      .bind(organizationId, userId)
      .all<RoleAssignmentFactRow>();

    return result.results.map((row) => ({
      environmentId: row.environment_id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      resourceId: row.resource_id,
      role: roleNameSchema.parse(row.role_name),
      scopeKind: scopeKindSchema.parse(row.scope_kind)
    }));
  }

  async removeMembership(input: RemoveMembershipInput): Promise<boolean> {
    await this.database
      .prepare(
        `DELETE FROM role_assignments
         WHERE membership_id = ? AND organization_id = ?`
      )
      .bind(input.memberId, input.organizationId)
      .run();

    const removedMembership = await this.database
      .prepare(
        `DELETE FROM memberships
         WHERE id = ? AND organization_id = ?`
      )
      .bind(input.memberId, input.organizationId)
      .run();

    if (getChanges(removedMembership) === 0) {
      return false;
    }

    await appendEvents(this.database, [input.event]);

    return true;
  }

  async updateMembershipRole(input: UpdateMembershipRoleInput): Promise<MembershipRecord | null> {
    const updatedRole = await this.database
      .prepare(
        `UPDATE role_assignments
         SET role_name = ?, updated_at = ?
         WHERE membership_id = ? AND organization_id = ? AND scope_kind = 'organization'`
      )
      .bind(input.role, input.updatedAt, input.memberId, input.organizationId)
      .run();

    if (getChanges(updatedRole) === 0) {
      return null;
    }

    await this.database
      .prepare(
        `UPDATE memberships
         SET updated_at = ?
         WHERE id = ? AND organization_id = ?`
      )
      .bind(input.updatedAt, input.memberId, input.organizationId)
      .run();

    await appendEvents(this.database, [input.event]);

    return this.findMembershipById(input.organizationId, input.memberId);
  }

  async updateOrganization(input: UpdateOrganizationInput): Promise<OrganizationRecord | null> {
    const updatedOrganization = await this.database
      .prepare(
        `UPDATE organizations
         SET name = ?, slug = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(input.name, input.slug, input.updatedAt, input.organizationId)
      .run();

    if (getChanges(updatedOrganization) === 0) {
      return null;
    }

    await appendEvents(this.database, [input.event]);

    return this.findOrganizationById(input.organizationId);
  }

  private async readMembership(query: string, bindings: readonly unknown[]): Promise<MembershipRecord | null> {
    const row = await this.database.prepare(query).bind(...bindings).first<MembershipRow>();

    return row ? mapMembershipRow(row) : null;
  }

  private async readOrganization(query: string, bindings: readonly unknown[]): Promise<OrganizationRecord | null> {
    const row = await this.database.prepare(query).bind(...bindings).first<OrganizationRow>();

    return row ? mapOrganizationRow(row) : null;
  }
}

function createEventStatements(database: D1Database, events: readonly SourceplaneEventEnvelope[]): D1PreparedStatement[] {
  return events.map((event) =>
    database
      .prepare(
        `INSERT INTO membership_event_outbox (id, event_type, envelope_json, occurred_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(event.id, event.type, JSON.stringify(event), event.occurredAt)
  );
}

async function runBatch(database: D1Database, statements: readonly D1PreparedStatement[]): Promise<unknown[]> {
  const batch = Reflect.get(database, "batch");

  if (typeof batch === "function") {
    return await batch.call(database, [...statements]);
  }

  const results: unknown[] = [];
  for (const statement of statements) {
    results.push(await statement.run());
  }

  return results;
}

async function appendEvents(database: D1Database, events: readonly SourceplaneEventEnvelope[]): Promise<void> {
  for (const statement of createEventStatements(database, events)) {
    await statement.run();
  }
}

function getChanges(result: unknown): number {
  if (!result || typeof result !== "object") {
    return 0;
  }

  if (
    "meta" in result &&
    result.meta &&
    typeof result.meta === "object" &&
    "changes" in result.meta &&
    typeof result.meta.changes === "number"
  ) {
    return result.meta.changes;
  }

  if ("changes" in result && typeof result.changes === "number") {
    return result.changes;
  }

  return 0;
}

function mapInviteRow(row: InviteRow): InviteRecord {
  return {
    acceptedAt: row.accepted_at,
    acceptedByUserId: row.accepted_by_user_id,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    email: row.email,
    expiresAt: row.expires_at,
    id: row.id,
    isActive: row.is_active === 1,
    normalizedEmail: row.normalized_email,
    organizationId: row.organization_id,
    revokedAt: row.revoked_at,
    revokedByUserId: row.revoked_by_user_id,
    role: organizationRoleSchema.parse(row.role_name),
    tokenHash: row.token_hash
  };
}

function mapMembershipRow(row: MembershipRow): MembershipRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    organizationId: row.organization_id,
    role: organizationRoleSchema.parse(row.role_name),
    updatedAt: row.updated_at,
    userId: row.user_id
  };
}

function mapOrganizationRow(row: OrganizationRow): OrganizationRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at
  };
}
