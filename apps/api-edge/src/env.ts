import type { SourceplaneWorkerEnv, WorkerServiceBinding } from "@sourceplane/shared";

export interface ApiEdgeEnv extends SourceplaneWorkerEnv {
  BILLING?: WorkerServiceBinding;
  CONFIG?: WorkerServiceBinding;
  EVENTS?: WorkerServiceBinding;
  IDENTITY?: WorkerServiceBinding;
  MEMBERSHIP?: WorkerServiceBinding;
  METERING?: WorkerServiceBinding;
  POLICY?: WorkerServiceBinding;
  PROJECTS?: WorkerServiceBinding;
  RESOURCES?: WorkerServiceBinding;
  RUNTIME?: WorkerServiceBinding;
}
