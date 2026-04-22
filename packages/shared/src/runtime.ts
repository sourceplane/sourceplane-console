import { sourceplaneStages, type DeploymentEnvironment } from "@sourceplane/contracts";

export interface WorkerServiceBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface SourceplaneWorkerEnv {
  APP_NAME: string;
  APP_VERSION?: string;
  ENVIRONMENT: string;
}

export function parseDeploymentEnvironment(value: string | undefined): DeploymentEnvironment {
  if (value && sourceplaneStages.includes(value as DeploymentEnvironment)) {
    return value as DeploymentEnvironment;
  }

  return "local";
}

export function hasServiceBinding(binding: WorkerServiceBinding | undefined): binding is WorkerServiceBinding {
  return typeof binding?.fetch === "function";
}
