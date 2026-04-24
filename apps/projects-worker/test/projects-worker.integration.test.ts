import { resolve } from "node:path";

import {
  createEnvironmentResponseSchema,
  createProjectResponseSchema,
  environmentLookupResponseSchema,
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalOrgIdHeaderName,
  internalSessionIdHeaderName,
  isApiErrorEnvelope,
  listEnvironmentsResponseSchema,
  listProjectsResponseSchema,
  projectLookupResponseSchema,
  type ApiSuccessEnvelope
} from "@sourceplane/contracts";
import { applyD1Migrations, createTestD1Database } from "@sourceplane/testing";
import { describe, expect, it } from "vitest";

import projectsWorker, { type ProjectsWorkerEnv } from "../src/index.js";

const executionContext: ExecutionContext = {
  passThroughOnException(): void {},
  waitUntil(promise: Promise<unknown>): void {
    void promise;
  }
};

const projectsMigrationsDirectory = resolve(import.meta.dirname, "..", "migrations");

const baseHeaders = (orgId: string, actorId = "usr_owner") => ({
  "content-type": "application/json",
  [internalActorIdHeaderName]: actorId,
  [internalActorTypeHeaderName]: "user",
  [internalOrgIdHeaderName]: orgId,
  [internalSessionIdHeaderName]: "ses_test"
});

async function createHarness(): Promise<{ close(): void; env: ProjectsWorkerEnv }> {
  const db = createTestD1Database();
  await applyD1Migrations(db.binding, projectsMigrationsDirectory);
  const env: ProjectsWorkerEnv = {
    APP_NAME: "projects-worker",
    ENVIRONMENT: "local",
    PROJECTS_DB: db.binding
  };
  return {
    close(): void {
      db.close();
    },
    env
  };
}

async function call<T>(promise: Promise<Response>): Promise<ApiSuccessEnvelope<T>> {
  const response = await promise;
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new Error(`Expected success but received ${response.status}: ${text}`);
  }
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("Expected envelope.");
  }
  return payload as ApiSuccessEnvelope<T>;
}

