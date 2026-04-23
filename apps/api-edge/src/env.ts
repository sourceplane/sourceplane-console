import type { ServiceStatus } from "@sourceplane/contracts";
import { hasServiceBinding, type SourceplaneWorkerEnv, type WorkerServiceBinding } from "@sourceplane/shared";

export const downstreamServiceBindings = [
  "IDENTITY",
  "POLICY",
  "MEMBERSHIP",
  "PROJECTS",
  "RESOURCES",
  "CONFIG",
  "RUNTIME",
  "EVENTS",
  "METERING",
  "BILLING"
] as const;

export type DownstreamServiceBindingName = (typeof downstreamServiceBindings)[number];

export interface ApiEdgeEnv extends SourceplaneWorkerEnv {
  BILLING?: WorkerServiceBinding;
  CONFIG?: WorkerServiceBinding;
  EDGE_IDEMPOTENCY?: KVNamespace;
  EVENTS?: WorkerServiceBinding;
  IDENTITY?: WorkerServiceBinding;
  MEMBERSHIP?: WorkerServiceBinding;
  METERING?: WorkerServiceBinding;
  POLICY?: WorkerServiceBinding;
  PROJECTS?: WorkerServiceBinding;
  RESOURCES?: WorkerServiceBinding;
  RUNTIME?: WorkerServiceBinding;
}

export function getEdgeServiceStatuses(env: ApiEdgeEnv): ServiceStatus[] {
  const serviceStatuses = downstreamServiceBindings.map((bindingName) => ({
    name: bindingName,
    status: hasServiceBinding(env[bindingName]) ? "ok" : "pending"
  })) satisfies ServiceStatus[];

  return [
    ...serviceStatuses,
    {
      name: "EDGE_IDEMPOTENCY",
      status: env.EDGE_IDEMPOTENCY ? "ok" : "pending"
    }
  ];
}
