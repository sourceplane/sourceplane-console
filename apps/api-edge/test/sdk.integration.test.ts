import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createApiEdgeApp, type ApiEdgeEnv } from "@sourceplane/api-edge";
import { SourceplaneClient } from "@sourceplane/sdk";
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

async function buildEnv(extra: Partial<ApiEdgeEnv> = {}): Promise<{ env: ApiEdgeEnv; close(): void }> {
  const identityDb = createTestD1Database();
  await applyD1Migrations(identityDb.binding, identityMigrationsDirectory);
  const identityEnv: IdentityWorkerEnv = {
    APP_NAME: "identity-worker",
    ENVIRONMENT: "local",
    IDENTITY_DB: identityDb.binding,
    IDENTITY_TOKEN_HASH_SECRET: "identity-test-secret"
  };

  const membershipDb = createTestD1Database();
  await applyD1Migrations(membershipDb.binding, membershipMigrationsDirectory);
  const membershipEnv: MembershipWorkerEnv = {
    APP_NAME: "membership-worker",
    ENVIRONMENT: "local",
    IDENTITY: createServiceBinding((req) => identityWorker.fetch(req, identityEnv, executionContext)),
    MEMBERSHIP_DB: membershipDb.binding,
    MEMBERSHIP_TOKEN_HASH_SECRET: "membership-test-secret"
  };

  const projectsDb = createTestD1Database();
  await applyD1Migrations(projectsDb.binding, projectsMigrationsDirectory);
  const projectsEnv: ProjectsWorkerEnv = {
    APP_NAME: "projects-worker",
    ENVIRONMENT: "local",
    PROJECTS_DB: projectsDb.binding
  };

  const policyEnv: PolicyWorkerEnv = { APP_NAME: "policy-worker", ENVIRONMENT: "local" };

  const env: ApiEdgeEnv = {
    APP_NAME: "api-edge",
    ENVIRONMENT: "local",
    IDENTITY: createServiceBinding((req) => identityWorker.fetch(req, identityEnv, executionContext)),
    MEMBERSHIP: createServiceBinding((req) => membershipWorker.fetch(req, membershipEnv, executionContext)),
    PROJECTS: createServiceBinding((req) => projectsWorker.fetch(req, projectsEnv, executionContext)),
    POLICY: createServiceBinding((req) => policyWorker.fetch(req, policyEnv, executionContext)),
    ...extra
  };

  return {
    env,
    close(): void {
      identityDb.close();
      membershipDb.close();
      projectsDb.close();
    }
  };
}

function buildSdkClient(worker: ReturnType<typeof createApiEdgeApp>, env: ApiEdgeEnv): SourceplaneClient {
  const fetchAgainstWorker = ((input: RequestInfo | URL, init?: RequestInit) =>
    worker.fetch(new Request(input, init), env, executionContext)) as unknown as typeof fetch;
  return new SourceplaneClient({ baseUrl: "https://api.sourceplane.test", fetch: fetchAgainstWorker });
}

describe("SDK happy-path against the live edge", () => {
  it("walks login → org → invite → accept → project → environment using the SDK", async () => {
    const harness = await buildEnv();
    const worker = createApiEdgeApp({ idempotencyStore: new MemoryIdempotencyStore() });

    try {
      const owner = buildSdkClient(worker, harness.env);

      const ownerStart = await owner.auth.loginStart({ email: "owner@example.com" });
      expect(ownerStart.delivery.mode).toBe("local_debug");
      const ownerCode = ownerStart.delivery.mode === "local_debug" ? ownerStart.delivery.code : "";
      const ownerLogin = await owner.auth.loginComplete({ challengeId: ownerStart.challengeId, code: ownerCode });
      owner.setToken(ownerLogin.session.token);

      const created = await owner.organizations.create({ name: "Acme Plane" });
      owner.withOrg(created.organization.id);

      const orgs = await owner.organizations.list();
      expect(orgs.some((o) => o.id === created.organization.id)).toBe(true);

      const invite = await owner.organizations.invites.create(created.organization.id, {
        email: "viewer@example.com",
        role: "viewer"
      });
      const acceptToken = invite.delivery.mode === "local_debug" ? invite.delivery.acceptToken : "";

      const viewer = buildSdkClient(worker, harness.env);
      const viewerStart = await viewer.auth.loginStart({ email: "viewer@example.com" });
      const viewerCode = viewerStart.delivery.mode === "local_debug" ? viewerStart.delivery.code : "";
      const viewerLogin = await viewer.auth.loginComplete({ challengeId: viewerStart.challengeId, code: viewerCode });
      viewer.setToken(viewerLogin.session.token);

      const accepted = await viewer.organizations.invites.accept(invite.invite.id, acceptToken);
      expect(accepted.organization.id).toBe(created.organization.id);

      const project = await owner.projects.create({ name: "Demo" });
      expect(project.environments.length).toBeGreaterThanOrEqual(1);

      const env = await owner.projects.environments.create(project.project.id, {
        name: "Staging",
        slug: "staging"
      });
      expect(env.environment.slug).toBe("staging");

      const projects = await owner.projects.list();
      expect(projects.some((p) => p.id === project.project.id)).toBe(true);

      const envs = await owner.projects.environments.list(project.project.id);
      expect(envs.length).toBeGreaterThanOrEqual(2);
    } finally {
      harness.close();
    }
  });
});

describe("CORS preflight and response headers", () => {
  it("answers OPTIONS preflight when the origin is allowlisted", async () => {
    const worker = createApiEdgeApp();
    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/v1/organizations", {
        method: "OPTIONS",
        headers: {
          origin: "https://console.sourceplane.test",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization, content-type"
        }
      }),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        WEB_CONSOLE_ORIGINS: "https://console.sourceplane.test, https://other.example"
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://console.sourceplane.test");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("ignores preflight from non-allowlisted origins", async () => {
    const worker = createApiEdgeApp();
    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/v1/organizations", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.example",
          "access-control-request-method": "POST"
        }
      }),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        WEB_CONSOLE_ORIGINS: "https://console.sourceplane.test"
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("attaches CORS headers to a normal response when origin is allowlisted", async () => {
    const worker = createApiEdgeApp();
    const response = await worker.fetch(
      new Request("https://api.sourceplane.test/healthz", {
        headers: { origin: "https://console.sourceplane.test" }
      }),
      {
        APP_NAME: "api-edge",
        ENVIRONMENT: "local",
        WEB_CONSOLE_ORIGINS: "https://console.sourceplane.test"
      } satisfies ApiEdgeEnv,
      executionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://console.sourceplane.test");
  });
});
