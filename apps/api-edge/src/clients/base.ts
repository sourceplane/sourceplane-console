import { isApiErrorEnvelope } from "@sourceplane/contracts";
import type { WorkerServiceBinding } from "@sourceplane/shared";

import { EdgeHttpError, mapHttpStatusToErrorCode } from "../errors/edge-error.js";
import { buildForwardHeaders } from "../middleware/request-context.js";
import type { DomainRouteResult, PublicRouteClientRequest, ServiceRequestMetadata } from "../types.js";

export interface PublicRouteClient {
  handlePublicRequest(input: PublicRouteClientRequest): Promise<DomainRouteResult>;
}

interface ServiceCallOptions extends ServiceRequestMetadata {
  binding: WorkerServiceBinding | undefined;
  bindingName: string;
  body?: unknown;
  method: string;
  notFoundMeansUnsupported?: boolean;
  path: string;
}

export function createBindingBackedPublicRouteClient(
  bindingName: string,
  binding: WorkerServiceBinding | undefined
): PublicRouteClient {
  return {
    async handlePublicRequest(input: PublicRouteClientRequest): Promise<DomainRouteResult> {
      const responseData = await callJsonService<unknown>({
        auth: input.auth,
        binding,
        bindingName,
        body: input.jsonBody,
        method: input.method,
        path: `/internal/edge${input.publicPathname}${input.publicSearch}`,
        request: input.request,
        requestContext: input.requestContext,
        tenant: input.tenant
      });

      return {
        data: responseData
      };
    }
  };
}

export async function callJsonService<TData>(options: ServiceCallOptions): Promise<TData> {
  if (!options.binding) {
    throw new EdgeHttpError(
      501,
      "unsupported",
      `The ${options.bindingName} service binding is not configured for this environment.`,
      {
        binding: options.bindingName
      }
    );
  }

  const requestInit: RequestInit = {
    headers: buildRequestHeaders(options),
    method: options.method
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await options.binding.fetch(
    new Request(createInternalServiceUrl(options.bindingName, options.path), requestInit)
  );

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    if (options.notFoundMeansUnsupported && response.status === 404) {
      throw new EdgeHttpError(
        501,
        "unsupported",
        `The ${options.bindingName} service does not expose ${options.path} yet.`,
        {
          binding: options.bindingName,
          path: options.path
        }
      );
    }

    if (isApiErrorEnvelope(responseBody)) {
      throw new EdgeHttpError(response.status, responseBody.error.code, responseBody.error.message, responseBody.error.details);
    }

    throw new EdgeHttpError(
      response.status,
      mapHttpStatusToErrorCode(response.status),
      `The ${options.bindingName} service returned an error.`,
      {
        binding: options.bindingName,
        path: options.path,
        upstream: responseBody
      }
    );
  }

  if (isApiSuccessEnvelopePayload(responseBody)) {
    return responseBody.data as TData;
  }

  return responseBody as TData;
}

function buildRequestHeaders(options: ServiceCallOptions): Headers {
  const headers = buildForwardHeaders({
    auth: options.auth,
    request: options.request,
    requestContext: options.requestContext,
    tenant: options.tenant
  });

  if (options.body !== undefined) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return headers;
}

function createInternalServiceUrl(bindingName: string, path: string): string {
  return `http://${bindingName.toLowerCase()}.internal${path}`;
}

function isApiSuccessEnvelopePayload(
  value: unknown
): value is { data: unknown; meta: { cursor: string | null; requestId: string } } {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("data" in value) || !("meta" in value) || !value.meta || typeof value.meta !== "object") {
    return false;
  }

  const meta = value.meta;

  return "requestId" in meta && typeof meta.requestId === "string" && "cursor" in meta;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase();
  if (!contentType?.includes("application/json")) {
    return rawText;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw new EdgeHttpError(502, "internal_error", "A downstream service returned malformed JSON.", {
      contentType,
      rawText
    });
  }
}