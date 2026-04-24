import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  acceptOrganizationInviteResponseSchema,
  authorizationRequestSchema,
  createEnvironmentResponseSchema,
  createOrganizationInviteResponseSchema,
  createOrganizationResponseSchema,
  createProjectResponseSchema,
  createSuccessResponse,
  isApiErrorEnvelope,
  listEnvironmentsResponseSchema,
  loginCompleteResponseSchema,
  loginStartResponseSchema,
  updateOrganizationResponseSchema,
  type ApiErrorEnvelope,
  type ApiSuccessEnvelope
} from "@sourceplane/contracts";
import { createApiEdgeApp, type ApiEdgeEnv } from "@sourceplane/api-edge";
import identityWorker, { type IdentityWorkerEnv } from "@sourceplane/identity-worker";
import membershipWorker, { type MembershipWorkerEnv } from "@sourceplane/membership-worker";
import policyWorker, { type PolicyWorkerEnv } from "@sourceplane/policy-worker";
import projectsWorker, { type ProjectsWorkerEnv } from "@sourceplane/projects-worker";
import { applyD1Migrations, createServiceBinding, createTestD1Database } from "@sourceplane/testing";

import { MemoryIdempotencyStore } from "../src/testing/memory-idempotency-store.js";

const executionContext: ExecutionContext = {
  passThroughOnException(): void {},
  waitUntil(promise: Promise<unknown>): void {
    void promise;
  }
};

const identityMigrationsDirectory = resolve(import.meta.dirname, "..", "..", "identity-worker", "migrations");
const membershipMigrationsDirectory = resolve(import.meta.dirname, "..", "..", "membership-worker", "migrations");
const projectsMigrationsDirectory = resolve(import.meta.dirname, "..", "..", "projects-worker", "migrations");

interface RouteInventoryData {
  groups: Array<{ clientKey: string; group: string; summary: string }>;
  version: string;
}

interface AuthPingData {
  binding: string;
  upstream: {
    receivedRequestId: string;
    receivedTraceparent: string | null;
    service: string;
  };
}

