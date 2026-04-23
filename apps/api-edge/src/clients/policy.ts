import { authorizationResponseSchema, type AuthorizationRequest, type AuthorizationResponse } from "@sourceplane/contracts";

import type { ApiEdgeEnv } from "../env.js";
import type { ServiceRequestMetadata } from "../types.js";
import { callJsonService } from "./base.js";

export interface PolicyEdgeClient {
  authorize(input: AuthorizationRequest, metadata: ServiceRequestMetadata): Promise<AuthorizationResponse>;
}

export function createPolicyClient(env: ApiEdgeEnv): PolicyEdgeClient {
  return {
    async authorize(input: AuthorizationRequest, metadata: ServiceRequestMetadata): Promise<AuthorizationResponse> {
      const payload = await callJsonService<unknown>({
        ...metadata,
        binding: env.POLICY,
        bindingName: "POLICY",
        body: input,
        method: "POST",
        notFoundMeansUnsupported: true,
        path: "/internal/authorize"
      });

      return authorizationResponseSchema.parse(payload);
    }
  };
}