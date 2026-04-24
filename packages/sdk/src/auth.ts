import type {
  ApiKeyView,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ListApiKeysResponse,
  LoginCompleteRequest,
  LoginCompleteResponse,
  LoginStartRequest,
  LoginStartResponse,
  LogoutResponse,
  ResolveSessionResponse,
  RevokeApiKeyResponse
} from "@sourceplane/contracts";

import { generateIdempotencyKey, type SourceplaneApiClient } from "./http.js";

export class AuthApiKeysApi {
  constructor(private readonly client: SourceplaneApiClient) {}

  async list(): Promise<ApiKeyView[]> {
    const data = await this.client.request<ListApiKeysResponse>("/v1/auth/api-keys");
    return data.apiKeys;
  }

  async create(input: CreateApiKeyRequest, options: { idempotencyKey?: string } = {}): Promise<CreateApiKeyResponse> {
    return this.client.request<CreateApiKeyResponse>("/v1/auth/api-keys", {
      method: "POST",
      body: input,
      idempotencyKey: options.idempotencyKey ?? generateIdempotencyKey("apikey")
    });
  }

  async delete(apiKeyId: string): Promise<RevokeApiKeyResponse> {
    return this.client.request<RevokeApiKeyResponse>(`/v1/auth/api-keys/${encodeURIComponent(apiKeyId)}`, {
      method: "DELETE"
    });
  }
}

export class AuthApi {
  readonly apiKeys: AuthApiKeysApi;

  constructor(private readonly client: SourceplaneApiClient) {
    this.apiKeys = new AuthApiKeysApi(client);
  }

  async loginStart(input: LoginStartRequest): Promise<LoginStartResponse> {
    return this.client.request<LoginStartResponse>("/v1/auth/login/start", {
      method: "POST",
      body: input,
      authenticated: false
    });
  }

  async loginComplete(input: LoginCompleteRequest): Promise<LoginCompleteResponse> {
    return this.client.request<LoginCompleteResponse>("/v1/auth/login/complete", {
      method: "POST",
      body: input,
      authenticated: false
    });
  }

  async session(): Promise<ResolveSessionResponse> {
    return this.client.request<ResolveSessionResponse>("/v1/auth/session");
  }

  async logout(): Promise<LogoutResponse> {
    return this.client.request<LogoutResponse>("/v1/auth/logout", {
      method: "POST",
      idempotencyKey: generateIdempotencyKey("logout")
    });
  }
}