interface ProjectResultData {
  ok: boolean;
  projectId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRouteInventoryData(value: unknown): value is RouteInventoryData {
  return (
    isRecord(value) &&
    typeof value.version === "string" &&
    Array.isArray(value.groups) &&
    value.groups.every(
      (group) =>
        isRecord(group) &&
        typeof group.clientKey === "string" &&
        typeof group.group === "string" &&
        typeof group.summary === "string"
    )
  );
}

function isAuthPingData(value: unknown): value is AuthPingData {
  return (
    isRecord(value) &&
    typeof value.binding === "string" &&
    isRecord(value.upstream) &&
    typeof value.upstream.receivedRequestId === "string" &&
    (typeof value.upstream.receivedTraceparent === "string" || value.upstream.receivedTraceparent === null) &&
    typeof value.upstream.service === "string"
  );
}

function isProjectResultData(value: unknown): value is ProjectResultData {
  return isRecord(value) && value.ok === true && typeof value.projectId === "string";
}

function assertApiSuccessEnvelope<TData>(
  value: unknown,
  isData: (value: unknown) => value is TData
): ApiSuccessEnvelope<TData> {
  if (!isRecord(value) || !isRecord(value.meta) || !isData(value.data)) {
    throw new Error("Expected a success envelope.");
  }

  if (typeof value.meta.requestId !== "string") {
    throw new Error("Success envelope is missing a requestId.");
  }

  if (!(typeof value.meta.cursor === "string" || value.meta.cursor === null)) {
    throw new Error("Success envelope has an invalid cursor.");
  }

  return value as ApiSuccessEnvelope<TData>;
}

function assertApiError(value: unknown): ApiErrorEnvelope {
  if (!isApiErrorEnvelope(value)) {
    throw new Error("Expected an error envelope.");
  }

  return value;
}

async function readJsonValue(response: Response): Promise<unknown> {
  const rawText = await response.text();
  const parsedValue: unknown = JSON.parse(rawText);

  return parsedValue;
}

async function createIdentityWorkerTestHarness(): Promise<{ close(): void; env: IdentityWorkerEnv }> {
  const database = createTestD1Database();
  await applyD1Migrations(database.binding, identityMigrationsDirectory);

  return {
    close(): void {
      database.close();
    },
    env: {
      APP_NAME: "identity-worker",
      ENVIRONMENT: "local",
      IDENTITY_DB: database.binding,
      IDENTITY_TOKEN_HASH_SECRET: "identity-test-secret"
    }
  };
}

function createPolicyWorkerTestEnv(): PolicyWorkerEnv {
  return {
    APP_NAME: "policy-worker",
    ENVIRONMENT: "local"
  };
}

async function createMembershipWorkerTestHarness(
  identityEnv: IdentityWorkerEnv
): Promise<{ close(): void; env: MembershipWorkerEnv }> {
  const database = createTestD1Database();
  await applyD1Migrations(database.binding, membershipMigrationsDirectory);

  return {
    close(): void {
      database.close();
    },
    env: {
      APP_NAME: "membership-worker",
      ENVIRONMENT: "local",
      IDENTITY: createServiceBinding((request) => identityWorker.fetch(request, identityEnv, executionContext)),
      MEMBERSHIP_DB: database.binding,
      MEMBERSHIP_TOKEN_HASH_SECRET: "membership-test-secret"
    }
  };
}

async function createProjectsWorkerTestHarness(): Promise<{ close(): void; env: ProjectsWorkerEnv }> {
  const database = createTestD1Database();
  await applyD1Migrations(database.binding, projectsMigrationsDirectory);

  return {
    close(): void {
      database.close();
    },
    env: {
      APP_NAME: "projects-worker",
      ENVIRONMENT: "local",
      PROJECTS_DB: database.binding
    }
  };
}

async function createEdgeInteractiveSession(
  worker: ReturnType<typeof createApiEdgeApp>,
  env: ApiEdgeEnv,
  email: string
): Promise<{ sessionId: string; token: string; userId: string }> {
  const loginStartResponse = await worker.fetch(
    new Request("https://api.sourceplane.test/v1/auth/login/start", {
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
  );
  const loginStartPayload = assertApiSuccessEnvelope(await readJsonValue(loginStartResponse), isRecord);
  const loginStartData = loginStartResponseSchema.parse(loginStartPayload.data);
  const code = loginStartData.delivery.mode === "local_debug" ? loginStartData.delivery.code : null;

  if (!code) {
    throw new Error("Expected local_debug delivery during tests.");
  }

  const loginCompleteResponse = await worker.fetch(
    new Request("https://api.sourceplane.test/v1/auth/login/complete", {
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
  );
  const loginCompletePayload = assertApiSuccessEnvelope(await readJsonValue(loginCompleteResponse), isRecord);
  const loginCompleteData = loginCompleteResponseSchema.parse(loginCompletePayload.data);

  return {
    sessionId: loginCompleteData.session.id,
    token: loginCompleteData.session.token,
    userId: loginCompleteData.user.id
  };
}

describe("api-edge transport behavior", () => {
  it("returns normalized route inventory for /v1", async () => {
    const response = await createApiEdgeApp().fetch(
      new Request("https://api.sourceplane.test/v1"),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local"
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(200);

    const payload = assertApiSuccessEnvelope(await readJsonValue(response), isRouteInventoryData);

    expect(payload.data.version).toBe("v1");
    expect(payload.data.groups.map((group) => group.group)).toContain("/v1/resources");
    expect(payload.meta.requestId).toMatch(/^req_[a-f0-9]{20}$/);
  });

  it("forwards request IDs and trace context to the identity binding", async () => {
    const identityHarness = await createIdentityWorkerTestHarness();
    const worker = createApiEdgeApp();
    try {
      const env: ApiEdgeEnv = {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        IDENTITY: createServiceBinding((request) => identityWorker.fetch(request, identityHarness.env, executionContext))
      };

      const response = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/auth/ping", {
          headers: {
            traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
          }
        }),
        env,
        executionContext
      );

      expect(response.status).toBe(200);

      const payload = assertApiSuccessEnvelope(await readJsonValue(response), isAuthPingData);

      expect(payload.data.binding).toBe("IDENTITY");
      expect(payload.data.upstream.service).toBe("identity-worker");
      expect(payload.data.upstream.receivedTraceparent).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
      );
      expect(payload.data.upstream.receivedRequestId).toBe(payload.meta.requestId);
    } finally {
      identityHarness.close();
    }
  });

  it("calls the real identity worker for ping and bearer auth resolution", async () => {
    const identityHarness = await createIdentityWorkerTestHarness();
    const worker = createApiEdgeApp({
      idempotencyStore: new MemoryIdempotencyStore()
    });

    try {
      const env: ApiEdgeEnv = {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        IDENTITY: createServiceBinding((request) => identityWorker.fetch(request, identityHarness.env, executionContext))
      };

      const pingResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/auth/ping"),
        env,
        executionContext
      );

      expect(pingResponse.status).toBe(200);

      const loginStartResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/auth/login/start", {
          body: JSON.stringify({
            email: "user@example.com"
          }),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(loginStartResponse.status).toBe(200);

      const loginStartPayload = assertApiSuccessEnvelope(await readJsonValue(loginStartResponse), isRecord);
      const loginStartData = loginStartResponseSchema.parse(loginStartPayload.data);
      const code = loginStartData.delivery.mode === "local_debug" ? loginStartData.delivery.code : null;

      expect(code).not.toBeNull();

      const loginCompleteResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/auth/login/complete", {
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
      );

      expect(loginCompleteResponse.status).toBe(200);

      const loginCompletePayload = assertApiSuccessEnvelope(await readJsonValue(loginCompleteResponse), isRecord);
      const loginCompleteData = loginCompleteResponseSchema.parse(loginCompletePayload.data);

      const protectedResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/projects", {
          body: JSON.stringify({
            name: "Acme API"
          }),
          headers: {
            authorization: `Bearer ${loginCompleteData.session.token}`,
            "content-type": "application/json"
          },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(protectedResponse.status).toBe(400);

      const payload = assertApiError(await readJsonValue(protectedResponse));

      expect(payload.error.code).toBe("bad_request");
      expect(payload.error.details).toEqual({
        header: "Idempotency-Key",
        route: "POST:/v1/projects"
      });
    } finally {
      identityHarness.close();
    }
  });

  it("maps upstream identity errors to standardized edge errors", async () => {
    const worker = createApiEdgeApp();
    const env: ApiEdgeEnv = {
      APP_NAME: "api-edge",
      ENVIRONMENT: "local",
      IDENTITY: createServiceBinding(
        () =>
          new Response(
            JSON.stringify({
              error: {
                code: "forbidden",
                details: {
                  reason: "missing_session"
                },
                message: "No active session.",
                requestId: "req_identity"
              }
            }),
            {
              headers: {
                "content-type": "application/json; charset=utf-8"
              },
              status: 403
            }
          )
      )
    };

    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/v1/auth/ping"),
      env,
      executionContext
    );

    expect(response.status).toBe(403);

    const payload = assertApiError(await readJsonValue(response));

    expect(payload.error.code).toBe("forbidden");
    expect(payload.error.details).toEqual({
      reason: "missing_session"
    });
    expect(payload.error.message).toBe("No active session.");
    expect(payload.error.requestId).toMatch(/^req_[a-f0-9]{20}$/);
  });

