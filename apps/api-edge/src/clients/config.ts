import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type ConfigEdgeClient = PublicRouteClient;

export function createConfigClient(env: ApiEdgeEnv): ConfigEdgeClient {
  return createBindingBackedPublicRouteClient("CONFIG", env.CONFIG);
}