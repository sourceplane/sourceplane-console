import {
  createErrorResponse,
  createSuccessResponse,
  requestIdHeaderName,
  type SourceplaneErrorCode
} from "@sourceplane/contracts";

import { isEdgeHttpError } from "../errors/edge-error.js";

interface JsonResponseOptions {
  headers?: HeadersInit;
  requestId: string;
  status: number;
}

export function jsonSuccess<TData>(
  data: TData,
  options: {
    cursor?: string | null;
    headers?: HeadersInit;
    requestId: string;
    status?: number;
  }
): Response {
  const responseOptions: JsonResponseOptions = {
    requestId: options.requestId,
    status: options.status ?? 200
  };

  if (options.headers) {
    responseOptions.headers = options.headers;
  }

  return json(
    createSuccessResponse(data, {
      cursor: options.cursor ?? null,
      requestId: options.requestId
    }),
    responseOptions
  );
}

export function jsonError(
  status: number,
  options: {
    code: SourceplaneErrorCode;
    details?: Record<string, unknown>;
    headers?: HeadersInit;
    message: string;
    requestId: string;
  }
): Response {
  const responseOptions: JsonResponseOptions = {
    requestId: options.requestId,
    status
  };

  if (options.headers) {
    responseOptions.headers = options.headers;
  }

  const errorOptions: {
    code: SourceplaneErrorCode;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  } = {
    code: options.code,
    message: options.message,
    requestId: options.requestId
  };

  if (options.details) {
    errorOptions.details = options.details;
  }

  return json(
    createErrorResponse(errorOptions),
    responseOptions
  );
}

export function toErrorResponse(error: unknown, requestId: string): Response {
  if (isEdgeHttpError(error)) {
    return jsonError(error.status, {
      code: error.code,
      details: error.details,
      message: error.message,
      requestId
    });
  }

  return jsonError(500, {
    code: "internal_error",
    details: {
      message: error instanceof Error ? error.message : "Unknown error"
    },
    message: "api-edge failed to handle the request.",
    requestId
  });
}

function json(value: unknown, options: JsonResponseOptions): Response {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set(requestIdHeaderName, options.requestId);

  return new Response(JSON.stringify(value, null, 2), {
    headers,
    status: options.status
  });
}