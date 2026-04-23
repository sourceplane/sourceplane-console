import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type AuditEdgeClient = PublicRouteClient;

export function createAuditClient(env: ApiEdgeEnv): AuditEdgeClient {
  return createBindingBackedPublicRouteClient("EVENTS", env.EVENTS);
}