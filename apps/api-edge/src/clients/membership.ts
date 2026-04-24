import {
  authorizationMembershipResolveResponseSchema,
  type AuthorizationMembershipResolveRequest,
  type AuthorizationMembershipResolveResponse
} from "@sourceplane/contracts";

import type { ApiEdgeEnv } from "../env.js";
import type { ServiceRequestMetadata } from "../types.js";

import { callJsonService, createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export interface MembershipEdgeClient extends PublicRouteClient {
  resolveAuthorizationMemberships(
    input: AuthorizationMembershipResolveRequest,
    metadata: ServiceRequestMetadata
  ): Promise<AuthorizationMembershipResolveResponse>;
}

export function createMembershipClient(env: ApiEdgeEnv): MembershipEdgeClient {
  const publicClient = createBindingBackedPublicRouteClient("MEMBERSHIP", env.MEMBERSHIP);

  return {
    ...publicClient,
    async resolveAuthorizationMemberships(
      input: AuthorizationMembershipResolveRequest,
      metadata: ServiceRequestMetadata
    ): Promise<AuthorizationMembershipResolveResponse> {
      if (!env.MEMBERSHIP) {
        return {
          memberships: []
        };
      }

      const payload = await callJsonService<unknown>({
        ...metadata,
        binding: env.MEMBERSHIP,
        bindingName: "MEMBERSHIP",
        body: input,
        method: "POST",
        notFoundMeansUnsupported: true,
        path: "/internal/authorization-memberships/resolve"
      });

      return authorizationMembershipResolveResponseSchema.parse(payload);
    }
  };
}