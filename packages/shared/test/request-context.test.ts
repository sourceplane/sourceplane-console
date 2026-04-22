import { describe, expect, it } from "vitest";

import { createRequestContext } from "@sourceplane/shared";

describe("createRequestContext", () => {
  it("reuses inbound tracing headers when present", () => {
    const request = new Request("https://sourceplane.test/v1/resources", {
      headers: {
        "Idempotency-Key": "idem_test",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
        "x-sourceplane-request-id": "req_existing"
      }
    });

    expect(createRequestContext(request)).toEqual({
      idempotencyKey: "idem_test",
      requestId: "req_existing",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
    });
  });
});