  it("forwards unauthenticated login start to identity", async () => {
    const worker = createApiEdgeApp();
    const env: ApiEdgeEnv = {
      APP_NAME: "api-edge",
      ENVIRONMENT: "local",
      IDENTITY: createServiceBinding((request) => {
        const url = new URL(request.url);

        if (url.pathname !== "/internal/edge/v1/auth/login/start" || request.method !== "POST") {
          return new Response("not found", { status: 404 });
        }

        return new Response(
          JSON.stringify(
            createSuccessResponse(
              {
                challengeId: "chl_123",
                delivery: {
                  mode: "local_debug"
                },
                expiresAt: "2026-04-23T12:05:00.000Z"
              },
              {
                requestId: request.headers.get("x-sourceplane-request-id") ?? "req_missing"
              }
            )
          ),
          {
            headers: {
              "content-type": "application/json; charset=utf-8"
            }
          }
        );
      })
    };

    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/v1/auth/login/start", {
        body: JSON.stringify({
          email: "user@example.com"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      executionContext
    );

    expect(response.status).toBe(200);

    const payload = assertApiSuccessEnvelope(await readJsonValue(response), isRecord);

    expect(payload.data).toEqual({
      challengeId: "chl_123",
      delivery: {
        mode: "local_debug"
      },
      expiresAt: "2026-04-23T12:05:00.000Z"
    });
  });

  it("requires an authenticated actor for mutating routes", async () => {
    const response = await createApiEdgeApp().fetch(
      new Request("https://api.sourceplane.test/v1/projects", {
        body: JSON.stringify({
          name: "Acme API"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local"
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(401);

    const payload = assertApiError(await readJsonValue(response));

    expect(payload.error.code).toBe("unauthenticated");
    expect(payload.error.message).toBe("Authentication is required for mutating routes.");
  });

  it("requires an idempotency key for POST routes after auth is resolved", async () => {
    const worker = createApiEdgeApp({
      idempotencyStore: new MemoryIdempotencyStore()
    });

    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/v1/projects", {
        body: JSON.stringify({
          name: "Acme API"
        }),
        headers: {
          authorization: "Bearer edge-test-token",
          "content-type": "application/json"
        },
        method: "POST"
      }),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        IDENTITY: createServiceBinding((request) => {
          const url = new URL(request.url);

          if (url.pathname === "/internal/auth/resolve") {
            return new Response(
              JSON.stringify(
                createSuccessResponse(
                  {
                    actor: {
                      id: "usr_123",
                      type: "user"
                    },
                    organizationId: "org_123",
                    sessionId: "ses_123"
                  },
                  {
                    requestId: request.headers.get("x-sourceplane-request-id") ?? "req_missing"
                  }
                )
              ),
              {
                headers: {
                  "content-type": "application/json; charset=utf-8"
                }
              }
            );
          }

          return new Response("not found", { status: 404 });
        })
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(400);

    const payload = assertApiError(await readJsonValue(response));

    expect(payload.error.code).toBe("bad_request");
    expect(payload.error.details).toEqual({
      header: "Idempotency-Key",
      route: "POST:/v1/projects"
    });
  });

  it("replays idempotent POST responses without calling the downstream service twice", async () => {
    const memoryStore = new MemoryIdempotencyStore();
    const worker = createApiEdgeApp({
      idempotencyStore: memoryStore
    });
    let projectInvocationCount = 0;

    const env: ApiEdgeEnv = {
      APP_NAME: "api-edge",
      ENVIRONMENT: "local",
      IDENTITY: createServiceBinding((request) => {
        const url = new URL(request.url);

        if (url.pathname === "/internal/auth/resolve") {
          return new Response(
            JSON.stringify(
              createSuccessResponse(
                {
                  actor: {
                    id: "usr_123",
                    type: "user"
                  },
                  organizationId: "org_123",
                  sessionId: "ses_123"
                },
                {
                  requestId: request.headers.get("x-sourceplane-request-id") ?? "req_missing"
                }
              )
            ),
            {
              headers: {
                "content-type": "application/json; charset=utf-8"
              }
            }
          );
        }

        return new Response("not found", { status: 404 });
      }),
      PROJECTS: createServiceBinding((request) => {
        projectInvocationCount += 1;

        const requestId = request.headers.get("x-sourceplane-request-id") ?? "req_missing";

        return new Response(
          JSON.stringify(
            createSuccessResponse(
              {
                ok: true,
                projectId: "prj_123"
              },
              {
                requestId
              }
            )
          ),
          {
            headers: {
              "content-type": "application/json; charset=utf-8"
            }
          }
        );
      })
    };

    const request = new Request("https://api.sourceplane.test/v1/projects", {
      body: JSON.stringify({
        name: "Acme API"
      }),
      headers: {
        authorization: "Bearer edge-test-token",
        "content-type": "application/json",
        "Idempotency-Key": "idem_123"
      },
      method: "POST"
    });

    const firstResponse = await worker.fetch(request.clone(), env, executionContext);
    const secondResponse = await worker.fetch(request.clone(), env, executionContext);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers.get("x-sourceplane-idempotent-replay")).toBe("true");
    expect(projectInvocationCount).toBe(1);

    const firstPayload = assertApiSuccessEnvelope(await readJsonValue(firstResponse), isProjectResultData);
    const secondPayload = assertApiSuccessEnvelope(await readJsonValue(secondResponse), isProjectResultData);

    expect(firstPayload.data).toEqual({
      ok: true,
      projectId: "prj_123"
    });
    expect(secondPayload.data).toEqual({
      ok: true,
      projectId: "prj_123"
    });
    expect(firstPayload.meta.requestId).not.toBe(secondPayload.meta.requestId);
  });

  it("fails predictably when a downstream binding is missing", async () => {
    const response = await createApiEdgeApp().fetch(
      new Request("https://api.sourceplane.test/v1/resources"),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local"
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(501);

    const payload = assertApiError(await readJsonValue(response));

    expect(payload.error.code).toBe("unsupported");
    expect(payload.error.details).toEqual({
      binding: "RESOURCES"
    });
    expect(payload.error.message).toBe("The RESOURCES service binding is not configured for this environment.");
  });

  it("returns forbidden when the real policy worker denies a mutating request", async () => {
    const worker = createApiEdgeApp();
    const policyEnv = createPolicyWorkerTestEnv();

    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/v1/projects", {
        body: JSON.stringify({
          name: "Denied Project"
        }),
        headers: {
          authorization: "Bearer edge-test-token",
          "content-type": "application/json"
        },
        method: "POST"
      }),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        IDENTITY: createServiceBinding((request) => {
          const url = new URL(request.url);

          if (url.pathname !== "/internal/auth/resolve" || request.method !== "POST") {
            return new Response("not found", { status: 404 });
          }

          return new Response(
            JSON.stringify(
              createSuccessResponse(
                {
                  actor: {
                    id: "usr_123",
                    type: "user"
                  },
                  organizationId: "org_123",
                  sessionId: "ses_123"
                },
                {
                  requestId: request.headers.get("x-sourceplane-request-id") ?? "req_missing"
                }
              )
            ),
            {
              headers: {
                "content-type": "application/json; charset=utf-8"
              }
            }
          );
        }),
        POLICY: createServiceBinding((request) => policyWorker.fetch(request, policyEnv, executionContext))
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(403);

    const payload = assertApiError(await readJsonValue(response));

    expect(payload.error.code).toBe("forbidden");
    expect(payload.error.message).toBe("The authenticated actor is not allowed to perform this action.");
    expect(payload.error.details).toEqual({
      policyVersion: 1,
      reason: "deny.no_matching_membership"
    });
  });

  it("allows a mutating request when a realistic policy binding returns an allow decision", async () => {
    const worker = createApiEdgeApp({
      idempotencyStore: new MemoryIdempotencyStore()
    });

    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/v1/projects", {
        body: JSON.stringify({
          name: "Allowed Project"
        }),
        headers: {
          authorization: "Bearer edge-test-token",
          "content-type": "application/json",
          "Idempotency-Key": "idem_policy_allow"
        },
        method: "POST"
      }),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        IDENTITY: createServiceBinding((request) => {
          const url = new URL(request.url);

          if (url.pathname !== "/internal/auth/resolve" || request.method !== "POST") {
            return new Response("not found", { status: 404 });
          }

          return new Response(
            JSON.stringify(
              createSuccessResponse(
                {
                  actor: {
                    id: "usr_123",
                    type: "user"
                  },
                  organizationId: "org_123",
                  sessionId: "ses_123"
                },
                {
                  requestId: request.headers.get("x-sourceplane-request-id") ?? "req_missing"
                }
              )
            ),
            {
              headers: {
                "content-type": "application/json; charset=utf-8"
              }
            }
          );
        }),
        POLICY: createServiceBinding(async (request) => {
          const payload = authorizationRequestSchema.parse(await readJsonValue(request));

          expect(payload).toEqual({
            action: "project.create",
            context: {
              attributes: {
                method: "POST",
                routeGroup: "/v1/projects",
                subpath: "/"
              },
              memberships: []
            },
            resource: {
              environmentId: null,
              id: "org_123",
              kind: "project",
              orgId: "org_123",
              projectId: null
            },
            subject: {
              id: "usr_123",
              type: "user"
            }
          });

          return new Response(
            JSON.stringify(
              createSuccessResponse(
                {
                  allow: true,
                  reason: "allow.stub.project_create",
                  policyVersion: 1,
                  derivedScope: {
                    orgId: "org_123"
                  }
                },
                {
                  requestId: request.headers.get("x-sourceplane-request-id") ?? "req_missing"
                }
              )
            ),
            {
              headers: {
                "content-type": "application/json; charset=utf-8"
              }
            }
          );
        }),
        PROJECTS: createServiceBinding((request) => {
          const requestId = request.headers.get("x-sourceplane-request-id") ?? "req_missing";

          return new Response(
            JSON.stringify(
              createSuccessResponse(
                {
                  ok: true,
                  projectId: "prj_policy_allow"
                },
                {
                  requestId
                }
              )
            ),
            {
              headers: {
                "content-type": "application/json; charset=utf-8"
              }
            }
          );
        })
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(200);

    const payload = assertApiSuccessEnvelope(await readJsonValue(response), isProjectResultData);

    expect(payload.data).toEqual({
      ok: true,
      projectId: "prj_policy_allow"
    });
  });

