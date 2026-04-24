import type { ApiSuccessEnvelope } from "@sourceplane/contracts";

import { AuthApi } from "./auth.js";
import { SourceplaneApiClient, type SourceplaneClientOptions } from "./http.js";
import { OrganizationsApi } from "./organizations.js";
import { ProjectsApi } from "./projects.js";

export class SourceplaneClient extends SourceplaneApiClient {
  readonly auth: AuthApi;
  readonly organizations: OrganizationsApi;
  readonly projects: ProjectsApi;

  constructor(options: SourceplaneClientOptions) {
    super(options);
    this.auth = new AuthApi(this);
    this.organizations = new OrganizationsApi(this);
    this.projects = new ProjectsApi(this);
  }

  withOrg(orgId: string | undefined): this {
    this.setActiveOrgId(orgId);
    return this;
  }

  async health(): Promise<ApiSuccessEnvelope<{ ok: true; service: string }>> {
    const data = await this.request<{ ok: true; service: string }>("/healthz", { authenticated: false });
    return {
      data,
      meta: { cursor: null, requestId: "req_local" }
    } satisfies ApiSuccessEnvelope<{ ok: true; service: string }>;
  }

  async listRouteGroups(): Promise<ApiSuccessEnvelope<{ groups: unknown }>> {
    const data = await this.request<{ groups: unknown }>("/v1/system/routes", { authenticated: false });
    return {
      data,
      meta: { cursor: null, requestId: "req_local" }
    } satisfies ApiSuccessEnvelope<{ groups: unknown }>;
  }
}

export type { SourceplaneClientOptions } from "./http.js";
