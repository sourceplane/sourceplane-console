import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createApiKeyResponseSchema,
  identityResolveResultSchema,
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalSessionIdHeaderName,
  isApiErrorEnvelope,
  listApiKeysResponseSchema,
  loginCompleteResponseSchema,
  loginStartResponseSchema,
  logoutResponseSchema,
  resolveSessionResponseSchema,
  revokeApiKeyResponseSchema,
  type ApiSuccessEnvelope
} from "@sourceplane/contracts";
import { applyD1Migrations, createTestD1Database } from "@sourceplane/testing";

import identityWorker, { type IdentityWorkerEnv } from "../src/index.js";

const executionContext: ExecutionContext = {
  passThroughOnException(): void {},
  waitUntil(promise: Promise<unknown>): void {
    void promise;
  }
};

const migrationsDirectory = resolve(import.meta.dirname, "..", "migrations");

describe("identity-worker", () => {
  it("bootstraps a user, resolves a session, and logs out cleanly", async () => {
    const harness = await createHarness();

    try {
      const loginStart = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/edge/v1/auth/login/start", {
            body: JSON.stringify({
              email: "user@example.com"
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      const loginStartData = loginStartResponseSchema.parse(loginStart.data);
      expect(loginStartData.delivery.mode).toBe("local_debug");

      const loginCode = loginStartData.delivery.mode === "local_debug" ? loginStartData.delivery.code : null;
      expect(loginCode).not.toBeNull();

      const loginComplete = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/edge/v1/auth/login/complete", {
            body: JSON.stringify({
              challengeId: loginStartData.challengeId,
              code: loginCode
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      const loginCompleteData = loginCompleteResponseSchema.parse(loginComplete.data);

      const resolvedSession = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/auth/resolve", {
            body: JSON.stringify({
              token: loginCompleteData.session.token
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      expect(identityResolveResultSchema.parse(resolvedSession.data)).toEqual({
        actor: {
          id: loginCompleteData.user.id,
          type: "user"
        },
        organizationId: null,
        sessionId: loginCompleteData.session.id
      });

      const sessionView = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/edge/v1/auth/session", {
            headers: {
              authorization: `Bearer ${loginCompleteData.session.token}`
            }
          }),
          harness.env,
          executionContext
        )
      );

      expect(resolveSessionResponseSchema.parse(sessionView.data)).toEqual({
        authenticated: true,
        session: {
          actor: {
            id: loginCompleteData.user.id,
            type: "user"
          },
          expiresAt: loginCompleteData.session.expiresAt,
          id: loginCompleteData.session.id,
          organizationId: null
        },
        user: loginCompleteData.user
      });

      const logout = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/edge/v1/auth/logout", {
            headers: {
              [internalActorIdHeaderName]: loginCompleteData.user.id,
              [internalActorTypeHeaderName]: "user",
              [internalSessionIdHeaderName]: loginCompleteData.session.id
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      expect(logoutResponseSchema.parse(logout.data)).toEqual({
        revoked: true,
        sessionId: loginCompleteData.session.id
      });

      const revokedResolution = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/auth/resolve", {
            body: JSON.stringify({
              token: loginCompleteData.session.token
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      expect(identityResolveResultSchema.parse(revokedResolution.data)).toEqual({
        actor: null,
        organizationId: null,
        sessionId: null
      });
    } finally {
      harness.close();
    }
  });

  it("returns a null actor for invalid and expired session credentials", async () => {
    const harness = await createHarness();

    try {
      const invalidResolution = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/auth/resolve", {
            body: JSON.stringify({
              token: "sps_missing.invalid"
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      expect(identityResolveResultSchema.parse(invalidResolution.data)).toEqual({
        actor: null,
        organizationId: null,
        sessionId: null
      });

      const session = await createInteractiveSession(harness.env);

      await harness.env.IDENTITY_DB.prepare(`UPDATE sessions SET expires_at = ? WHERE id = ?`)
        .bind("2020-01-01T00:00:00.000Z", session.sessionId)
        .run();

      const expiredResolution = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/auth/resolve", {
            body: JSON.stringify({
              token: session.token
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      expect(identityResolveResultSchema.parse(expiredResolution.data)).toEqual({
        actor: null,
        organizationId: null,
        sessionId: null
      });
    } finally {
      harness.close();
    }
  });

  it("creates, lists, resolves, and revokes API keys", async () => {
    const harness = await createHarness();

    try {
      const session = await createInteractiveSession(harness.env);

      const createApiKey = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/edge/v1/auth/api-keys", {
            body: JSON.stringify({
              label: "CI token",
              organizationId: "org_123",
              roleNames: ["builder"]
            }),
            headers: {
              "content-type": "application/json",
              [internalActorIdHeaderName]: session.userId,
              [internalActorTypeHeaderName]: "user",
              [internalSessionIdHeaderName]: session.sessionId
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      const createdApiKey = createApiKeyResponseSchema.parse(createApiKey.data);

      const listedApiKeys = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/edge/v1/auth/api-keys", {
            headers: {
              [internalActorIdHeaderName]: session.userId,
              [internalActorTypeHeaderName]: "user",
              [internalSessionIdHeaderName]: session.sessionId
            }
          }),
          harness.env,
          executionContext
        )
      );

      expect(listApiKeysResponseSchema.parse(listedApiKeys.data)).toEqual({
        apiKeys: [createdApiKey.apiKey]
      });

      const resolvedApiKey = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/auth/resolve", {
            body: JSON.stringify({
              token: createdApiKey.token
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      expect(identityResolveResultSchema.parse(resolvedApiKey.data)).toEqual({
        actor: {
          id: createdApiKey.apiKey.servicePrincipal.id,
          type: "service_principal"
        },
        organizationId: "org_123",
        sessionId: null
      });

      const revokeApiKey = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request(`https://identity.sourceplane.test/internal/edge/v1/auth/api-keys/${createdApiKey.apiKey.id}`, {
            headers: {
              [internalActorIdHeaderName]: session.userId,
              [internalActorTypeHeaderName]: "user",
              [internalSessionIdHeaderName]: session.sessionId
            },
            method: "DELETE"
          }),
          harness.env,
          executionContext
        )
      );

      expect(revokeApiKeyResponseSchema.parse(revokeApiKey.data)).toEqual({
        apiKeyId: createdApiKey.apiKey.id,
        revoked: true
      });

      const revokedApiKey = await callSuccessEnvelope(
        identityWorker.fetch(
          new Request("https://identity.sourceplane.test/internal/auth/resolve", {
            body: JSON.stringify({
              token: createdApiKey.token
            }),
            headers: {
              "content-type": "application/json"
            },
            method: "POST"
          }),
          harness.env,
          executionContext
        )
      );

      expect(identityResolveResultSchema.parse(revokedApiKey.data)).toEqual({
        actor: null,
        organizationId: null,
        sessionId: null
      });
    } finally {
      harness.close();
    }
  });
});

async function callSuccessEnvelope<TData>(responsePromise: Promise<Response>): Promise<ApiSuccessEnvelope<TData>> {
  const response = await responsePromise;
  const payload = await readJsonValue(response);

  if (!response.ok) {
    throw new Error(`Expected success but received ${response.status}: ${JSON.stringify(payload)}`);
  }

  return assertApiSuccessEnvelope<TData>(payload);
}

async function createHarness(): Promise<{ close(): void; env: IdentityWorkerEnv }> {
  const database = createTestD1Database();
  await applyD1Migrations(database.binding, migrationsDirectory);

  return {
    close(): void {
      database.close();
    },
    env: {
      APP_NAME: "identity-worker",
      ENVIRONMENT: "local",
      IDENTITY_DB: database.binding,
      IDENTITY_TOKEN_HASH_SECRET: "identity-test-secret"
    }
  };
}

async function createInteractiveSession(env: IdentityWorkerEnv): Promise<{ sessionId: string; token: string; userId: string }> {
  const loginStart = await callSuccessEnvelope(
    identityWorker.fetch(
      new Request("https://identity.sourceplane.test/internal/edge/v1/auth/login/start", {
        body: JSON.stringify({
          email: "user@example.com"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      executionContext
    )
  );

  const loginStartData = loginStartResponseSchema.parse(loginStart.data);
  const code = loginStartData.delivery.mode === "local_debug" ? loginStartData.delivery.code : null;

  if (!code) {
    throw new Error("Expected local_debug delivery during tests.");
  }

  const loginComplete = await callSuccessEnvelope(
    identityWorker.fetch(
      new Request("https://identity.sourceplane.test/internal/edge/v1/auth/login/complete", {
        body: JSON.stringify({
          challengeId: loginStartData.challengeId,
          code
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      executionContext
    )
  );

  const loginCompleteData = loginCompleteResponseSchema.parse(loginComplete.data);

  return {
    sessionId: loginCompleteData.session.id,
    token: loginCompleteData.session.token,
    userId: loginCompleteData.user.id
  };
}

function assertApiSuccessEnvelope<TData>(value: unknown): ApiSuccessEnvelope<TData> {
  if (!value || typeof value !== "object" || !("data" in value) || !("meta" in value)) {
    throw new Error("Expected a success envelope.");
  }

  return value as ApiSuccessEnvelope<TData>;
}

async function readJsonValue(response: Response): Promise<unknown> {
  const payload = JSON.parse(await response.text()) as unknown;

  if (isApiErrorEnvelope(payload)) {
    return payload;
  }

  return payload;
}