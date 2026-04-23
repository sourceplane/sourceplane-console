import { authorizationRequestSchema, authorizationResponseSchema } from "@sourceplane/contracts";
import {
  createRequestContext,
  jsonError,
  jsonSuccess,
  parseDeploymentEnvironment,
  SourceplaneHttpError
} from "@sourceplane/shared";

import { createPolicyEngine, type PolicyEngine } from "./domain/engine.js";
import type { PolicyWorkerEnv } from "./env.js";

export interface PolicyWorkerAppOptions {
  engine?: PolicyEngine;
}

export function createPolicyWorkerApp(options: PolicyWorkerAppOptions = {}): ExportedHandler<PolicyWorkerEnv> {
  const engine = options.engine ?? createPolicyEngine();

  return {
    async fetch(request: Request, env: PolicyWorkerEnv): Promise<Response> {
      const requestContext = createRequestContext(request, { trustRequestId: true });
      const stage = parseDeploymentEnvironment(env.ENVIRONMENT);
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

        if (url.pathname === "/internal/authorize" && request.method === "POST") {
          const body = authorizationRequestSchema.parse(await parseJsonBody(request));
          const decision = authorizationResponseSchema.parse(engine.authorize(body));

          return jsonSuccess(decision, requestContext.requestId);
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
        return toErrorResponse(error, env.APP_NAME, requestContext.requestId);
      }
    }
  };
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

function toErrorResponse(error: unknown, serviceName: string, requestId: string): Response {
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
    message: `${serviceName} failed to handle the request.`,
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

function formatValidationIssue(issue: { message: string; path: Array<number | string> }): { message: string; path: string } {
  return {
    message: issue.message,
    path: issue.path.join(".")
  };
}