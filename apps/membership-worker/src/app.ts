import { authorizationMembershipResolveRequestSchema } from "@sourceplane/contracts";
import {
  createRequestContext,
  jsonError,
  jsonSuccess,
  parseDeploymentEnvironment,
  SourceplaneHttpError,
  type RequestContext
} from "@sourceplane/shared";

import { createIdentityDirectory } from "./clients/identity.js";
import { D1MembershipRepository } from "./domain/d1-membership-repository.js";
import { createMembershipService, type MembershipService } from "./domain/service.js";
import type { MembershipWorkerEnv } from "./env.js";
import { handleForwardedMembershipPublicRequest } from "./routes/public.js";

export interface MembershipWorkerAppOptions {
  service?: MembershipService;
}

const internalEdgePrefix = "/internal/edge";

export function createMembershipWorkerApp(options: MembershipWorkerAppOptions = {}): ExportedHandler<MembershipWorkerEnv> {
  return {
    async fetch(request: Request, env: MembershipWorkerEnv): Promise<Response> {
      const requestContext = createRequestContext(request, { trustRequestId: true });
      const stage = parseDeploymentEnvironment(env.ENVIRONMENT);
      const service =
        options.service ??
        createMembershipService({
          identityDirectory: createIdentityDirectory(env.IDENTITY),
          repository: new D1MembershipRepository(env.MEMBERSHIP_DB),
          serviceName: env.APP_NAME,
          tokenHashSecret: resolveTokenHashSecret(env, stage)
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

        if (url.pathname === "/internal/authorization-memberships/resolve" && request.method === "POST") {
          const body = authorizationMembershipResolveRequestSchema.parse(await parseJsonBody(request));
          const response = await service.resolveAuthorizationMemberships(body);

          return jsonSuccess(response, requestContext.requestId);
        }

        if (url.pathname.startsWith(`${internalEdgePrefix}/v1/organizations`)) {
          return await handleForwardedMembershipPublicRequest({
            request,
            requestContext,
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
        return toErrorResponse(error, env.APP_NAME, requestContext);
      }
    }
  };
}

function resolveTokenHashSecret(
  env: MembershipWorkerEnv,
  stage: ReturnType<typeof parseDeploymentEnvironment>
): string {
  const configuredSecret = env.MEMBERSHIP_TOKEN_HASH_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (stage !== "production") {
    console.warn("membership-worker using non-production fallback token hash secret", {
      service: env.APP_NAME,
      stage
    });
    return `${env.APP_NAME}:${stage}:fallback-token-hash-secret`;
  }

  throw new SourceplaneHttpError(500, "internal_error", "Membership token hashing is not configured for production.");
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

function toErrorResponse(error: unknown, serviceName: string, requestContext: RequestContext): Response {
  if (error instanceof SourceplaneHttpError) {
    return jsonError(error.status, {
      code: error.code,
      details: error.details,
      message: error.message,
      requestId: requestContext.requestId
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
      requestId: requestContext.requestId
    });
  }

  return jsonError(500, {
    code: "internal_error",
    details: {},
    message: `${serviceName} failed to handle the request.`,
    requestId: requestContext.requestId
  });
}

function formatValidationIssue(issue: { message: string; path: Array<number | string> }): { message: string; path: string } {
  return {
    message: issue.message,
    path: issue.path.join(".")
  };
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

function isValidationIssue(issue: unknown): issue is {
  message: string;
  path: Array<number | string>;
} {
  if (!issue || typeof issue !== "object") {
    return false;
  }

  const message: unknown = Reflect.get(issue, "message");
  const path: unknown = Reflect.get(issue, "path");

  return typeof message === "string" && Array.isArray(path) && path.every((segment) => typeof segment === "number" || typeof segment === "string");
}
