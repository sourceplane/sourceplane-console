import { describe, expect, it } from "vitest";

import { isApiErrorEnvelope, type ApiErrorEnvelope, type ApiSuccessEnvelope, createSuccessResponse } from "@sourceplane/contracts";
import { createApiEdgeApp, type ApiEdgeEnv } from "@sourceplane/api-edge";
import identityWorker, { type IdentityWorkerEnv } from "@sourceplane/identity-worker";
import { createServiceBinding } from "@sourceplane/testing";

import { MemoryIdempotencyStore } from "../src/testing/memory-idempotency-store.js";

const executionContext: ExecutionContext = {
  passThroughOnException(): void {},
  waitUntil(promise: Promise<unknown>): void {
    void promise;
  }
};

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
    const worker = createApiEdgeApp();
    const env: ApiEdgeEnv = {
      APP_NAME: "api-edge",
      ENVIRONMENT: "local",
      IDENTITY: createServiceBinding((request) =>
        identityWorker.fetch(
          request,
          {
            APP_NAME: "identity-worker",
            ENVIRONMENT: "local"
          } satisfies IdentityWorkerEnv,
          executionContext
        )
      )
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
});
