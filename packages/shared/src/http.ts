import type { ApiErrorEnvelope, ApiSuccessEnvelope, SourceplaneErrorCode } from "@sourceplane/contracts";

export interface RequestContext {
  idempotencyKey: string | null;
  requestId: string;
  traceparent: string | null;
}

export class SourceplaneHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: SourceplaneErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export function createRequestId(prefix = "req"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function createRequestContext(request: Request): RequestContext {
  return {
    idempotencyKey: request.headers.get("Idempotency-Key"),
    requestId: request.headers.get("x-sourceplane-request-id") ?? createRequestId(),
    traceparent: request.headers.get("traceparent")
  };
}

export function jsonSuccess<TData>(
  data: TData,
  requestId: string,
  init: ResponseInit = {}
): Response {
  const body: ApiSuccessEnvelope<TData> = {
    data,
    meta: {
      cursor: null,
      requestId
    }
  };

  return json(body, init.status ?? 200, init.headers);
}

export function jsonError(
  status: number,
  options: {
    code: SourceplaneErrorCode;
    details?: Record<string, unknown>;
    message: string;
    requestId: string;
  },
  headers?: HeadersInit
): Response {
  const body: ApiErrorEnvelope = {
    error: {
      code: options.code,
      details: options.details ?? {},
      message: options.message,
      requestId: options.requestId
    }
  };

  return json(body, status, headers);
}

function json(value: unknown, status: number, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(value, null, 2), {
    headers: responseHeaders,
    status
  });
}
