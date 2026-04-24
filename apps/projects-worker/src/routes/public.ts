import {
  createEnvironmentRequestSchema,
  createProjectRequestSchema,
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalOrgIdHeaderName,
  internalSessionIdHeaderName,
  updateEnvironmentRequestSchema,
  updateProjectRequestSchema,
  type RbacActor
} from "@sourceplane/contracts";
import { jsonSuccess, SourceplaneHttpError, type RequestContext } from "@sourceplane/shared";

import type { ProjectsService } from "../domain/service.js";

const internalEdgePrefix = "/internal/edge";

export async function handleForwardedProjectsPublicRequest(options: {
  request: Request;
  requestContext: RequestContext;
  service: ProjectsService;
  url: URL;
}): Promise<Response> {
  const publicPath = options.url.pathname.slice(internalEdgePrefix.length);
  const method = options.request.method.toUpperCase();

  // /v1/projects collection
  if (publicPath === "/v1/projects" && method === "GET") {
    const orgId = readOrganizationId(options.request);
    const response = await options.service.listProjects({ organizationId: orgId });

    return jsonSuccess(response, options.requestContext.requestId);
  }

  if (publicPath === "/v1/projects" && method === "POST") {
    const actorContext = readActorContext(options.request);
    const orgId = readOrganizationId(options.request);
    const body = createProjectRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.createProject({
      ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
      actor: actorContext.actor,
      name: body.name,
      organizationId: orgId,
      ...(body.slug === undefined ? {} : { slug: body.slug })
    });

    return jsonSuccess(response, options.requestContext.requestId, { status: 201 });
  }

  const projectMatch = publicPath.match(/^\/v1\/projects\/([^/]+)$/u);
  if (projectMatch) {
    const projectId = projectMatch[1];
    if (!projectId) {
      throw notFound(options.url.pathname);
    }
    const orgId = readOrganizationId(options.request);

    if (method === "GET") {
      const response = await options.service.getProject({ organizationId: orgId, projectId });
      return jsonSuccess(response, options.requestContext.requestId);
    }

    if (method === "PATCH") {
      const actorContext = readActorContext(options.request);
      const body = updateProjectRequestSchema.parse(await parseJsonBody(options.request));
      const response = await options.service.updateProject({
        ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
        actor: actorContext.actor,
        organizationId: orgId,
        projectId,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.slug === undefined ? {} : { slug: body.slug })
      });
      return jsonSuccess(response, options.requestContext.requestId);
    }

    if (method === "DELETE") {
      const actorContext = readActorContext(options.request);
      const response = await options.service.archiveProject({
        ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
        actor: actorContext.actor,
        organizationId: orgId,
        projectId
      });
      return jsonSuccess(response, options.requestContext.requestId);
    }
  }

  const projectEnvironmentsMatch = publicPath.match(/^\/v1\/projects\/([^/]+)\/environments$/u);
  if (projectEnvironmentsMatch) {
    const projectId = projectEnvironmentsMatch[1];
    if (!projectId) {
      throw notFound(options.url.pathname);
    }
    const orgId = readOrganizationId(options.request);

    if (method === "GET") {
      const response = await options.service.listEnvironments({ organizationId: orgId, projectId });
      return jsonSuccess(response, options.requestContext.requestId);
    }

    if (method === "POST") {
      const actorContext = readActorContext(options.request);
      const body = createEnvironmentRequestSchema.parse(await parseJsonBody(options.request));
      const response = await options.service.createEnvironment({
        ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
        actor: actorContext.actor,
        name: body.name,
        organizationId: orgId,
        projectId,
        ...(body.slug === undefined ? {} : { slug: body.slug })
      });
      return jsonSuccess(response, options.requestContext.requestId, { status: 201 });
    }
  }

  const environmentMatch = publicPath.match(/^\/v1\/environments\/([^/]+)$/u);
  if (environmentMatch) {
    const environmentId = environmentMatch[1];
    if (!environmentId) {
      throw notFound(options.url.pathname);
    }
    const orgId = readOrganizationId(options.request);

    if (method === "GET") {
      const response = await options.service.getEnvironment({ environmentId, organizationId: orgId });
      return jsonSuccess(response, options.requestContext.requestId);
    }

    if (method === "PATCH") {
      const actorContext = readActorContext(options.request);
      const body = updateEnvironmentRequestSchema.parse(await parseJsonBody(options.request));
      const response = await options.service.updateEnvironment({
        ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
        actor: actorContext.actor,
        environmentId,
        organizationId: orgId,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.slug === undefined ? {} : { slug: body.slug })
      });
      return jsonSuccess(response, options.requestContext.requestId);
    }

    if (method === "DELETE") {
      const actorContext = readActorContext(options.request);
      const response = await options.service.archiveEnvironment({
        ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
        actor: actorContext.actor,
        environmentId,
        organizationId: orgId
      });
      return jsonSuccess(response, options.requestContext.requestId);
    }
  }

  throw notFound(options.url.pathname);
}

function notFound(pathname: string): SourceplaneHttpError {
  return new SourceplaneHttpError(404, "not_found", "Route not found.", { pathname });
}

function createRequestMetadata(request: Request, requestContext: RequestContext, sessionId: string | null) {
  return {
    idempotencyKey: requestContext.idempotencyKey,
    ipAddress: getIpAddress(request),
    requestId: requestContext.requestId,
    sessionId,
    traceparent: requestContext.traceparent
  };
}

function getIpAddress(request: Request): string | null {
  const forwardedIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  if (!forwardedIp) {
    return null;
  }

  return forwardedIp.split(",")[0]?.trim() ?? null;
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

function readActorContext(request: Request): { actor: RbacActor; sessionId: string | null } {
  const actorType = request.headers.get(internalActorTypeHeaderName);
  const actorId = request.headers.get(internalActorIdHeaderName);
  const sessionId = request.headers.get(internalSessionIdHeaderName);

  if (!actorType || !actorId) {
    throw new SourceplaneHttpError(401, "unauthenticated", "Authentication is required for this route.");
  }

  if (actorType !== "user" && actorType !== "service_principal") {
    throw new SourceplaneHttpError(403, "forbidden", "The actor type is not permitted for this action.");
  }

  return {
    actor: { id: actorId, type: actorType },
    sessionId
  };
}

function readOrganizationId(request: Request): string {
  const orgId = request.headers.get(internalOrgIdHeaderName);
  if (!orgId) {
    throw new SourceplaneHttpError(400, "bad_request", "Missing organization context for this request.", {
      header: internalOrgIdHeaderName
    });
  }
  return orgId;
}
