import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type BillingEdgeClient = PublicRouteClient;

export function createBillingClient(env: ApiEdgeEnv): BillingEdgeClient {
  return createBindingBackedPublicRouteClient("BILLING", env.BILLING);
}