import { describe, expect, it } from "vitest";

import {
  apiErrorEnvelopeSchema as rootApiErrorEnvelopeSchema,
  componentManifestSchema as rootComponentManifestSchema,
  createErrorResponse,
  createIdempotencyScopeKey,
  createSuccessResponse,
  eventEnvelopeSchema as rootEventEnvelopeSchema,
  idempotencyHeaderName,
  identityResolveResultSchema as rootIdentityResolveResultSchema,
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalEnvironmentIdHeaderName,
  internalOrgIdHeaderName,
  internalProjectIdHeaderName,
  internalResourceIdHeaderName,
  internalSessionIdHeaderName,
  loginStartRequestSchema as rootLoginStartRequestSchema,
  organizationSchema as rootOrganizationSchema,
  requestIdHeaderName,
  resourcePhases,
  sourceplaneErrorCodes,
  traceparentHeaderName
} from "../src/index.js";
import {
  apiErrorEnvelopeSchema,
  internalActorIdHeaderName as apiInternalActorIdHeaderName,
  internalActorTypeHeaderName as apiInternalActorTypeHeaderName,
  internalEnvironmentIdHeaderName as apiInternalEnvironmentIdHeaderName,
  internalOrgIdHeaderName as apiInternalOrgIdHeaderName,
  internalProjectIdHeaderName as apiInternalProjectIdHeaderName,
  internalResourceIdHeaderName as apiInternalResourceIdHeaderName,
  internalSessionIdHeaderName as apiInternalSessionIdHeaderName
} from "../src/api/index.js";
import { identityResolveResultSchema, loginStartRequestSchema } from "../src/auth/index.js";
import { componentManifestSchema } from "../src/components/index.js";
import { eventEnvelopeSchema } from "../src/events/index.js";
import { organizationSchema } from "../src/membership/index.js";
import { resourcePhases as resourcePhasesFromResources } from "../src/resources/index.js";

describe("public contract surface", () => {
  it("re-exports module surfaces from the root entrypoint", () => {
    expect(rootApiErrorEnvelopeSchema).toBe(apiErrorEnvelopeSchema);
    expect(rootComponentManifestSchema).toBe(componentManifestSchema);
    expect(rootEventEnvelopeSchema).toBe(eventEnvelopeSchema);
    expect(rootIdentityResolveResultSchema).toBe(identityResolveResultSchema);
    expect(rootLoginStartRequestSchema).toBe(loginStartRequestSchema);
    expect(rootOrganizationSchema).toBe(organizationSchema);
    expect(resourcePhases).toBe(resourcePhasesFromResources);
  });

  it("keeps the success envelope shape stable", () => {
    expect(
      createSuccessResponse(
        {
          ok: true,
          service: "api-edge"
        },
        {
          cursor: null,
          requestId: "req_123"
        }
      )
    ).toMatchInlineSnapshot(`
      {
        "data": {
          "ok": true,
          "service": "api-edge",
        },
        "meta": {
          "cursor": null,
          "requestId": "req_123",
        },
      }
    `);
  });

  it("keeps the error envelope shape stable", () => {
    expect(
      createErrorResponse({
        code: "forbidden",
        details: {
          orgId: "org_123"
        },
        message: "You do not have access to this resource.",
        requestId: "req_123"
      })
    ).toMatchInlineSnapshot(`
      {
        "error": {
          "code": "forbidden",
          "details": {
            "orgId": "org_123",
          },
          "message": "You do not have access to this resource.",
          "requestId": "req_123",
        },
      }
    `);
  });

  it("keeps shared semantic constants stable", () => {
    expect({
      errorCodes: sourceplaneErrorCodes,
      headers: {
        idempotencyHeaderName,
        internalActorIdHeaderName,
        internalActorTypeHeaderName,
        internalEnvironmentIdHeaderName,
        internalOrgIdHeaderName,
        internalProjectIdHeaderName,
        internalResourceIdHeaderName,
        internalSessionIdHeaderName,
        requestIdHeaderName,
        traceparentHeaderName
      },
      idempotencyScopeKey: createIdempotencyScopeKey({
        actorId: "usr_123",
        route: "POST:/v1/resources"
      }),
      resourcePhases
    }).toMatchInlineSnapshot(`
      {
        "errorCodes": [
          "bad_request",
          "unauthenticated",
          "forbidden",
          "not_found",
          "conflict",
          "rate_limited",
          "validation_failed",
          "precondition_failed",
          "unsupported",
          "internal_error",
        ],
        "headers": {
          "idempotencyHeaderName": "Idempotency-Key",
          "internalActorIdHeaderName": "x-sourceplane-actor-id",
          "internalActorTypeHeaderName": "x-sourceplane-actor-type",
          "internalEnvironmentIdHeaderName": "x-sourceplane-environment-id",
          "internalOrgIdHeaderName": "x-sourceplane-org-id",
          "internalProjectIdHeaderName": "x-sourceplane-project-id",
          "internalResourceIdHeaderName": "x-sourceplane-resource-id",
          "internalSessionIdHeaderName": "x-sourceplane-session-id",
          "requestIdHeaderName": "x-sourceplane-request-id",
          "traceparentHeaderName": "traceparent",
        },
        "idempotencyScopeKey": "usr_123::POST:/v1/resources",
        "resourcePhases": [
          "draft",
          "pending",
          "provisioning",
          "ready",
          "degraded",
          "failed",
          "deleting",
          "deleted",
        ],
      }
    `);

    expect(apiInternalActorTypeHeaderName).toBe(internalActorTypeHeaderName);
    expect(apiInternalActorIdHeaderName).toBe(internalActorIdHeaderName);
    expect(apiInternalSessionIdHeaderName).toBe(internalSessionIdHeaderName);
    expect(apiInternalOrgIdHeaderName).toBe(internalOrgIdHeaderName);
    expect(apiInternalProjectIdHeaderName).toBe(internalProjectIdHeaderName);
    expect(apiInternalEnvironmentIdHeaderName).toBe(internalEnvironmentIdHeaderName);
    expect(apiInternalResourceIdHeaderName).toBe(internalResourceIdHeaderName);
  });
});