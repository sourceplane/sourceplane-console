import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { IdentityUser } from "@sourceplane/contracts";
import { applyD1Migrations, createTestD1Database } from "@sourceplane/testing";

import { D1MembershipRepository } from "../src/domain/d1-membership-repository.js";
import { createMembershipService } from "../src/domain/service.js";

const migrationsDirectory = resolve(import.meta.dirname, "..", "migrations");
const fixedNow = new Date("2026-04-24T12:00:00.000Z");

describe("membership service", () => {
  it("creates an organization with an initial owner membership and outbox events", async () => {
    const harness = await createHarness();

    try {
      harness.registerUser({
        createdAt: fixedNow.toISOString(),
        id: "usr_owner",
        primaryEmail: "owner@example.com"
      });

      const createdOrganization = await harness.service.createOrganization({
        actor: {
          id: "usr_owner",
          type: "user"
        },
        idempotencyKey: "idem_org_create",
        ipAddress: "203.0.113.10",
        name: "Acme Platform",
        requestId: "req_org_create",
        sessionId: "ses_owner",
        traceparent: null
      });

      expect(createdOrganization.organization.slug).toBe("acme-platform");
      expect(createdOrganization.membership.role).toBe("owner");

      const organizations = await harness.service.listOrganizationsForActor({
        actor: {
          id: "usr_owner",
          type: "user"
        }
      });

      expect(organizations.organizations).toEqual([
        {
          createdAt: fixedNow.toISOString(),
          id: createdOrganization.organization.id,
          joinedAt: fixedNow.toISOString(),
          memberId: createdOrganization.membership.id,
          name: "Acme Platform",
          role: "owner",
          slug: "acme-platform",
          updatedAt: fixedNow.toISOString()
        }
      ]);

      expect(await readOutboxEventTypes(harness.database.binding)).toEqual([
        "organization.created",
        "membership.added"
      ]);
    } finally {
      harness.close();
    }
  });

  it("rejects invite acceptance when the authenticated user email does not match the invite", async () => {
    const harness = await createHarness();

    try {
      harness.registerUser({
        createdAt: fixedNow.toISOString(),
        id: "usr_owner",
        primaryEmail: "owner@example.com"
      });
      harness.registerUser({
        createdAt: fixedNow.toISOString(),
        id: "usr_wrong",
        primaryEmail: "wrong@example.com"
      });

      const createdOrganization = await harness.service.createOrganization({
        actor: {
          id: "usr_owner",
          type: "user"
        },
        idempotencyKey: "idem_org_create",
        ipAddress: null,
        name: "Acme Platform",
        requestId: "req_org_create",
        sessionId: "ses_owner",
        traceparent: null
      });
      const invitedMember = await harness.service.inviteMember({
        actor: {
          id: "usr_owner",
          type: "user"
        },
        email: "viewer@example.com",
        idempotencyKey: "idem_invite_create",
        ipAddress: null,
        organizationId: createdOrganization.organization.id,
        requestId: "req_invite_create",
        role: "viewer",
        sessionId: "ses_owner",
        traceparent: null
      });

      const inviteToken = invitedMember.delivery.mode === "local_debug" ? invitedMember.delivery.acceptToken : null;
      expect(inviteToken).not.toBeNull();

      await expect(
        harness.service.acceptInvite({
          actor: {
            id: "usr_wrong",
            type: "user"
          },
          idempotencyKey: "idem_invite_accept_wrong",
          inviteId: invitedMember.invite.id,
          ipAddress: null,
          requestId: "req_invite_accept_wrong",
          sessionId: "ses_wrong",
          token: inviteToken!,
          traceparent: null
        })
      ).rejects.toMatchObject({
        code: "forbidden"
      });
    } finally {
      harness.close();
    }
  });

  it("accepts a single-use invite and creates a membership only once", async () => {
    const harness = await createHarness();

    try {
      harness.registerUser({
        createdAt: fixedNow.toISOString(),
        id: "usr_owner",
        primaryEmail: "owner@example.com"
      });
      harness.registerUser({
        createdAt: fixedNow.toISOString(),
        id: "usr_viewer",
        primaryEmail: "viewer@example.com"
      });

      const createdOrganization = await harness.service.createOrganization({
        actor: {
          id: "usr_owner",
          type: "user"
        },
        idempotencyKey: "idem_org_create",
        ipAddress: null,
        name: "Acme Platform",
        requestId: "req_org_create",
        sessionId: "ses_owner",
        traceparent: null
      });
      const invitedMember = await harness.service.inviteMember({
        actor: {
          id: "usr_owner",
          type: "user"
        },
        email: "viewer@example.com",
        idempotencyKey: "idem_invite_create",
        ipAddress: null,
        organizationId: createdOrganization.organization.id,
        requestId: "req_invite_create",
        role: "viewer",
        sessionId: "ses_owner",
        traceparent: null
      });
      const inviteToken = invitedMember.delivery.mode === "local_debug" ? invitedMember.delivery.acceptToken : null;

      if (!inviteToken) {
        throw new Error("Expected local_debug invite delivery in tests.");
      }

      const acceptedInvite = await harness.service.acceptInvite({
        actor: {
          id: "usr_viewer",
          type: "user"
        },
        idempotencyKey: "idem_invite_accept",
        inviteId: invitedMember.invite.id,
        ipAddress: null,
        requestId: "req_invite_accept",
        sessionId: "ses_viewer",
        token: inviteToken,
        traceparent: null
      });

      expect(acceptedInvite.membership.role).toBe("viewer");
      expect(acceptedInvite.invite.status).toBe("accepted");

      const resolvedMemberships = await harness.service.resolveAuthorizationMemberships({
        resource: {
          id: createdOrganization.organization.id,
          kind: "organization",
          orgId: createdOrganization.organization.id
        },
        subject: {
          id: "usr_viewer",
          type: "user"
        }
      });

      expect(resolvedMemberships).toEqual({
        memberships: [
          {
            kind: "role_assignment",
            role: "viewer",
            scope: {
              kind: "organization",
              orgId: createdOrganization.organization.id
            }
          }
        ]
      });

      await expect(
        harness.service.acceptInvite({
          actor: {
            id: "usr_viewer",
            type: "user"
          },
          idempotencyKey: "idem_invite_accept_again",
          inviteId: invitedMember.invite.id,
          ipAddress: null,
          requestId: "req_invite_accept_again",
          sessionId: "ses_viewer",
          token: inviteToken,
          traceparent: null
        })
      ).rejects.toMatchObject({
        code: "conflict"
      });

      expect(await readOutboxEventTypes(harness.database.binding)).toEqual([
        "organization.created",
        "membership.added",
        "invite.created",
        "invite.accepted",
        "membership.added"
      ]);
    } finally {
      harness.close();
    }
  });

  it("prevents removal of the last owner", async () => {
    const harness = await createHarness();

    try {
      harness.registerUser({
        createdAt: fixedNow.toISOString(),
        id: "usr_owner",
        primaryEmail: "owner@example.com"
      });

      const createdOrganization = await harness.service.createOrganization({
        actor: {
          id: "usr_owner",
          type: "user"
        },
        idempotencyKey: "idem_org_create",
        ipAddress: null,
        name: "Acme Platform",
        requestId: "req_org_create",
        sessionId: "ses_owner",
        traceparent: null
      });

      await expect(
        harness.service.removeMember({
          actor: {
            id: "usr_owner",
            type: "user"
          },
          idempotencyKey: "idem_member_remove",
          ipAddress: null,
          memberId: createdOrganization.membership.id,
          organizationId: createdOrganization.organization.id,
          requestId: "req_member_remove",
          sessionId: "ses_owner",
          traceparent: null
        })
      ).rejects.toMatchObject({
        code: "precondition_failed"
      });
    } finally {
      harness.close();
    }
  });
});

async function createHarness(): Promise<{
  close(): void;
  database: ReturnType<typeof createTestD1Database>;
  registerUser(user: IdentityUser): void;
  service: ReturnType<typeof createMembershipService>;
}> {
  const database = createTestD1Database();
  await applyD1Migrations(database.binding, migrationsDirectory);
  const users = new Map<string, IdentityUser>();
  const service = createMembershipService({
    identityDirectory: {
      getUserById(userId: string): Promise<IdentityUser | null> {
        return Promise.resolve(users.get(userId) ?? null);
      }
    },
    now: () => new Date(fixedNow),
    repository: new D1MembershipRepository(database.binding),
    serviceName: "membership-worker",
    tokenHashSecret: "membership-test-secret"
  });

  return {
    close(): void {
      database.close();
    },
    database,
    registerUser(user: IdentityUser): void {
      users.set(user.id, user);
    },
    service
  };
}

async function readOutboxEventTypes(database: D1Database): Promise<string[]> {
  const result = await database
    .prepare(
      `SELECT event_type
       FROM membership_event_outbox
       ORDER BY rowid ASC`
    )
    .all<{ event_type: string }>();

  return result.results.map((row) => row.event_type);
}
