import type { SourceplaneErrorCode } from "@sourceplane/contracts";

export class EdgeHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: SourceplaneErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export function isEdgeHttpError(error: unknown): error is EdgeHttpError {
  return error instanceof EdgeHttpError;
}

export function mapHttpStatusToErrorCode(status: number): SourceplaneErrorCode {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthenticated";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 412:
      return "precondition_failed";
    case 415:
      return "unsupported";
    case 422:
      return "validation_failed";
    case 429:
      return "rate_limited";
    default:
      return "internal_error";
  }
}