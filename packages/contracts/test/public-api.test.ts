import { describe, expect, it } from "vitest";

import {
  apiErrorEnvelopeSchema as rootApiErrorEnvelopeSchema,
  componentManifestSchema as rootComponentManifestSchema,
  createErrorResponse,
  createIdempotencyScopeKey,
  createSuccessResponse,
  eventEnvelopeSchema as rootEventEnvelopeSchema,
  idempotencyHeaderName,
  requestIdHeaderName,
  resourcePhases,
  sourceplaneErrorCodes,
  traceparentHeaderName
} from "../src/index.js";
import { apiErrorEnvelopeSchema } from "../src/api/index.js";
import { componentManifestSchema } from "../src/components/index.js";
import { eventEnvelopeSchema } from "../src/events/index.js";
import { resourcePhases as resourcePhasesFromResources } from "../src/resources/index.js";

describe("public contract surface", () => {
  it("re-exports module surfaces from the root entrypoint", () => {
    expect(rootApiErrorEnvelopeSchema).toBe(apiErrorEnvelopeSchema);
    expect(rootComponentManifestSchema).toBe(componentManifestSchema);
    expect(rootEventEnvelopeSchema).toBe(eventEnvelopeSchema);
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
  });
});