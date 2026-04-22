import { describe, expect, it, vi } from "vitest";

import { SourceplaneClient } from "../src/client.js";

describe("SourceplaneClient", () => {
  it("requests route groups from the public API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { groups: ["/v1/auth"] },
          meta: { cursor: null, requestId: "req_test" }
        }),
        { status: 200 }
      )
    );

    const client = new SourceplaneClient({
      baseUrl: "https://api.sourceplane.test",
      fetch: fetchMock
    });

    await expect(client.listRouteGroups()).resolves.toEqual({
      data: { groups: ["/v1/auth"] },
      meta: { cursor: null, requestId: "req_test" }
    });
  });
});
