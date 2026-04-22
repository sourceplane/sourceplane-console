import { describe, expect, it } from "vitest";

import apiEdgeWorker, { type ApiEdgeEnv } from "@sourceplane/api-edge";
import identityWorker, { type IdentityWorkerEnv } from "@sourceplane/identity-worker";
import { createServiceBinding } from "@sourceplane/testing";

describe("api-edge service binding pattern", () => {
  it("forwards request IDs and trace context to the identity binding", async () => {
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
          {} as ExecutionContext
        )
      )
    };

    const response = await apiEdgeWorker.fetch(
      new Request("https://api.sourceplane.test/v1/auth/ping", {
        headers: {
          traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
        }
      }),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      data: {
        upstream: {
          data: {
            receivedRequestId: string;
            receivedTraceparent: string | null;
            service: string;
          };
        };
      };
      meta: {
        requestId: string;
      };
    };

    expect(payload.data.upstream.data.service).toBe("identity-worker");
    expect(payload.data.upstream.data.receivedTraceparent).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
    );
    expect(payload.data.upstream.data.receivedRequestId).toBe(payload.meta.requestId);
  });

  it("preserves upstream error status codes on auth ping", async () => {
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

    const response = await apiEdgeWorker.fetch(
      new Request("https://api.sourceplane.test/v1/auth/ping"),
      env,
      {} as ExecutionContext
    );

    expect(response.status).toBe(403);

    const payload = (await response.json()) as {
      error: {
        code: string;
        details: Record<string, unknown>;
        message: string;
        requestId: string;
      };
    };

    expect(payload.error.code).toBe("forbidden");
    expect(payload.error.details).toEqual({
      reason: "missing_session"
    });
    expect(payload.error.message).toBe("No active session.");
    expect(payload.error.requestId).toMatch(/^req_[a-f0-9]{20}$/);
  });
});
