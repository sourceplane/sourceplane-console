import { createSuccessResponse, internalOrgIdHeaderName } from "@sourceplane/contracts";
import { SourceplaneHttpError } from "@sourceplane/shared";
import { describe, expect, it, vi } from "vitest";

import { generateIdempotencyKey, SourceplaneClient } from "../src/index.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function createRecordingFetch(responder: (request: CapturedRequest) => unknown): {
  fetch: typeof fetch;
  calls: CapturedRequest[];
} {
  const calls: CapturedRequest[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof URL ? input.toString() : input instanceof Request ? input.url : input;
    const headerEntries: [string, string][] = [];
    if (init?.headers instanceof Headers) {
      init.headers.forEach((value, key) => headerEntries.push([key, value]));
    } else if (Array.isArray(init?.headers)) {
      headerEntries.push(...init.headers);
    } else if (init?.headers) {
      for (const [key, value] of Object.entries(init.headers)) {
        headerEntries.push([key, String(value)]);
      }
    }
    const captured: CapturedRequest = {
      url,
      method: init?.method ?? "GET",
      headers: Object.fromEntries(headerEntries.map(([k, v]) => [k.toLowerCase(), v])),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body
    };
    calls.push(captured);
    const responseValue = responder(captured);
    if (responseValue instanceof Response) {
      return Promise.resolve(responseValue);
    }
    return Promise.resolve(
      new Response(JSON.stringify(responseValue), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
  });
  return { fetch: fetchMock, calls };
}

describe("SourceplaneClient", () => {
  it("injects bearer token, content-type, and active org id on requests", async () => {
    const { fetch: fetchMock, calls } = createRecordingFetch(() =>
      createSuccessResponse({ projects: [] }, { requestId: "req_test" })
    );
    const client = new SourceplaneClient({
      baseUrl: "https://api.sourceplane.test",
      fetch: fetchMock,
      token: "tok_abc",
      activeOrgId: "org_active"
    });

    await client.projects.list();

    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) throw new Error("no call");
    expect(call.url).toBe("https://api.sourceplane.test/v1/projects");
    expect(call.headers.authorization).toBe("Bearer tok_abc");
    expect(call.headers[internalOrgIdHeaderName]).toBe("org_active");
  });

  it("returns parsed envelope data (not the wrapper) on success", async () => {
    const { fetch: fetchMock } = createRecordingFetch(() =>
      createSuccessResponse(
        { organizations: [{ createdAt: "2025-01-01T00:00:00.000Z", id: "org_1", joinedAt: "2025-01-01T00:00:00.000Z", memberId: "mem_1", name: "Acme", role: "owner" as const, slug: "acme", updatedAt: "2025-01-01T00:00:00.000Z" }] },
        { requestId: "req_test" }
      )
    );
    const client = new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchMock, token: "tok" });

    const orgs = await client.organizations.list();
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.id).toBe("org_1");
  });

  it("throws SourceplaneHttpError on error envelopes", async () => {
    const { fetch: fetchMock } = createRecordingFetch(() => {
      return new Response(
        JSON.stringify({ error: { code: "forbidden", message: "denied", details: {}, requestId: "req_x" } }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    });
    const client = new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchMock, token: "tok" });

    await expect(client.organizations.list()).rejects.toBeInstanceOf(SourceplaneHttpError);
    await expect(client.organizations.list()).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("auth.loginStart does not send authorization header", async () => {
    const { fetch: fetchMock, calls } = createRecordingFetch(() =>
      createSuccessResponse(
        {
          challengeId: "ch_1",
          delivery: { mode: "local_debug", code: "123456", emailHint: "u@e.com" },
          expiresAt: "2099-01-01T00:00:00.000Z"
        },
        { requestId: "req_test" }
      )
    );
    const client = new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchMock, token: "tok" });

    await client.auth.loginStart({ email: "user@example.com" });
    expect(calls[0]?.headers.authorization).toBeUndefined();
    expect(calls[0]?.body).toEqual({ email: "user@example.com" });
  });

  it("withOrg sets the active org id used by subsequent calls", async () => {
    const { fetch: fetchMock, calls } = createRecordingFetch(() =>
      createSuccessResponse({ projects: [] }, { requestId: "req_test" })
    );
    const client = new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchMock, token: "tok" });
    client.withOrg("org_xyz");
    await client.projects.list();
    expect(calls[0]?.headers[internalOrgIdHeaderName]).toBe("org_xyz");
  });

  it("organizations.create includes Idempotency-Key header automatically", async () => {
    const { fetch: fetchMock, calls } = createRecordingFetch(() =>
      createSuccessResponse(
        {
          membership: {
            createdAt: "2025-01-01T00:00:00.000Z",
            id: "mem_1",
            organizationId: "org_1",
            role: "owner",
            updatedAt: "2025-01-01T00:00:00.000Z",
            userId: "usr_1"
          },
          organization: {
            createdAt: "2025-01-01T00:00:00.000Z",
            id: "org_1",
            name: "Acme",
            slug: "acme",
            updatedAt: "2025-01-01T00:00:00.000Z"
          }
        },
        { requestId: "req_test" }
      )
    );
    const client = new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchMock, token: "tok" });
    await client.organizations.create({ name: "Acme" });
    expect(calls[0]?.headers["idempotency-key"]).toMatch(/^org_/);
  });

  it("projects.environments.create posts to nested path with org context", async () => {
    const { fetch: fetchMock, calls } = createRecordingFetch(() =>
      createSuccessResponse(
        {
          environment: {
            archivedAt: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            id: "env_1",
            lifecycleState: "active",
            name: "Staging",
            organizationId: "org_1",
            projectId: "prj_1",
            slug: "staging",
            updatedAt: "2025-01-01T00:00:00.000Z"
          }
        },
        { requestId: "req_test" }
      )
    );
    const client = new SourceplaneClient({
      baseUrl: "https://api.sourceplane.test",
      fetch: fetchMock,
      token: "tok",
      activeOrgId: "org_1"
    });
    await client.projects.environments.create("prj_1", { name: "Staging" });
    expect(calls[0]?.url).toBe("https://api.sourceplane.test/v1/projects/prj_1/environments");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.headers[internalOrgIdHeaderName]).toBe("org_1");
  });

  it("organizations.invites.accept does not require an active org", async () => {
    const { fetch: fetchMock, calls } = createRecordingFetch(() =>
      createSuccessResponse(
        {
          invite: {
            acceptedAt: "2025-01-01T00:00:00.000Z",
            createdAt: "2025-01-01T00:00:00.000Z",
            email: "u@e.com",
            expiresAt: "2099-01-01T00:00:00.000Z",
            id: "inv_1",
            organizationId: "org_1",
            revokedAt: null,
            role: "viewer",
            status: "accepted"
          },
          membership: {
            createdAt: "2025-01-01T00:00:00.000Z",
            id: "mem_1",
            organizationId: "org_1",
            role: "viewer",
            updatedAt: "2025-01-01T00:00:00.000Z",
            userId: "usr_1"
          },
          organization: {
            createdAt: "2025-01-01T00:00:00.000Z",
            id: "org_1",
            name: "Acme",
            slug: "acme",
            updatedAt: "2025-01-01T00:00:00.000Z"
          }
        },
        { requestId: "req_test" }
      )
    );
    const client = new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchMock, token: "tok" });
    await client.organizations.invites.accept("inv_1", "tok_abc");
    expect(calls[0]?.url).toBe("https://api.sourceplane.test/v1/organizations/invites/inv_1/accept");
    expect(calls[0]?.body).toEqual({ token: "tok_abc" });
  });

  it("auth.session uses GET on /v1/auth/session with bearer token", async () => {
    const { fetch: fetchMock, calls } = createRecordingFetch(() =>
      createSuccessResponse({ authenticated: false, session: null, user: null }, { requestId: "req_test" })
    );
    const client = new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchMock, token: "tok" });
    await client.auth.session();
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe("https://api.sourceplane.test/v1/auth/session");
    expect(calls[0]?.headers.authorization).toBe("Bearer tok");
  });
});

describe("generateIdempotencyKey", () => {
  it("returns a value starting with the provided prefix", () => {
    expect(generateIdempotencyKey("prj")).toMatch(/^prj_[a-f0-9]+$/);
  });
});
