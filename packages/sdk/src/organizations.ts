import type {
  AcceptOrganizationInviteResponse,
  CreateOrganizationInviteRequest,
  CreateOrganizationInviteResponse,
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  GetOrganizationResponse,
  ListOrganizationMembersResponse,
  ListOrganizationsResponse,
  Organization,
  OrganizationListItem,
  OrganizationMember,
  RemoveOrganizationMemberResponse,
  UpdateOrganizationMemberRequest,
  UpdateOrganizationMemberResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse
} from "@sourceplane/contracts";

import { generateIdempotencyKey, type SourceplaneApiClient } from "./http.js";

export class OrganizationMembersApi {
  constructor(private readonly client: SourceplaneApiClient) {}

  async list(orgId: string): Promise<OrganizationMember[]> {
    const data = await this.client.request<ListOrganizationMembersResponse>(
      `/v1/organizations/${encodeURIComponent(orgId)}/members`,
      { orgId }
    );
    return data.members;
  }

  async update(
    orgId: string,
    memberId: string,
    input: UpdateOrganizationMemberRequest
  ): Promise<UpdateOrganizationMemberResponse> {
    return this.client.request<UpdateOrganizationMemberResponse>(
      `/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}`,
      { method: "PATCH", body: input, orgId }
    );
  }

  async remove(orgId: string, memberId: string): Promise<RemoveOrganizationMemberResponse> {
    return this.client.request<RemoveOrganizationMemberResponse>(
      `/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE", orgId }
    );
  }
}

export class OrganizationInvitesApi {
  constructor(private readonly client: SourceplaneApiClient) {}

  async create(
    orgId: string,
    input: CreateOrganizationInviteRequest,
    options: { idempotencyKey?: string } = {}
  ): Promise<CreateOrganizationInviteResponse> {
    return this.client.request<CreateOrganizationInviteResponse>(
      `/v1/organizations/${encodeURIComponent(orgId)}/invites`,
      {
        method: "POST",
        body: input,
        orgId,
        idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey("invite")
      }
    );
  }

  async accept(
    inviteId: string,
    token: string,
    options: { idempotencyKey?: string } = {}
  ): Promise<AcceptOrganizationInviteResponse> {
    return this.client.request<AcceptOrganizationInviteResponse>(
      `/v1/organizations/invites/${encodeURIComponent(inviteId)}/accept`,
      {
        method: "POST",
        body: { token },
        idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey("accept")
      }
    );
  }
}

export class OrganizationsApi {
  readonly members: OrganizationMembersApi;
  readonly invites: OrganizationInvitesApi;

  constructor(private readonly client: SourceplaneApiClient) {
    this.members = new OrganizationMembersApi(client);
    this.invites = new OrganizationInvitesApi(client);
  }

  async list(): Promise<OrganizationListItem[]> {
    const data = await this.client.request<ListOrganizationsResponse>("/v1/organizations");
    return data.organizations;
  }

  async create(
    input: CreateOrganizationRequest,
    options: { idempotencyKey?: string } = {}
  ): Promise<CreateOrganizationResponse> {
    return this.client.request<CreateOrganizationResponse>("/v1/organizations", {
      method: "POST",
      body: input,
      idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey("org")
    });
  }

  async get(orgId: string): Promise<Organization> {
    const data = await this.client.request<GetOrganizationResponse>(
      `/v1/organizations/${encodeURIComponent(orgId)}`,
      { orgId }
    );
    return data.organization;
  }

  async update(orgId: string, input: UpdateOrganizationRequest): Promise<UpdateOrganizationResponse> {
    return this.client.request<UpdateOrganizationResponse>(
      `/v1/organizations/${encodeURIComponent(orgId)}`,
      { method: "PATCH", body: input, orgId }
    );
  }
}
