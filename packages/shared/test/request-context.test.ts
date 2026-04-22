import { describe, expect, it } from "vitest";

import { createRequestContext } from "@sourceplane/shared";

describe("createRequestContext", () => {
  it("generates a fresh request id for public requests", () => {
    const request = new Request("https://sourceplane.test/v1/resources", {
      headers: {
        "Idempotency-Key": "idem_test",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
        "x-sourceplane-request-id": "req_existing"
      }
    });

    const context = createRequestContext(request);

    expect(context.idempotencyKey).toBe("idem_test");
    expect(context.requestId).toMatch(/^req_[a-f0-9]{20}$/);
    expect(context.requestId).not.toBe("req_existing");
    expect(context.traceparent).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00");
  });

  it("reuses trusted internal request ids when explicitly configured", () => {
    const request = new Request("https://sourceplane.test/internal/ping", {
      headers: {
        "x-sourceplane-request-id": "req_existing"
      }
    });

    expect(createRequestContext(request, { trustRequestId: true }).requestId).toBe("req_existing");
  });
});
