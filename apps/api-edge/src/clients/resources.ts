import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type ResourcesEdgeClient = PublicRouteClient;

export function createResourcesClient(env: ApiEdgeEnv): ResourcesEdgeClient {
  return createBindingBackedPublicRouteClient("RESOURCES", env.RESOURCES);
}