  it("uses real membership facts to allow owners and deny viewers on organization updates", async () => {
    const identityHarness = await createIdentityWorkerTestHarness();
    const membershipHarness = await createMembershipWorkerTestHarness(identityHarness.env);
    const worker = createApiEdgeApp({
      idempotencyStore: new MemoryIdempotencyStore()
    });

    try {
      const env: ApiEdgeEnv = {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        IDENTITY: createServiceBinding((request) => identityWorker.fetch(request, identityHarness.env, executionContext)),
        MEMBERSHIP: createServiceBinding((request) => membershipWorker.fetch(request, membershipHarness.env, executionContext)),
        POLICY: createServiceBinding((request) => policyWorker.fetch(request, createPolicyWorkerTestEnv(), executionContext))
      };

      const ownerSession = await createEdgeInteractiveSession(worker, env, "owner@example.com");
      const viewerSession = await createEdgeInteractiveSession(worker, env, "viewer@example.com");

      const createOrganizationResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/organizations", {
          body: JSON.stringify({
            name: "Acme Platform"
          }),
          headers: {
            authorization: `Bearer ${ownerSession.token}`,
            "content-type": "application/json",
            "Idempotency-Key": "idem_membership_org_create"
          },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(createOrganizationResponse.status).toBe(200);

      const createOrganizationPayload = assertApiSuccessEnvelope(await readJsonValue(createOrganizationResponse), isRecord);
      const createdOrganization = createOrganizationResponseSchema.parse(createOrganizationPayload.data);

      const ownerUpdateResponse = await worker.fetch(
        new Request(`https://api.sourceplane.test/v1/organizations/${createdOrganization.organization.id}`, {
          body: JSON.stringify({
            name: "Acme Platform Renamed"
          }),
          headers: {
            authorization: `Bearer ${ownerSession.token}`,
            "content-type": "application/json"
          },
          method: "PATCH"
        }),
        env,
        executionContext
      );

      expect(ownerUpdateResponse.status).toBe(200);

      const ownerUpdatePayload = assertApiSuccessEnvelope(await readJsonValue(ownerUpdateResponse), isRecord);
      const updatedOrganization = updateOrganizationResponseSchema.parse(ownerUpdatePayload.data);

      expect(updatedOrganization.organization.createdAt).toBe(createdOrganization.organization.createdAt);
      expect(updatedOrganization.organization.id).toBe(createdOrganization.organization.id);
      expect(updatedOrganization.organization.name).toBe("Acme Platform Renamed");
      expect(updatedOrganization.organization.slug).toBe(createdOrganization.organization.slug);
      expect(typeof updatedOrganization.organization.updatedAt).toBe("string");

      const createInviteResponse = await worker.fetch(
        new Request(`https://api.sourceplane.test/v1/organizations/${createdOrganization.organization.id}/invites`, {
          body: JSON.stringify({
            email: "viewer@example.com",
            role: "viewer"
          }),
          headers: {
            authorization: `Bearer ${ownerSession.token}`,
            "content-type": "application/json",
            "Idempotency-Key": "idem_membership_invite_create"
          },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(createInviteResponse.status).toBe(200);

      const createInvitePayload = assertApiSuccessEnvelope(await readJsonValue(createInviteResponse), isRecord);
      const createdInvite = createOrganizationInviteResponseSchema.parse(createInvitePayload.data);
      const inviteToken = createdInvite.delivery.mode === "local_debug" ? createdInvite.delivery.acceptToken : null;

      if (!inviteToken) {
        throw new Error("Expected local_debug invite delivery during tests.");
      }

      const acceptInviteResponse = await worker.fetch(
        new Request(`https://api.sourceplane.test/v1/organizations/invites/${createdInvite.invite.id}/accept`, {
          body: JSON.stringify({
            token: inviteToken
          }),
          headers: {
            authorization: `Bearer ${viewerSession.token}`,
            "content-type": "application/json",
            "Idempotency-Key": "idem_membership_invite_accept"
          },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(acceptInviteResponse.status).toBe(200);

      const acceptInvitePayload = assertApiSuccessEnvelope(await readJsonValue(acceptInviteResponse), isRecord);
      expect(acceptOrganizationInviteResponseSchema.parse(acceptInvitePayload.data)).toMatchObject({
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

      const viewerUpdateResponse = await worker.fetch(
        new Request(`https://api.sourceplane.test/v1/organizations/${createdOrganization.organization.id}`, {
          body: JSON.stringify({
            name: "Viewer Attempt"
          }),
          headers: {
            authorization: `Bearer ${viewerSession.token}`,
            "content-type": "application/json"
          },
          method: "PATCH"
        }),
        env,
        executionContext
      );

      expect(viewerUpdateResponse.status).toBe(403);

      const viewerUpdatePayload = assertApiError(await readJsonValue(viewerUpdateResponse));

      expect(viewerUpdatePayload.error.code).toBe("forbidden");
      expect(viewerUpdatePayload.error.details).toEqual({
        policyVersion: 1,
        reason: "deny.action_not_permitted"
      });
    } finally {
      membershipHarness.close();
      identityHarness.close();
    }
  });

  it("allows an organization owner to create a project with environments through the real edge stack", async () => {
    const identityHarness = await createIdentityWorkerTestHarness();
    const membershipHarness = await createMembershipWorkerTestHarness(identityHarness.env);
    const projectsHarness = await createProjectsWorkerTestHarness();
    const worker = createApiEdgeApp({
      idempotencyStore: new MemoryIdempotencyStore()
    });

    try {
      const env: ApiEdgeEnv = {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        IDENTITY: createServiceBinding((request) => identityWorker.fetch(request, identityHarness.env, executionContext)),
        MEMBERSHIP: createServiceBinding((request) => membershipWorker.fetch(request, membershipHarness.env, executionContext)),
        POLICY: createServiceBinding((request) => policyWorker.fetch(request, createPolicyWorkerTestEnv(), executionContext)),
        PROJECTS: createServiceBinding((request) => projectsWorker.fetch(request, projectsHarness.env, executionContext))
      };

      const ownerSession = await createEdgeInteractiveSession(worker, env, "owner@example.com");
      const viewerSession = await createEdgeInteractiveSession(worker, env, "viewer@example.com");

      const createOrganizationResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/organizations", {
          body: JSON.stringify({ name: "Apollo Labs" }),
          headers: {
            authorization: `Bearer ${ownerSession.token}`,
            "content-type": "application/json",
            "Idempotency-Key": "idem_projects_org_create"
          },
          method: "POST"
        }),
        env,
        executionContext
      );
      expect(createOrganizationResponse.status).toBe(200);
      const createOrgPayload = assertApiSuccessEnvelope(await readJsonValue(createOrganizationResponse), isRecord);
      const createdOrg = createOrganizationResponseSchema.parse(createOrgPayload.data);

      const createProjectResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/projects", {
          body: JSON.stringify({ name: "Apollo API" }),
          headers: {
            authorization: `Bearer ${ownerSession.token}`,
            "content-type": "application/json",
            "Idempotency-Key": "idem_projects_project_create",
            "x-sourceplane-org-id": createdOrg.organization.id
          },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(createProjectResponse.status, await createProjectResponse.clone().text()).toBe(200);
      const createProjectPayload = assertApiSuccessEnvelope(await readJsonValue(createProjectResponse), isRecord);
      const createdProject = createProjectResponseSchema.parse(createProjectPayload.data);
      expect(createdProject.project.organizationId).toBe(createdOrg.organization.id);
      expect(createdProject.project.slug).toBe("apollo-api");
      expect(createdProject.environments.map((e) => e.slug)).toEqual(["development"]);

      const createStagingResponse = await worker.fetch(
        new Request(
          `https://api.sourceplane.test/v1/projects/${createdProject.project.id}/environments`,
          {
            body: JSON.stringify({ name: "Staging" }),
            headers: {
              authorization: `Bearer ${ownerSession.token}`,
              "content-type": "application/json",
              "Idempotency-Key": "idem_projects_env_create",
              "x-sourceplane-org-id": createdOrg.organization.id
            },
            method: "POST"
          }
        ),
        env,
        executionContext
      );

      expect(createStagingResponse.status).toBe(200);
      const createStagingPayload = assertApiSuccessEnvelope(await readJsonValue(createStagingResponse), isRecord);
      const createdStaging = createEnvironmentResponseSchema.parse(createStagingPayload.data);
      expect(createdStaging.environment.projectId).toBe(createdProject.project.id);
      expect(createdStaging.environment.slug).toBe("staging");

      const listEnvsResponse = await worker.fetch(
        new Request(
          `https://api.sourceplane.test/v1/projects/${createdProject.project.id}/environments`,
          {
            headers: {
              authorization: `Bearer ${ownerSession.token}`,
              "x-sourceplane-org-id": createdOrg.organization.id
            }
          }
        ),
        env,
        executionContext
      );
      expect(listEnvsResponse.status).toBe(200);
      const listEnvsPayload = assertApiSuccessEnvelope(await readJsonValue(listEnvsResponse), isRecord);
      const listedEnvs = listEnvironmentsResponseSchema.parse(listEnvsPayload.data);
      expect(listedEnvs.environments.map((e) => e.slug).sort()).toEqual(["development", "staging"]);

      const viewerCreateResponse = await worker.fetch(
        new Request("https://api.sourceplane.test/v1/projects", {
          body: JSON.stringify({ name: "Forbidden Project" }),
          headers: {
            authorization: `Bearer ${viewerSession.token}`,
            "content-type": "application/json",
            "Idempotency-Key": "idem_projects_viewer_denied",
            "x-sourceplane-org-id": createdOrg.organization.id
          },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(viewerCreateResponse.status).toBe(403);
      expect(isApiErrorEnvelope(await readJsonValue(viewerCreateResponse))).toBe(true);
    } finally {
      projectsHarness.close();
      membershipHarness.close();
      identityHarness.close();
    }
  });
});
