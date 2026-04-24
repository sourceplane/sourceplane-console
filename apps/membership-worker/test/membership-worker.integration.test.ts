import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  acceptOrganizationInviteResponseSchema,
  authorizationMembershipResolveResponseSchema,
  createOrganizationInviteResponseSchema,
  createOrganizationResponseSchema,
  identityUserLookupResponseSchema,
  isApiErrorEnvelope,
  listOrganizationMembersResponseSchema,
  loginCompleteResponseSchema,
  loginStartResponseSchema,
  type ApiSuccessEnvelope
} from "@sourceplane/contracts";
import identityWorker, { type IdentityWorkerEnv } from "@sourceplane/identity-worker";
import membershipWorker, { type MembershipWorkerEnv } from "../src/index.js";
import { applyD1Migrations, createServiceBinding, createTestD1Database } from "@sourceplane/testing";

const executionContext: ExecutionContext = {
  passThroughOnException(): void {},
  waitUntil(promise: Promise<unknown>): void {
    void promise;
  }
};

const identityMigrationsDirectory = resolve(import.meta.dirname, "..", "..", "identity-worker", "migrations");
const membershipMigrationsDirectory = resolve(import.meta.dirname, "..", "migrations");

describe("membership-worker", () => {
  it("serves health and ping endpoints", async () => {
    const harness = await createHarness();

    try {
      const healthResponse = await membershipWorker.fetch(
        new Request("https://membership.sourceplane.test/healthz"),
        harness.membershipEnv,
        executionContext
      );
      const pingResponse = await membershipWorker.fetch(
        new Request("https://membership.sourceplane.test/internal/ping", {
          headers: {
            traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
            "x-sourceplane-request-id": "req_forwarded"
          }
        }),
        harness.membershipEnv,
        executionContext
      );

      expect(healthResponse.status).toBe(200);
      expect(assertSuccessEnvelope(await readJsonValue(healthResponse)).data).toEqual({
        environment: "local",
        ok: true,
        service: "membership-worker"
      });

      expect(pingResponse.status).toBe(200);
      expect(assertSuccessEnvelope(await readJsonValue(pingResponse)).data).toEqual({
        ok: true,
        receivedRequestId: "req_forwarded",
        receivedTraceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
        service: "membership-worker",
        stage: "local"
      });
    } finally {
      harness.close();
    }
  });

  it("handles forwarded organization routes and resolves policy memberships", async () => {
    const harness = await createHarness();

    try {
      const ownerSession = await createInteractiveSession(harness.identityEnv, "owner@example.com");
      const viewerSession = await createInteractiveSession(harness.identityEnv, "viewer@example.com");

      const createOrganization = await callSuccessEnvelope(
        membershipWorker.fetch(
          new Request("https://membership.sourceplane.test/internal/edge/v1/organizations", {
            body: JSON.stringify({
              name: "Acme Platform"
            }),
            headers: {
              "content-type": "application/json",
              "x-sourceplane-actor-id": ownerSession.userId,
              "x-sourceplane-actor-type": "user",
              "x-sourceplane-session-id": ownerSession.sessionId
            },
            method: "POST"
          }),
          harness.membershipEnv,
          executionContext
        )
      );
      const createdOrganization = createOrganizationResponseSchema.parse(createOrganization.data);

      const createInvite = await callSuccessEnvelope(
        membershipWorker.fetch(
          new Request(`https://membership.sourceplane.test/internal/edge/v1/organizations/${createdOrganization.organization.id}/invites`, {
            body: JSON.stringify({
              email: "viewer@example.com",
              role: "viewer"
            }),
            headers: {
              "content-type": "application/json",
              "x-sourceplane-actor-id": ownerSession.userId,
              "x-sourceplane-actor-type": "user",
              "x-sourceplane-session-id": ownerSession.sessionId
            },
            method: "POST"
          }),
          harness.membershipEnv,
          executionContext
        )
      );
      const createdInvite = createOrganizationInviteResponseSchema.parse(createInvite.data);
      const inviteToken = createdInvite.delivery.mode === "local_debug" ? createdInvite.delivery.acceptToken : null;

      if (!inviteToken) {
        throw new Error("Expected local_debug invite delivery during tests.");
      }

      const acceptedInvite = await callSuccessEnvelope(
        membershipWorker.fetch(
          new Request(
            `https://membership.sourceplane.test/internal/edge/v1/organizations/invites/${createdInvite.invite.id}/accept`,
            {
              body: JSON.stringify({
                token: inviteToken
              }),
              headers: {
                "content-type": "application/json",
                "x-sourceplane-actor-id": viewerSession.userId,
                "x-sourceplane-actor-type": "user",
                "x-sourceplane-session-id": viewerSession.sessionId
              },
              method: "POST"
            }
          ),
          harness.membershipEnv,
          executionContext
        )
      );

      expect(acceptOrganizationInviteResponseSchema.parse(acceptedInvite.data)).toMatchObject({
        invite: {
          id: createdInvite.invite.id,
          status: "accepted"
        },
        membership: {
          organizationId: createdOrganization.organization.id,
          role: "viewer",
          userId: viewerSession.userId
        }
      });

      const members = await callSuccessEnvelope(
        membershipWorker.fetch(
          new Request(`https://membership.sourceplane.test/internal/edge/v1/organizations/${createdOrganization.organization.id}/members`, {
            headers: {
              "x-sourceplane-actor-id": ownerSession.userId,
              "x-sourceplane-actor-type": "user",
              "x-sourceplane-session-id": ownerSession.sessionId
            }
          }),
          harness.membershipEnv,
          executionContext
        )
      );

      expect(listOrganizationMembersResponseSchema.parse(members.data).members).toHaveLength(2);

      const resolvedMemberships = await callSuccessEnvelope(
        membershipWorker.fetch(
          new Request("https://membership.sourceplane.test/internal/authorization-memberships/resolve", {
            body: JSON.stringify({
              resource: {
                id: createdOrganization.organization.id,
                kind: "organization",
                orgId: createdOrganization.organization.id
              },
              subject: {
                id: viewerSession.userId,
                type: "user"
              }
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.membershipEnv,
          executionContext
        )
      );

      expect(authorizationMembershipResolveResponseSchema.parse(resolvedMemberships.data)).toEqual({
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

      const resolvedUser = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/users/resolve", {
            body: JSON.stringify({
              userId: viewerSession.userId
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.identityEnv,
          executionContext
        )
      );

      const userLookupResult = identityUserLookupResponseSchema.parse(resolvedUser.data);

      expect(userLookupResult.user).not.toBeNull();
      expect(typeof userLookupResult.user?.createdAt).toBe("string");
      expect(userLookupResult.user?.id).toBe(viewerSession.userId);
      expect(userLookupResult.user?.primaryEmail).toBe("viewer@example.com");
    } finally {
      harness.close();
    }
  });

  it("uses a fallback token hash secret outside production when none is configured", async () => {
    const harness = await createHarness({
      membershipEnv: {
        ENVIRONMENT: "preview",
        MEMBERSHIP_TOKEN_HASH_SECRET: undefined
      }
    });

    try {
      const ownerSession = await createInteractiveSession(harness.identityEnv, "preview-owner@example.com");

      const createOrganization = await callSuccessEnvelope(
        membershipWorker.fetch(
          new Request("https://membership.sourceplane.test/internal/edge/v1/organizations", {
            body: JSON.stringify({
              name: "Preview Org"
            }),
            headers: {
              "content-type": "application/json",
              "x-sourceplane-actor-id": ownerSession.userId,
              "x-sourceplane-actor-type": "user",
              "x-sourceplane-session-id": ownerSession.sessionId
            },
            method: "POST"
          }),
          harness.membershipEnv,
          executionContext
        )
      );

      expect(createOrganizationResponseSchema.parse(createOrganization.data).organization.name).toBe("Preview Org");
    } finally {
      harness.close();
    }
  });

  it("returns validation errors without leaking implementation details", async () => {
    const harness = await createHarness();

    try {
      const response = await membershipWorker.fetch(
        new Request("https://membership.sourceplane.test/internal/authorization-memberships/resolve", {
          body: JSON.stringify({
            subject: {
              id: "usr_123",
              type: "service"
            }
          }),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        }),
        harness.membershipEnv,
        executionContext
      );

      expect(response.status).toBe(400);
      expect(isApiErrorEnvelope(await readJsonValue(response))).toBe(true);
    } finally {
      harness.close();
    }
  });
});

async function callSuccessEnvelope<TData>(responsePromise: Promise<Response>): Promise<ApiSuccessEnvelope<TData>> {
  const response = await responsePromise;
  const payload = await readJsonValue(response);

  if (!response.ok) {
    throw new Error(`Expected success but received ${response.status}: ${JSON.stringify(payload)}`);
  }

  return assertSuccessEnvelope<TData>(payload);
}

async function createHarness(overrides: {
  identityEnv?: Partial<IdentityWorkerEnv>;
  membershipEnv?: Partial<MembershipWorkerEnv>;
} = {}): Promise<{
  close(): void;
  identityEnv: IdentityWorkerEnv;
  membershipEnv: MembershipWorkerEnv;
}> {
  const identityDatabase = createTestD1Database();
  const membershipDatabase = createTestD1Database();
  await applyD1Migrations(identityDatabase.binding, identityMigrationsDirectory);
  await applyD1Migrations(membershipDatabase.binding, membershipMigrationsDirectory);

  const identityEnv: IdentityWorkerEnv = {
    APP_NAME: "identity-worker",
    ENVIRONMENT: "local",
    IDENTITY_DB: identityDatabase.binding,
    IDENTITY_TOKEN_HASH_SECRET: "identity-test-secret",
    ...overrides.identityEnv
  };
  const membershipEnv: MembershipWorkerEnv = {
    APP_NAME: "membership-worker",
    ENVIRONMENT: "local",
    IDENTITY: createServiceBinding((request) => identityWorker.fetch(request, identityEnv, executionContext)),
    MEMBERSHIP_DB: membershipDatabase.binding,
    MEMBERSHIP_TOKEN_HASH_SECRET: "membership-test-secret",
    ...overrides.membershipEnv
  };

  return {
    close(): void {
      identityDatabase.close();
      membershipDatabase.close();
    },
    identityEnv,
    membershipEnv
  };
}

async function createInteractiveSession(
  env: IdentityWorkerEnv,
  email: string
): Promise<{ sessionId: string; token: string; userId: string }> {
  const loginStart = await callSuccessEnvelope(
    identityWorker.fetch(
      new Request("https://identity.sourceplane.test/internal/edge/v1/auth/login/start", {
        body: JSON.stringify({
          email
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      executionContext
    )
  );
  const loginStartData = loginStartResponseSchema.parse(loginStart.data);
  const code = loginStartData.delivery.mode === "local_debug" ? loginStartData.delivery.code : null;

  if (!code) {
    throw new Error("Expected local_debug delivery during tests.");
  }

  const loginComplete = await callSuccessEnvelope(
    identityWorker.fetch(
      new Request("https://identity.sourceplane.test/internal/edge/v1/auth/login/complete", {
        body: JSON.stringify({
          challengeId: loginStartData.challengeId,
          code
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      executionContext
    )
  );
  const loginCompleteData = loginCompleteResponseSchema.parse(loginComplete.data);

  return {
    sessionId: loginCompleteData.session.id,
    token: loginCompleteData.session.token,
    userId: loginCompleteData.user.id
  };
}

function assertSuccessEnvelope<TData>(value: unknown): ApiSuccessEnvelope<TData> {
  if (!value || typeof value !== "object" || !("data" in value) || !("meta" in value)) {
    throw new Error("Expected a success envelope.");
  }

  return value as ApiSuccessEnvelope<TData>;
}

async function readJsonValue(response: Response): Promise<unknown> {
  return JSON.parse(await response.text()) as unknown;
}
