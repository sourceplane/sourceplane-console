import { identityResolveResultSchema, type IdentityResolveResult } from "@sourceplane/contracts";

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

export type ResolvedIdentity = IdentityResolveResult;

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

      return identityResolveResultSchema.parse(payload);
    }
  };
}