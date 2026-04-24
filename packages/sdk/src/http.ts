import {
  internalOrgIdHeaderName,
  type ApiErrorEnvelope,
  type ApiSuccessEnvelope
} from "@sourceplane/contracts";
import { SourceplaneHttpError } from "@sourceplane/shared";

export interface SourceplaneClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  token?: string;
  activeOrgId?: string;
}

export interface InternalRequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
  orgId?: string | null;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  authenticated?: boolean;
}

export class SourceplaneApiClient {
  protected readonly baseUrl: URL;
  protected readonly fetchImplementation: typeof fetch;
  protected token: string | undefined;
  protected activeOrgId: string | undefined;

  constructor(options: SourceplaneClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.token = options.token;
    this.activeOrgId = options.activeOrgId;
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  getToken(): string | undefined {
    return this.token;
  }

  setActiveOrgId(orgId: string | undefined): void {
    this.activeOrgId = orgId;
  }

  getActiveOrgId(): string | undefined {
    return this.activeOrgId;
  }

  async request<TData>(pathname: string, options: InternalRequestOptions = {}): Promise<TData> {
    const url = new URL(pathname, this.baseUrl);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers = new Headers();
    if (options.body !== undefined && options.body !== null) {
      headers.set("content-type", "application/json");
    }
    if (this.token && options.authenticated !== false) {
      headers.set("authorization", `Bearer ${this.token}`);
    }
    const orgId = options.orgId === null ? undefined : options.orgId ?? this.activeOrgId;
    if (orgId) {
      headers.set(internalOrgIdHeaderName, orgId);
    }
    if (options.idempotencyKey) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }

    const requestInit: RequestInit = {
      method: options.method ?? "GET",
      headers
    };
    if (options.body !== undefined && options.body !== null) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImplementation(url, requestInit);
    const rawText = await response.text();
    const payload: unknown = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      const errorEnvelope = payload as ApiErrorEnvelope | null;
      const errorBody = errorEnvelope?.error ?? {
        code: "internal_error" as const,
        details: {},
        message: `Request to ${pathname} failed with status ${String(response.status)}.`,
        requestId: "req_unknown"
      };
      throw new SourceplaneHttpError(response.status, errorBody.code, errorBody.message, errorBody.details);
    }

    return (payload as ApiSuccessEnvelope<TData>).data;
  }
}

export function generateIdempotencyKey(prefix = "idem"): string {
  const random = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${random}`;
}
