import {
  environmentLookupRequestSchema,
  projectLookupRequestSchema
} from "@sourceplane/contracts";
import {
  createRequestContext,
  jsonError,
  jsonSuccess,
  parseDeploymentEnvironment,
  SourceplaneHttpError,
  type RequestContext
} from "@sourceplane/shared";

import { D1ProjectsRepository } from "./domain/d1-projects-repository.js";
import { createProjectsService, type ProjectsService } from "./domain/service.js";
import type { ProjectsWorkerEnv } from "./env.js";
import { handleForwardedProjectsPublicRequest } from "./routes/public.js";

export interface ProjectsWorkerAppOptions {
  service?: ProjectsService;
}

const internalEdgePrefix = "/internal/edge";

export function createProjectsWorkerApp(
  options: ProjectsWorkerAppOptions = {}
): ExportedHandler<ProjectsWorkerEnv> {
  return {
    async fetch(request: Request, env: ProjectsWorkerEnv): Promise<Response> {
      const requestContext = createRequestContext(request, { trustRequestId: true });
      const stage = parseDeploymentEnvironment(env.ENVIRONMENT);
      const service =
        options.service ??
        createProjectsService({
          repository: new D1ProjectsRepository(env.PROJECTS_DB),
          serviceName: env.APP_NAME
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

        if (url.pathname === "/internal/projects/lookup" && request.method === "POST") {
          const body = projectLookupRequestSchema.parse(await parseJsonBody(request));
          const response = await service.lookupProject(body);
          return jsonSuccess(response, requestContext.requestId);
        }

        if (url.pathname === "/internal/environments/lookup" && request.method === "POST") {
          const body = environmentLookupRequestSchema.parse(await parseJsonBody(request));
          const response = await service.lookupEnvironment(body);
          return jsonSuccess(response, requestContext.requestId);
        }

        if (
          url.pathname.startsWith(`${internalEdgePrefix}/v1/projects`) ||
          url.pathname.startsWith(`${internalEdgePrefix}/v1/environments`)
        ) {
          return await handleForwardedProjectsPublicRequest({
            request,
            requestContext,
            service,
            url
          });
        }

        return jsonError(404, {
          code: "not_found",
          details: { pathname: url.pathname },
          message: "Route not found.",
          requestId: requestContext.requestId
        });
      } catch (error) {
        return toErrorResponse(error, env.APP_NAME, requestContext);
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

function isValidationError(error: unknown): error is { issues: unknown[] } {
  if (!error || typeof error !== "object") {
    return false;
  }
  const issues: unknown = Reflect.get(error, "issues");
  return Array.isArray(issues);
}

function isValidationIssue(issue: unknown): issue is { message: string; path: Array<number | string> } {
  if (!issue || typeof issue !== "object") {
    return false;
  }
  const message: unknown = Reflect.get(issue, "message");
  const path: unknown = Reflect.get(issue, "path");

  return typeof message === "string" && Array.isArray(path) && path.every((segment) => typeof segment === "number" || typeof segment === "string");
}
