import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type MeteringEdgeClient = PublicRouteClient;

export function createMeteringClient(env: ApiEdgeEnv): MeteringEdgeClient {
  return createBindingBackedPublicRouteClient("METERING", env.METERING);
}