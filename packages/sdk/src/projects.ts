import type {
  ArchiveEnvironmentResponse,
  ArchiveProjectResponse,
  CreateEnvironmentRequest,
  CreateEnvironmentResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  Environment,
  GetEnvironmentResponse,
  GetProjectResponse,
  ListEnvironmentsResponse,
  ListProjectsResponse,
  Project,
  UpdateEnvironmentRequest,
  UpdateEnvironmentResponse,
  UpdateProjectRequest,
  UpdateProjectResponse
} from "@sourceplane/contracts";

import { generateIdempotencyKey, type SourceplaneApiClient } from "./http.js";

export interface OrgScopedOptions {
  orgId?: string;
}

export class EnvironmentsApi {
  constructor(private readonly client: SourceplaneApiClient) {}

  async list(projectId: string, options: OrgScopedOptions = {}): Promise<Environment[]> {
    const data = await this.client.request<ListEnvironmentsResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}/environments`,
      this.scope(options)
    );
    return data.environments;
  }

  async create(
    projectId: string,
    input: CreateEnvironmentRequest,
    options: OrgScopedOptions & { idempotencyKey?: string } = {}
  ): Promise<CreateEnvironmentResponse> {
    return this.client.request<CreateEnvironmentResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}/environments`,
      {
        method: "POST",
        body: input,
        ...this.scope(options),
        idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey("env")
      }
    );
  }

  async get(environmentId: string, options: OrgScopedOptions = {}): Promise<Environment> {
    const data = await this.client.request<GetEnvironmentResponse>(
      `/v1/environments/${encodeURIComponent(environmentId)}`,
      this.scope(options)
    );
    return data.environment;
  }

  async update(
    environmentId: string,
    input: UpdateEnvironmentRequest,
    options: OrgScopedOptions = {}
  ): Promise<UpdateEnvironmentResponse> {
    return this.client.request<UpdateEnvironmentResponse>(
      `/v1/environments/${encodeURIComponent(environmentId)}`,
      { method: "PATCH", body: input, ...this.scope(options) }
    );
  }

  async archive(environmentId: string, options: OrgScopedOptions = {}): Promise<ArchiveEnvironmentResponse> {
    return this.client.request<ArchiveEnvironmentResponse>(
      `/v1/environments/${encodeURIComponent(environmentId)}`,
      { method: "DELETE", ...this.scope(options) }
    );
  }

  private scope(options: OrgScopedOptions): { orgId?: string } {
    return options.orgId === undefined ? {} : { orgId: options.orgId };
  }
}

export class ProjectsApi {
  readonly environments: EnvironmentsApi;

  constructor(private readonly client: SourceplaneApiClient) {
    this.environments = new EnvironmentsApi(client);
  }

  async list(options: OrgScopedOptions = {}): Promise<Project[]> {
    const data = await this.client.request<ListProjectsResponse>("/v1/projects", this.scope(options));
    return data.projects;
  }

  async create(
    input: CreateProjectRequest,
    options: OrgScopedOptions & { idempotencyKey?: string } = {}
  ): Promise<CreateProjectResponse> {
    return this.client.request<CreateProjectResponse>("/v1/projects", {
      method: "POST",
      body: input,
      ...this.scope(options),
      idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey("project")
    });
  }

  async get(projectId: string, options: OrgScopedOptions = {}): Promise<Project> {
    const data = await this.client.request<GetProjectResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}`,
      this.scope(options)
    );
    return data.project;
  }

  async update(
    projectId: string,
    input: UpdateProjectRequest,
    options: OrgScopedOptions = {}
  ): Promise<UpdateProjectResponse> {
    return this.client.request<UpdateProjectResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}`,
      { method: "PATCH", body: input, ...this.scope(options) }
    );
  }

  async archive(projectId: string, options: OrgScopedOptions = {}): Promise<ArchiveProjectResponse> {
    return this.client.request<ArchiveProjectResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}`,
      { method: "DELETE", ...this.scope(options) }
    );
  }

  private scope(options: OrgScopedOptions): { orgId?: string } {
    return options.orgId === undefined ? {} : { orgId: options.orgId };
  }
}
