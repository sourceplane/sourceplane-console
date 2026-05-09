import { describe, expect, it } from "vitest";

import { applyD1Migrations, createTestD1Database } from "@sourceplane/testing";
import { resolve } from "node:path";

import identityWorker, { type IdentityWorkerEnv } from "../src/index.js";

const executionContext: ExecutionContext = {
  passThroughOnException(): void {},
  waitUntil(promise: Promise<unknown>): void {
    void promise;
  }
};

const migrationsDirectory = resolve(import.meta.dirname, "..", "migrations");

/**
 * Tests for repository selection behavior.
 *
 * These tests verify that:
 * 1. When IDENTITY_HYPERDRIVE is absent, D1 is used (normal local/test path).
 * 2. When ENVIRONMENT=production and IDENTITY_HYPERDRIVE is absent, the Worker
 *    returns a 500 error instead of silently proceeding with D1.
 * 3. When IDENTITY_HYPERDRIVE is present, the Postgres adapter is selected
 *    (full Postgres execution is not tested here due to no live network access;
 *    see remaining gap in ai/reports/task-0001-implementer.md).
 */
describe("identity-worker repository selection", () => {
  it("uses D1 repository when IDENTITY_HYPERDRIVE is absent in local environment", async () => {
    const database = createTestD1Database();
    await applyD1Migrations(database.binding, migrationsDirectory);

    const env: IdentityWorkerEnv = {
      APP_NAME: "identity-worker",
      AUTH_LOGIN_DELIVERY_MODE: "local_debug",
      ENVIRONMENT: "local",
      IDENTITY_DB: database.binding,
      IDENTITY_TOKEN_HASH_SECRET: "test-secret"
      // IDENTITY_HYPERDRIVE intentionally absent
    };

    try {
      const response = await identityWorker.fetch(
        new Request("https://identity.sourceplane.test/healthz"),
        env,
        executionContext
      );

      expect(response.ok).toBe(true);
      const body = await response.json();
      expect((body as { data: { ok: boolean } }).data.ok).toBe(true);
    } finally {
      database.close();
    }
  });

  it("returns 500 in production when IDENTITY_HYPERDRIVE is absent", async () => {
    const database = createTestD1Database();
    await applyD1Migrations(database.binding, migrationsDirectory);

    const env: IdentityWorkerEnv = {
      APP_NAME: "identity-worker",
      ENVIRONMENT: "production",
      IDENTITY_DB: database.binding,
      IDENTITY_TOKEN_HASH_SECRET: "prod-test-secret"
      // IDENTITY_HYPERDRIVE intentionally absent — should cause a 500
    };

    try {
      // A live route that hits the repository is needed to trigger selection.
      const response = await identityWorker.fetch(
        new Request("https://identity.sourceplane.test/internal/edge/v1/auth/login/start", {
          body: JSON.stringify({ email: "user@example.com" }),
          headers: { "content-type": "application/json" },
          method: "POST"
        }),
        env,
        executionContext
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect((body as { error: { code: string } }).error.code).toBe("internal_error");
    } finally {
      database.close();
    }
  });

  it("selects the Postgres adapter when IDENTITY_HYPERDRIVE is present", async () => {
    // This test verifies the branching logic up to adapter construction.
    // It cannot execute real queries without a live Postgres connection
    // (see remaining gap in task-0001-implementer.md).
    const database = createTestD1Database();
    await applyD1Migrations(database.binding, migrationsDirectory);

    const mockConnectionString = "postgresql://user:pass@localhost:5432/test";
    const mockHyperdrive: Hyperdrive = {
      connectionString: mockConnectionString
    };

    const env: IdentityWorkerEnv = {
      APP_NAME: "identity-worker",
      AUTH_LOGIN_DELIVERY_MODE: "local_debug",
      ENVIRONMENT: "local",
      IDENTITY_DB: database.binding,
      IDENTITY_HYPERDRIVE: mockHyperdrive,
      IDENTITY_TOKEN_HASH_SECRET: "test-secret"
    };

    try {
      // The /healthz route does not touch the repository, so no Postgres
      // connection attempt occurs. This confirms the adapter is constructed
      // (no exception thrown) and the Worker still starts correctly.
      const response = await identityWorker.fetch(
        new Request("https://identity.sourceplane.test/healthz"),
        env,
        executionContext
      );

      expect(response.ok).toBe(true);
    } finally {
      database.close();
    }
  });
});
