import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { SourceplaneClient } from "@sourceplane/sdk";

import { Providers } from "../src/app/providers.js";
import { OrgsIndexRoute } from "../src/routes/orgs/index.js";
import { OrgProjectsRoute } from "../src/routes/orgs/projects.js";
import { ProjectEnvironmentsRoute } from "../src/routes/orgs/project-environments.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data: body, meta: { cursor: null, requestId: "req_x" } }), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function makeClient(handler: (path: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  });
  return new SourceplaneClient({
    baseUrl: "http://api.test",
    fetch: fetchMock as unknown as typeof fetch,
    token: "t_test"
  });
}

describe("OrgsIndexRoute", () => {
  it("renders organizations the user belongs to", async () => {
    const client = makeClient(async (path) => {
      if (path.includes("/v1/organizations")) {
        return jsonResponse({
          organizations: [
            {
              id: "org_1",
              name: "Acme",
              slug: "acme",
              role: "owner",
              createdAt: "2030-01-01T00:00:00.000Z",
              updatedAt: "2030-01-01T00:00:00.000Z"
            }
          ]
        });
      }
      throw new Error(`Unexpected path ${path}`);
    });

    render(
      <MemoryRouter>
        <Providers client={client}>
          <OrgsIndexRoute />
        </Providers>
      </MemoryRouter>
    );

    expect(await screen.findByRole("link", { name: "Acme" })).toBeInTheDocument();
  });
});

describe("OrgProjectsRoute", () => {
  it("submits a create project mutation", async () => {
    const created: string[] = [];
    const client = makeClient(async (path, init) => {
      if (path.endsWith("/v1/projects") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        created.push(body.name);
        return jsonResponse({
          project: {
            id: "proj_1",
            organizationId: "org_1",
            name: body.name,
            slug: "demo",
            createdAt: "2030-01-01T00:00:00.000Z",
            updatedAt: "2030-01-01T00:00:00.000Z",
            archivedAt: null
          },
          environments: []
        });
      }
      if (path.includes("/v1/projects")) {
        return jsonResponse({ projects: [] });
      }
      throw new Error(`Unexpected path ${path}`);
    });

    render(
      <MemoryRouter initialEntries={["/orgs/org_1/projects"]}>
        <Providers client={client}>
          <Routes>
            <Route path="/orgs/:orgId/projects" element={<OrgProjectsRoute />} />
          </Routes>
        </Providers>
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: /create project/i }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/project name/i);
    await userEvent.click(input);
    await userEvent.paste("Demo");
    await userEvent.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await vi.waitFor(() => expect(created).toEqual(["Demo"]));
  });
});

describe("ProjectEnvironmentsRoute", () => {
  it("lists environments for the active project", async () => {
    const client = makeClient(async (path) => {
      if (path.includes("/v1/projects/proj_1/environments")) {
        return jsonResponse({
          environments: [
            {
              id: "env_1",
              projectId: "proj_1",
              organizationId: "org_1",
              name: "Development",
              slug: "development",
              lifecycleState: "active",
              createdAt: "2030-01-01T00:00:00.000Z",
              updatedAt: "2030-01-01T00:00:00.000Z"
            }
          ]
        });
      }
      throw new Error(`Unexpected path ${path}`);
    });

    render(
      <MemoryRouter initialEntries={["/orgs/org_1/projects/proj_1/environments"]}>
        <Providers client={client}>
          <Routes>
            <Route
              path="/orgs/:orgId/projects/:projectId/environments"
              element={<ProjectEnvironmentsRoute />}
            />
          </Routes>
        </Providers>
      </MemoryRouter>
    );

    expect(await screen.findByText("Development")).toBeInTheDocument();
  });
});