describe("projects-worker", () => {
  it("serves health and ping endpoints", async () => {
    const harness = await createHarness();
    try {
      const health = await projectsWorker.fetch(
        new Request("https://projects.sourceplane.test/healthz"),
        harness.env,
        executionContext
      );
      const ping = await projectsWorker.fetch(
        new Request("https://projects.sourceplane.test/internal/ping", {
          headers: { "x-sourceplane-request-id": "req_forwarded" }
        }),
        harness.env,
        executionContext
      );

      expect(health.status).toBe(200);
      expect(ping.status).toBe(200);
      const pingBody = await call<{ receivedRequestId: string }>(Promise.resolve(ping));
      expect(pingBody.data.receivedRequestId).toBe("req_forwarded");
    } finally {
      harness.close();
    }
  });

  it("creates a project, persists it, and bootstraps a default development environment", async () => {
    const harness = await createHarness();
    try {
      const create = await call(
        projectsWorker.fetch(
          new Request("https://projects.sourceplane.test/internal/edge/v1/projects", {
            body: JSON.stringify({ name: "Apollo" }),
            headers: baseHeaders("org_1"),
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      const created = createProjectResponseSchema.parse(create.data);
      expect(created.project.slug).toBe("apollo");
      expect(created.environments).toHaveLength(1);
      expect(created.environments[0]?.slug).toBe("development");

      const list = await call(
        projectsWorker.fetch(
          new Request("https://projects.sourceplane.test/internal/edge/v1/projects", {
            headers: baseHeaders("org_1")
          }),
          harness.env,
          executionContext
        )
      );
      const listed = listProjectsResponseSchema.parse(list.data);
      expect(listed.projects.map((p) => p.slug)).toEqual(["apollo"]);
    } finally {
      harness.close();
    }
  });

  it("supports a project owning multiple environments", async () => {
    const harness = await createHarness();
    try {
      const create = await call(
        projectsWorker.fetch(
          new Request("https://projects.sourceplane.test/internal/edge/v1/projects", {
            body: JSON.stringify({ name: "Apollo" }),
            headers: baseHeaders("org_1"),
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );
      const created = createProjectResponseSchema.parse(create.data);
      const projectId = created.project.id;

      const stagingResponse = await call(
        projectsWorker.fetch(
          new Request(
            `https://projects.sourceplane.test/internal/edge/v1/projects/${projectId}/environments`,
            {
              body: JSON.stringify({ name: "Staging" }),
              headers: baseHeaders("org_1"),
              method: "POST"
            }
          ),
          harness.env,
          executionContext
        )
      );
      const stagingCreated = createEnvironmentResponseSchema.parse(stagingResponse.data);
      expect(stagingCreated.environment.slug).toBe("staging");

      const listEnvs = await call(
        projectsWorker.fetch(
          new Request(
            `https://projects.sourceplane.test/internal/edge/v1/projects/${projectId}/environments`,
            { headers: baseHeaders("org_1") }
          ),
          harness.env,
          executionContext
        )
      );
      const listed = listEnvironmentsResponseSchema.parse(listEnvs.data);
      expect(listed.environments.map((e) => e.slug).sort()).toEqual(["development", "staging"]);
    } finally {
      harness.close();
    }
  });

  it("rejects access to projects that belong to another organization", async () => {
    const harness = await createHarness();
    try {
      const created = createProjectResponseSchema.parse(
        (
          await call(
            projectsWorker.fetch(
              new Request("https://projects.sourceplane.test/internal/edge/v1/projects", {
                body: JSON.stringify({ name: "Apollo" }),
                headers: baseHeaders("org_1"),
                method: "POST"
              }),
              harness.env,
              executionContext
            )
          )
        ).data
      );

      const crossOrg = await projectsWorker.fetch(
        new Request(
          `https://projects.sourceplane.test/internal/edge/v1/projects/${created.project.id}`,
          { headers: baseHeaders("org_2") }
        ),
        harness.env,
        executionContext
      );
      expect(crossOrg.status).toBe(404);
      expect(isApiErrorEnvelope(JSON.parse(await crossOrg.text()))).toBe(true);
    } finally {
      harness.close();
    }
  });

  it("supports internal lookup endpoints scoped per organization", async () => {
    const harness = await createHarness();
    try {
      const created = createProjectResponseSchema.parse(
        (
          await call(
            projectsWorker.fetch(
              new Request("https://projects.sourceplane.test/internal/edge/v1/projects", {
                body: JSON.stringify({ name: "Apollo" }),
                headers: baseHeaders("org_1"),
                method: "POST"
              }),
              harness.env,
              executionContext
            )
          )
        ).data
      );

      const projectLookup = await call(
        projectsWorker.fetch(
          new Request("https://projects.sourceplane.test/internal/projects/lookup", {
            body: JSON.stringify({ organizationId: "org_1", projectId: created.project.id }),
            headers: { "content-type": "application/json" },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );
      const projectLookupParsed = projectLookupResponseSchema.parse(projectLookup.data);
      expect(projectLookupParsed.project?.id).toBe(created.project.id);

      const wrongOrg = await call(
        projectsWorker.fetch(
          new Request("https://projects.sourceplane.test/internal/projects/lookup", {
            body: JSON.stringify({ organizationId: "org_2", projectId: created.project.id }),
            headers: { "content-type": "application/json" },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );
      expect(projectLookupResponseSchema.parse(wrongOrg.data).project).toBeNull();

      const envLookup = await call(
        projectsWorker.fetch(
          new Request("https://projects.sourceplane.test/internal/environments/lookup", {
            body: JSON.stringify({
              environmentId: created.environments[0]!.id,
              organizationId: "org_1",
              projectId: created.project.id
            }),
            headers: { "content-type": "application/json" },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );
      expect(environmentLookupResponseSchema.parse(envLookup.data).environment?.id).toBe(
        created.environments[0]!.id
      );
    } finally {
      harness.close();
    }
  });

  it("requires actor headers for write operations", async () => {
    const harness = await createHarness();
    try {
      const response = await projectsWorker.fetch(
        new Request("https://projects.sourceplane.test/internal/edge/v1/projects", {
          body: JSON.stringify({ name: "Apollo" }),
          headers: {
            "content-type": "application/json",
            [internalOrgIdHeaderName]: "org_1"
          },
          method: "POST"
        }),
        harness.env,
        executionContext
      );
      expect(response.status).toBe(401);
    } finally {
      harness.close();
    }
  });
});
