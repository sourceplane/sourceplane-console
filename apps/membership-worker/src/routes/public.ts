import {
  acceptOrganizationInviteRequestSchema,
  createOrganizationInviteRequestSchema,
  createOrganizationRequestSchema,
  internalActorIdHeaderName,
  internalActorTypeHeaderName,
  internalSessionIdHeaderName,
  listOrganizationMembersResponseSchema,
  listOrganizationsResponseSchema,
  updateOrganizationMemberRequestSchema,
  updateOrganizationRequestSchema,
  type RbacActor
} from "@sourceplane/contracts";
import { jsonSuccess, SourceplaneHttpError, type RequestContext } from "@sourceplane/shared";

import type {
  AcceptInviteInput,
  CreateOrganizationInput,
  InviteMemberInput,
  MembershipService,
  RemoveMemberInput,
  UpdateMemberRoleInput,
  UpdateOrganizationInput
} from "../domain/service.js";

const internalEdgePrefix = "/internal/edge";

type UserActor = RbacActor & { type: "user" };

export async function handleForwardedMembershipPublicRequest(options: {
  request: Request;
  requestContext: RequestContext;
  service: MembershipService;
  url: URL;
}): Promise<Response> {
  const publicPath = options.url.pathname.slice(internalEdgePrefix.length);

  if (publicPath === "/v1/organizations" && options.request.method === "GET") {
    const actorContext = readForwardedUserContext(options.request);
    const response = listOrganizationsResponseSchema.parse(
      await options.service.listOrganizationsForActor({
        actor: actorContext.actor
      })
    );

    return jsonSuccess(response, options.requestContext.requestId);
  }

  if (publicPath === "/v1/organizations" && options.request.method === "POST") {
    const actorContext = readForwardedUserContext(options.request);
    const body = createOrganizationRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.createOrganization({
      ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
      actor: actorContext.actor,
      name: body.name,
      ...(body.slug === undefined ? {} : { slug: body.slug })
    } satisfies CreateOrganizationInput);

    return jsonSuccess(response, options.requestContext.requestId, {
      status: 201
    });
  }

  const organizationMatch = publicPath.match(/^\/v1\/organizations\/([^/]+)$/u);
  if (organizationMatch && options.request.method === "GET") {
    const organizationId = organizationMatch[1];
    if (!organizationId) {
      throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
        pathname: options.url.pathname
      });
    }

    const response = await options.service.getOrganization({
      organizationId
    });

    return jsonSuccess(response, options.requestContext.requestId);
  }

  if (organizationMatch && options.request.method === "PATCH") {
    const actorContext = readForwardedUserContext(options.request);
    const organizationId = organizationMatch[1];
    if (!organizationId) {
      throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
        pathname: options.url.pathname
      });
    }

    const body = updateOrganizationRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.updateOrganization({
      ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
      actor: actorContext.actor,
      organizationId,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.slug === undefined ? {} : { slug: body.slug })
    } satisfies UpdateOrganizationInput);

    return jsonSuccess(response, options.requestContext.requestId);
  }

  const memberListMatch = publicPath.match(/^\/v1\/organizations\/([^/]+)\/members$/u);
  if (memberListMatch && options.request.method === "GET") {
    const organizationId = memberListMatch[1];
    if (!organizationId) {
      throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
        pathname: options.url.pathname
      });
    }

    const response = listOrganizationMembersResponseSchema.parse(
      await options.service.listMembers({
        organizationId
      })
    );

    return jsonSuccess(response, options.requestContext.requestId);
  }

  const createInviteMatch = publicPath.match(/^\/v1\/organizations\/([^/]+)\/invites$/u);
  if (createInviteMatch && options.request.method === "POST") {
    const actorContext = readForwardedUserContext(options.request);
    const organizationId = createInviteMatch[1];
    if (!organizationId) {
      throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
        pathname: options.url.pathname
      });
    }

    const body = createOrganizationInviteRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.inviteMember({
      ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
      actor: actorContext.actor,
      email: body.email,
      organizationId,
      role: body.role,
      ...(body.expiresAt === undefined ? {} : { expiresAt: body.expiresAt })
    } satisfies InviteMemberInput);

    return jsonSuccess(response, options.requestContext.requestId, {
      status: 201
    });
  }

  const acceptInviteMatch = publicPath.match(/^\/v1\/organizations\/invites\/([^/]+)\/accept$/u);
  if (acceptInviteMatch && options.request.method === "POST") {
    const actorContext = readForwardedUserContext(options.request);
    const inviteId = acceptInviteMatch[1];
    if (!inviteId) {
      throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
        pathname: options.url.pathname
      });
    }

    const body = acceptOrganizationInviteRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.acceptInvite({
      ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
      actor: actorContext.actor,
      inviteId,
      token: body.token
    } satisfies AcceptInviteInput);

    return jsonSuccess(response, options.requestContext.requestId);
  }

  const memberMatch = publicPath.match(/^\/v1\/organizations\/([^/]+)\/members\/([^/]+)$/u);
  if (memberMatch && options.request.method === "PATCH") {
    const actorContext = readForwardedUserContext(options.request);
    const organizationId = memberMatch[1];
    const memberId = memberMatch[2];
    if (!organizationId || !memberId) {
      throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
        pathname: options.url.pathname
      });
    }

    const body = updateOrganizationMemberRequestSchema.parse(await parseJsonBody(options.request));
    const response = await options.service.updateMemberRole({
      ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
      actor: actorContext.actor,
      memberId,
      organizationId,
      role: body.role
    } satisfies UpdateMemberRoleInput);

    return jsonSuccess(response, options.requestContext.requestId);
  }

  if (memberMatch && options.request.method === "DELETE") {
    const actorContext = readForwardedUserContext(options.request);
    const organizationId = memberMatch[1];
    const memberId = memberMatch[2];
    if (!organizationId || !memberId) {
      throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
        pathname: options.url.pathname
      });
    }

    const response = await options.service.removeMember({
      ...createRequestMetadata(options.request, options.requestContext, actorContext.sessionId),
      actor: actorContext.actor,
      memberId,
      organizationId
    } satisfies RemoveMemberInput);

    return jsonSuccess(response, options.requestContext.requestId);
  }

  throw new SourceplaneHttpError(404, "not_found", "Route not found.", {
    pathname: options.url.pathname
  });
}

function createRequestMetadata(request: Request, requestContext: RequestContext, sessionId: string) {
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

function readForwardedUserContext(request: Request): {
  actor: UserActor;
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
