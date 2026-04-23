import { rbacActorSchema } from "@sourceplane/contracts";

import type { ApiEdgeEnv } from "../env.js";
import type { ServiceRequestMetadata } from "../types.js";
import { callJsonService, createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export interface IdentityPingResult {
  ok?: boolean;
  receivedRequestId?: string;
  receivedTraceparent?: string | null;
  service?: string;
  stage?: string;
}

export interface ResolvedIdentity {
  actor: ReturnType<typeof rbacActorSchema.parse> | null;
  organizationId?: string | null;
  sessionId?: string | null;
}

export interface IdentityEdgeClient extends PublicRouteClient {
  ping(metadata: ServiceRequestMetadata): Promise<IdentityPingResult>;
  resolveBearerToken(token: string, metadata: ServiceRequestMetadata): Promise<ResolvedIdentity>;
}

export function createIdentityClient(env: ApiEdgeEnv): IdentityEdgeClient {
  const publicClient = createBindingBackedPublicRouteClient("IDENTITY", env.IDENTITY);

  return {
    ...publicClient,
    async ping(metadata: ServiceRequestMetadata): Promise<IdentityPingResult> {
      return callJsonService<IdentityPingResult>({
        ...metadata,
        binding: env.IDENTITY,
        bindingName: "IDENTITY",
        method: "GET",
        notFoundMeansUnsupported: true,
        path: "/internal/ping"
      });
    },
    async resolveBearerToken(token: string, metadata: ServiceRequestMetadata): Promise<ResolvedIdentity> {
      const payload = await callJsonService<unknown>({
        ...metadata,
        binding: env.IDENTITY,
        bindingName: "IDENTITY",
        body: {
          token
        },
        method: "POST",
        notFoundMeansUnsupported: true,
        path: "/internal/auth/resolve"
      });

      return assertResolvedIdentity(payload);
    }
  };
}

function assertResolvedIdentity(payload: unknown): ResolvedIdentity {
  if (!payload || typeof payload !== "object") {
    throw new TypeError("Identity resolution payload must be an object.");
  }

  const actorValue = "actor" in payload ? payload.actor : undefined;
  const organizationIdValue = "organizationId" in payload ? payload.organizationId : undefined;
  const sessionIdValue = "sessionId" in payload ? payload.sessionId : undefined;

  if (actorValue !== null && actorValue !== undefined) {
    rbacActorSchema.parse(actorValue);
  }

  if (!isNullableString(organizationIdValue) || !isNullableString(sessionIdValue)) {
    throw new TypeError("Identity resolution payload contained invalid optional fields.");
  }

  const resolvedIdentity: ResolvedIdentity = {
    actor: actorValue === undefined ? null : (actorValue as ResolvedIdentity["actor"])
  };

  if (organizationIdValue !== undefined) {
    resolvedIdentity.organizationId = organizationIdValue;
  }

  if (sessionIdValue !== undefined) {
    resolvedIdentity.sessionId = sessionIdValue;
  }

  return resolvedIdentity;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}