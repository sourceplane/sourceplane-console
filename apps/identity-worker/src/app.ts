import {
  createApiKeyRequestSchema,
  identityResolveRequestSchema,
  identityUserLookupRequestSchema,
  identityUserLookupResponseSchema,
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalSessionIdHeaderName,
  listApiKeysResponseSchema,
  loginCompleteRequestSchema,
  loginStartRequestSchema,
  revokeApiKeyResponseSchema,
  type RbacActor
} from "@sourceplane/contracts";
import {
  createRequestContext,
  jsonError,
  jsonSuccess,
  parseDeploymentEnvironment,
  SourceplaneHttpError
} from "@sourceplane/shared";

import { D1IdentityRepository } from "./domain/d1-identity-repository.js";
import { createLoginCodeDelivery } from "./domain/email-delivery.js";
import { createIdentityService } from "./domain/service.js";
import type { IdentityWorkerEnv } from "./env.js";

const internalEdgePrefix = "/internal/edge";

export function createIdentityWorkerApp(): ExportedHandler<IdentityWorkerEnv> {
  return {
    async fetch(request: Request, env: IdentityWorkerEnv): Promise<Response> {
      const requestContext = createRequestContext(request, { trustRequestId: true });
      const stage = parseDeploymentEnvironment(env.ENVIRONMENT);
      const service = createIdentityService({
        delivery: createLoginCodeDelivery(env, stage),
        repository: new D1IdentityRepository(env.IDENTITY_DB),
        serviceName: env.APP_NAME,
        tokenHashSecret: env.IDENTITY_TOKEN_HASH_SECRET
      });
      const url = new URL(request.url);

      try {
        if (url.pathname === "/healthz") {
          return jsonSuccess(
            {
              environment: stage,
              ok: true,
              service: env.APP_NAME
            },
            requestContext.requestId
          );
        }

        if (url.pathname === "/internal/ping") {
          return jsonSuccess(
            {
              ok: true,
              receivedRequestId: requestContext.requestId,
              receivedTraceparent: requestContext.traceparent,
              service: env.APP_NAME,
              stage
            },
            requestContext.requestId
          );
        }

        if (url.pathname === "/internal/auth/resolve" && request.method === "POST") {
          const body = identityResolveRequestSchema.parse(await parseJsonBody(request));
          const result = await service.resolveAuthToken(body.token);

          return jsonSuccess(result, requestContext.requestId);
        }

        if (url.pathname === "/internal/users/resolve" && request.method === "POST") {
          const body = identityUserLookupRequestSchema.parse(await parseJsonBody(request));
          const result = identityUserLookupResponseSchema.parse(await service.resolveUser(body.userId));

          return jsonSuccess(result, requestContext.requestId);
        }

        if (url.pathname.startsWith(`${internalEdgePrefix}/v1/auth`)) {
          return await handleForwardedPublicAuthRequest({
            request,
            requestId: requestContext.requestId,
            service,
            url
          });
        }

        return jsonError(404, {
          code: "not_found",
          details: {
            pathname: url.pathname
          },
          message: "Route not found.",
          requestId: requestContext.requestId
        });
      } catch (error) {
        return toErrorResponse(error, requestContext.requestId);
      }
    }
  };
}

