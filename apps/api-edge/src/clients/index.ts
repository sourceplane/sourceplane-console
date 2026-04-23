export * from "./audit.js";
export * from "./base.js";
export * from "./billing.js";
export * from "./config.js";
export * from "./identity.js";
export * from "./membership.js";
export * from "./metering.js";
export * from "./policy.js";
export * from "./projects.js";
export * from "./resources.js";
export * from "./runtime.js";

import type { ApiEdgeEnv } from "../env.js";
import type { PublicRouteClientKey } from "../types.js";
import { createAuditClient, type AuditEdgeClient } from "./audit.js";
import { createBillingClient, type BillingEdgeClient } from "./billing.js";
import { createConfigClient, type ConfigEdgeClient } from "./config.js";
import { createIdentityClient, type IdentityEdgeClient } from "./identity.js";
import { createMembershipClient, type MembershipEdgeClient } from "./membership.js";
import { createMeteringClient, type MeteringEdgeClient } from "./metering.js";
import { createPolicyClient, type PolicyEdgeClient } from "./policy.js";
import { createProjectsClient, type ProjectsEdgeClient } from "./projects.js";
import { createResourcesClient, type ResourcesEdgeClient } from "./resources.js";
import { createRuntimeClient, type RuntimeEdgeClient } from "./runtime.js";
import type { PublicRouteClient } from "./base.js";

export interface ApiEdgeServices {
  audit: AuditEdgeClient;
  billing: BillingEdgeClient;
  config: ConfigEdgeClient;
  identity: IdentityEdgeClient;
  membership: MembershipEdgeClient;
  metering: MeteringEdgeClient;
  policy: PolicyEdgeClient;
  projects: ProjectsEdgeClient;
  publicClients: Record<PublicRouteClientKey, PublicRouteClient>;
  resources: ResourcesEdgeClient;
  runtime: RuntimeEdgeClient;
}

export function createApiEdgeServices(env: ApiEdgeEnv): ApiEdgeServices {
  const identity = createIdentityClient(env);
  const membership = createMembershipClient(env);
  const projects = createProjectsClient(env);
  const resources = createResourcesClient(env);
  const config = createConfigClient(env);
  const runtime = createRuntimeClient(env);
  const audit = createAuditClient(env);
  const metering = createMeteringClient(env);
  const billing = createBillingClient(env);

  return {
    audit,
    billing,
    config,
    identity,
    membership,
    metering,
    policy: createPolicyClient(env),
    projects,
    publicClients: {
      audit,
      billing,
      config,
      identity,
      membership,
      metering,
      projects,
      resources,
      runtime
    },
    resources,
    runtime
  };
}