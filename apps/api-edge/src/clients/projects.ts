import type { ApiEdgeEnv } from "../env.js";

import { createBindingBackedPublicRouteClient, type PublicRouteClient } from "./base.js";

export type ProjectsEdgeClient = PublicRouteClient;

export function createProjectsClient(env: ApiEdgeEnv): ProjectsEdgeClient {
  return createBindingBackedPublicRouteClient("PROJECTS", env.PROJECTS);
}