async function handleForwardedPublicAuthRequest(options: {
  request: Request;
  requestId: string;
  service: ReturnType<typeof createIdentityService>;
  url: URL;
}): Promise<Response> {
  const publicPath = options.url.pathname.slice(internalEdgePrefix.length);
  const requestMetadata = {
    ipAddress: getIpAddress(options.request),
    requestId: options.requestId,
    userAgent: options.request.headers.get("user-agent")
  };

  if (publicPath === "/v1/auth/login/start" && options.request.method === "POST") {
    const body = loginStartRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.startLogin({
      ...requestMetadata,
      email: body.email
    });

    return jsonSuccess(response, options.requestId);
  }

  if (publicPath === "/v1/auth/login/complete" && options.request.method === "POST") {
    const body = loginCompleteRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.completeLogin({
      ...requestMetadata,
      challengeId: body.challengeId,
      code: body.code
    });

    return jsonSuccess(response, options.requestId);
  }

  if (publicPath === "/v1/auth/session" && options.request.method === "GET") {
    const response = await options.service.resolveSession(parseBearerToken(options.request));

    return jsonSuccess(response, options.requestId);
  }

  if (publicPath === "/v1/auth/logout" && options.request.method === "POST") {
    const actorContext = readForwardedUserContext(options.request);
    const response = await options.service.logout({
      ...requestMetadata,
      actor: actorContext.actor,
      sessionId: actorContext.sessionId
    });

    return jsonSuccess(response, options.requestId);
  }

  if (publicPath === "/v1/auth/api-keys" && options.request.method === "GET") {
    const actorContext = readForwardedUserContext(options.request);
    const response = await options.service.listApiKeys({
      ...requestMetadata,
      actor: actorContext.actor
    });

    return jsonSuccess(listApiKeysResponseSchema.parse(response), options.requestId);
  }

  if (publicPath === "/v1/auth/api-keys" && options.request.method === "POST") {
    const actorContext = readForwardedUserContext(options.request);
    const body = createApiKeyRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.createApiKey({
      ...requestMetadata,
      actor: actorContext.actor,
      expiresAt: body.expiresAt ?? null,
      label: body.label,
      organizationId: body.organizationId,
      roleNames: body.roleNames,
      sessionId: actorContext.sessionId
    });

    return jsonSuccess(response, options.requestId);
  }

  if (publicPath.startsWith("/v1/auth/api-keys/") && options.request.method === "DELETE") {
    const actorContext = readForwardedUserContext(options.request);
    const apiKeyId = publicPath.slice("/v1/auth/api-keys/".length);
    const response = await options.service.revokeApiKey({
      ...requestMetadata,
      actor: actorContext.actor,
      apiKeyId,
      sessionId: actorContext.sessionId
    });

    return jsonSuccess(revokeApiKeyResponseSchema.parse(response), options.requestId);
  }

  throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
    pathname: options.url.pathname
  });
}

function getIpAddress(request: Request): string | null {
  const forwardedIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");

  if (!forwardedIp) {
    return null;
  }

  return forwardedIp.split(",")[0]?.trim() ?? null;
}

function parseBearerToken(request: Request): string | null {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

async function parseJsonBody(request: Request): Promise<unknown> {
  const rawText = await request.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw new SourceplaneHttpError(400, "validation_failed", "The request body must be valid JSON.");
  }
}

function readForwardedUserContext(request: Request): {
  actor: RbacActor & { type: "user" };
  sessionId: string;
} {
  const actorType = request.headers.get(internalActorTypeHeaderName);
  const actorId = request.headers.get(internalActorIdHeaderName);
  const sessionId = request.headers.get(internalSessionIdHeaderName);

  if (!actorType || !actorId || !sessionId) {
    throw new SourceplaneHttpError(401, "unauthenticated", "Authentication is required for this route.");
  }

  if (actorType !== "user") {
    throw new SourceplaneHttpError(403, "forbidden", "Only interactive users can perform this action.");
  }

  return {
    actor: {
      id: actorId,
      type: "user"
    },
    sessionId
  };
}

function toErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof SourceplaneHttpError) {
    return jsonError(error.status, {
      code: error.code,
      details: error.details,
      message: error.message,
      requestId
    });
  }

  if (isValidationError(error)) {
    const validationIssues = error.issues.filter(isValidationIssue);

    return jsonError(400, {
      code: "validation_failed",
      details: {
        issues: validationIssues.map(formatValidationIssue)
      },
      message: "The request payload is invalid.",
      requestId
    });
  }

  return jsonError(500, {
    code: "internal_error",
    details: {},
    message: "identity-worker failed to handle the request.",
    requestId
  });
}

function isValidationError(error: unknown): error is {
  issues: unknown[];
} {
  if (!error || typeof error !== "object") {
    return false;
  }

  const issues: unknown = Reflect.get(error, "issues");

  return Array.isArray(issues);
}

interface ValidationIssue {
  message: string;
  path: Array<number | string>;
}

function formatValidationIssue(issue: ValidationIssue): { message: string; path: string } {
  return {
    message: issue.message,
    path: issue.path.join(".")
  };
}

function isValidationIssue(issue: unknown): issue is ValidationIssue {
  if (!issue || typeof issue !== "object") {
    return false;
  }

  const message: unknown = Reflect.get(issue, "message");
  const path: unknown = Reflect.get(issue, "path");

  return (
    typeof message === "string" &&
    Array.isArray(path) &&
    path.every((segment) => typeof segment === "number" || typeof segment === "string")
  );
}