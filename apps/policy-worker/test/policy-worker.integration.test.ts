import { describe, expect, it } from "vitest";

import type { ApiErrorEnvelope, ApiSuccessEnvelope, AuthorizationResponse } from "@sourceplane/contracts";

import { createPolicyWorkerApp, type PolicyWorkerEnv } from "../src/index.js";

const executionContext: ExecutionContext = {
  passThroughOnException(): void {},
  waitUntil(promise: Promise<unknown>): void {
    void promise;
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertSuccessEnvelope<TData>(value: unknown): ApiSuccessEnvelope<TData> {
  if (!isRecord(value) || !isRecord(value.meta) || !("data" in value)) {
    throw new Error("Expected a success envelope.");
  }

  return value as ApiSuccessEnvelope<TData>;
}

function assertErrorEnvelope(value: unknown): ApiErrorEnvelope {
  if (!isRecord(value) || !isRecord(value.error)) {
    throw new Error("Expected an error envelope.");
  }

  return value as ApiErrorEnvelope;
}

async function readJson(response: Response): Promise<unknown> {
  return JSON.parse(await response.text()) as unknown;
}

describe("policy worker", () => {
  it("serves health and ping endpoints", async () => {
    const worker = createPolicyWorkerApp();
    const env: PolicyWorkerEnv = {
      APP_NAME: "policy-worker",
      ENVIRONMENT: "local"
    };

    const healthResponse = await worker.fetch(new Request("https://policy.sourceplane.test/healthz"), env, executionContext);
    const pingResponse = await worker.fetch(
      new Request("https://policy.sourceplane.test/internal/ping", {
        headers: {
          traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
          "x-sourceplane-request-id": "req_forwarded"
        }
      }),
      env,
      executionContext
    );

    expect(healthResponse.status).toBe(200);
    expect(assertSuccessEnvelope(await readJson(healthResponse)).data).toEqual({
      environment: "local",
      ok: true,
      service: "policy-worker"
    });

    expect(pingResponse.status).toBe(200);
    expect(assertSuccessEnvelope(await readJson(pingResponse)).data).toEqual({
      ok: true,
      receivedRequestId: "req_forwarded",
      receivedTraceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
      service: "policy-worker",
      stage: "local"
    });
  });

  it("returns deterministic allow and deny decisions through /internal/authorize", async () => {
    const worker = createPolicyWorkerApp();
    const env: PolicyWorkerEnv = {
      APP_NAME: "policy-worker",
      ENVIRONMENT: "local"
    };

    const allowResponse = await worker.fetch(
      new Request("https://policy.sourceplane.test/internal/authorize", {
        body: JSON.stringify({
          subject: {
            id: "usr_123",
            type: "user"
          },
          action: "resource.update",
          resource: {
            kind: "resource",
            id: "res_123",
            orgId: "org_123",
            projectId: "prj_123",
            environmentId: "env_123"
          },
          context: {
            memberships: [
              {
                kind: "role_assignment",
                role: "builder",
                scope: {
                  kind: "organization",
                  orgId: "org_123"
                }
              }
            ],
            attributes: {
              routeGroup: "/v1/resources"
            }
          }
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      executionContext
    );

    const denyResponse = await worker.fetch(
      new Request("https://policy.sourceplane.test/internal/authorize", {
        body: JSON.stringify({
          subject: {
            id: "usr_123",
            type: "user"
          },
          action: "resource.update",
          resource: {
            kind: "resource",
            id: "res_123",
            orgId: "org_123",
            projectId: "prj_123",
            environmentId: "env_123"
          },
          context: {
            memberships: [],
            attributes: {}
          }
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      executionContext
    );

    expect(allowResponse.status).toBe(200);
    expect(assertSuccessEnvelope<AuthorizationResponse>(await readJson(allowResponse)).data).toEqual({
      allow: true,
      reason: "allow.role.builder",
      policyVersion: 1,
      derivedScope: {
        orgId: "org_123",
        projectId: "prj_123",
        environmentId: "env_123",
        resourceId: "res_123"
      }
    });

    expect(denyResponse.status).toBe(200);
    expect(assertSuccessEnvelope<AuthorizationResponse>(await readJson(denyResponse)).data).toEqual({
      allow: false,
      reason: "deny.no_matching_membership",
      policyVersion: 1,
      derivedScope: {
        orgId: "org_123",
        projectId: "prj_123",
        environmentId: "env_123",
        resourceId: "res_123"
      }
    });
  });

  it("returns validation errors without leaking implementation details", async () => {
    const worker = createPolicyWorkerApp();
    const env: PolicyWorkerEnv = {
      APP_NAME: "policy-worker",
      ENVIRONMENT: "local"
    };

    const response = await worker.fetch(
      new Request("https://policy.sourceplane.test/internal/authorize", {
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
      env,
      executionContext
    );

    expect(response.status).toBe(400);

    const payload = assertErrorEnvelope(await readJson(response));

    expect(payload.error.code).toBe("validation_failed");
    expect(payload.error.message).toBe("The request payload is invalid.");
    expect(payload.error.details).toEqual({
      issues: [
        {
          message: "Invalid enum value. Expected 'user' | 'service_principal' | 'workflow' | 'system', received 'service'",
          path: "subject.type"
        },
        {
          message: "Required",
          path: "action"
        },
        {
          message: "Required",
          path: "resource"
        },
        {
          message: "Required",
          path: "context"
        }
      ]
    });
  });
});