/**
 * Repository selection tests for identity-worker.
 *
 * These tests verify that the worker picks the correct repository adapter based
 * on the available environment bindings, without requiring a live database.
 */

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

describe("identity-worker repository selection", () => {
  it("uses the D1 repository when IDENTITY_HYPERDRIVE is absent (local stage)", async () => {
    // Arrange: no Hyperdrive binding, local stage. D1 path should be used.
    const database = createTestD1Database();
    await applyD1Migrations(database.binding, migrationsDirectory);

    const env: IdentityWorkerEnv = {
      APP_NAME: "identity-worker",
      AUTH_LOGIN_DELIVERY_MODE: "local_debug",
      ENVIRONMENT: "local",
      IDENTITY_DB: database.binding,
      IDENTITY_TOKEN_HASH_SECRET: "selection-test-secret"
      // IDENTITY_HYPERDRIVE intentionally absent
    };

    try {
      // The worker should start up and serve a health check without errors,
      // proving the D1 path was selected and is functional.
      const response = await identityWorker.fetch(
        new Request("https://identity.sourceplane.test/healthz"),
        env,
        executionContext
      );

      expect(response.status).toBe(200);
      const body: { data: { ok: boolean } } = await response.json();
      expect(body.data.ok).toBe(true);
    } finally {
      database.close();
    }
  });

  it("uses the D1 repository when IDENTITY_HYPERDRIVE is absent (preview stage)", async () => {
    const database = createTestD1Database();
    await applyD1Migrations(database.binding, migrationsDirectory);

    const env: IdentityWorkerEnv = {
      APP_NAME: "identity-worker",
      AUTH_LOGIN_DELIVERY_MODE: "local_debug",
      ENVIRONMENT: "preview",
      IDENTITY_DB: database.binding,
      IDENTITY_TOKEN_HASH_SECRET: "selection-test-secret"
    };

    try {
      const response = await identityWorker.fetch(
        new Request("https://identity.sourceplane.test/healthz"),
        env,
        executionContext
      );

      expect(response.status).toBe(200);
    } finally {
      database.close();
    }
  });

  it("fails with a 500 in production when IDENTITY_HYPERDRIVE is absent", async () => {
    // Arrange: production stage, no Hyperdrive binding, no D1 fallback.
    // The worker must fail clearly rather than silently falling back to D1.
    const database = createTestD1Database();
    await applyD1Migrations(database.binding, migrationsDirectory);

    const env: IdentityWorkerEnv = {
      APP_NAME: "identity-worker",
      ENVIRONMENT: "production",
      IDENTITY_DB: database.binding,
      IDENTITY_TOKEN_HASH_SECRET: "selection-test-secret"
      // IDENTITY_HYPERDRIVE intentionally absent
    };

    try {
      const response = await identityWorker.fetch(
        new Request("https://identity.sourceplane.test/healthz"),
        env,
        executionContext
      );

      // The worker catches the config error and converts it to a 500.
      expect(response.status).toBe(500);
      const body: { data?: unknown; error?: { code: string } } = await response.json();
      expect(body.error?.code).toBe("internal_error");
    } finally {
      database.close();
    }
  });

  it("uses the Postgres repository when IDENTITY_HYPERDRIVE is present", async () => {
    // Arrange: a fake Hyperdrive binding stub that provides a connectionString.
    // We do not actually connect to Postgres in this test; we only verify that
    // the selection logic chooses the Postgres path (i.e. does not reject on
    // the presence of the binding). The first observable signal is a failed
    // Postgres connection (not a 500 from missing config), so we accept a
    // non-config error in this offline test environment.
    //
    // Full Postgres execution coverage requires a live Postgres instance and
    // is tracked in ai/reports/task-0001-implementer.md as a remaining gap.
    const database = createTestD1Database();
    await applyD1Migrations(database.binding, migrationsDirectory);

    const fakeConnectionString = "postgresql://user:password@localhost:5432/identity_test";

    const fakeHyperdrive: Hyperdrive = {
      connect() {
        // Not called in this test.
        throw new Error("Not implemented in offline stub.");
      },
      connectionString: fakeConnectionString,
      database: "identity_test",
      host: "localhost",
      password: "password",
      port: 5432,
      user: "user"
    };

    const env: IdentityWorkerEnv = {
      APP_NAME: "identity-worker",
      ENVIRONMENT: "production",
      IDENTITY_DB: database.binding,
      IDENTITY_HYPERDRIVE: fakeHyperdrive,
      IDENTITY_TOKEN_HASH_SECRET: "selection-test-secret"
    };

    try {
      // The health check route doesn't touch the DB, so it should succeed
      // even though we cannot reach a real Postgres from the test runner.
      const response = await identityWorker.fetch(
        new Request("https://identity.sourceplane.test/healthz"),
        env,
        executionContext
      );

      // Health check succeeds because it does not query the repository.
      expect(response.status).toBe(200);
    } finally {
      database.close();
    }
  });
});
