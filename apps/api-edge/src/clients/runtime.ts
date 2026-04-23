import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type RuntimeEdgeClient = PublicRouteClient;

export function createRuntimeClient(env: ApiEdgeEnv): RuntimeEdgeClient {
  return createBindingBackedPublicRouteClient("RUNTIME", env.RUNTIME);
}