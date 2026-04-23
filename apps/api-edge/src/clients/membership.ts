import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type MembershipEdgeClient = PublicRouteClient;

export function createMembershipClient(env: ApiEdgeEnv): MembershipEdgeClient {
  return createBindingBackedPublicRouteClient("MEMBERSHIP", env.MEMBERSHIP);
}