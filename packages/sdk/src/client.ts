import type { ApiErrorEnvelope, ApiSuccessEnvelope } from "@sourceplane/contracts";
import { SourceplaneHttpError } from "@sourceplane/shared";

export interface SourceplaneClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  token?: string;
}

export class SourceplaneClient {
  private readonly baseUrl: URL;
  private readonly fetchImplementation: typeof fetch;
  private readonly token: string | undefined;

  constructor(options: SourceplaneClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.fetchImplementation = options.fetch ?? fetch;
    this.token = options.token;
  }

  async health(): Promise<ApiSuccessEnvelope<{ ok: true; service: string }>> {
    return this.request<{ ok: true; service: string }>("/healthz");
  }

  async listRouteGroups(): Promise<ApiSuccessEnvelope<{ groups: string[] }>> {
    return this.request<{ groups: string[] }>("/v1/system/routes");
  }

  private async request<TData>(pathname: string): Promise<ApiSuccessEnvelope<TData>> {
    const requestInit: RequestInit = {};

    if (this.token) {
      requestInit.headers = {
        authorization: `Bearer ${this.token}`
      };
    }

    const response = await this.fetchImplementation(new URL(pathname, this.baseUrl), requestInit);

    const payload = (await response.json()) as ApiSuccessEnvelope<TData> | ApiErrorEnvelope;

    if (!response.ok) {
      const error = (payload as ApiErrorEnvelope).error;
      throw new SourceplaneHttpError(response.status, error.code, error.message, error.details);
    }

    return payload as ApiSuccessEnvelope<TData>;
  }
}
