import {
  identityUserLookupRequestSchema,
  identityUserLookupResponseSchema,
  isApiErrorEnvelope,
  type IdentityUser
} from "@sourceplane/contracts";
import { SourceplaneHttpError, type WorkerServiceBinding } from "@sourceplane/shared";

export interface IdentityDirectoryMetadata {
  requestId: string;
  traceparent: string | null;
}

export interface IdentityDirectory {
  getUserById(userId: string, metadata: IdentityDirectoryMetadata): Promise<IdentityUser | null>;
}

export function createIdentityDirectory(binding: WorkerServiceBinding | undefined): IdentityDirectory {
  return {
    async getUserById(userId: string, metadata: IdentityDirectoryMetadata): Promise<IdentityUser | null> {
      if (!binding) {
        throw new SourceplaneHttpError(
          501,
          "unsupported",
          "The IDENTITY service binding is not configured for this environment.",
          {
            binding: "IDENTITY"
          }
        );
      }

      const requestBody = identityUserLookupRequestSchema.parse({
        userId
      });
      const headers = new Headers({
        "content-type": "application/json; charset=utf-8",
        "x-sourceplane-request-id": metadata.requestId
      });

      if (metadata.traceparent) {
        headers.set("traceparent", metadata.traceparent);
      }

      const response = await binding.fetch(
        new Request("http://identity.internal/internal/users/resolve", {
          body: JSON.stringify(requestBody),
          headers,
          method: "POST"
        })
      );
      const payload = await parseResponseBody(response);

      if (!response.ok) {
        if (isApiErrorEnvelope(payload)) {
          throw new SourceplaneHttpError(response.status, payload.error.code, payload.error.message, payload.error.details);
        }

        throw new SourceplaneHttpError(502, "internal_error", "The IDENTITY service returned an invalid user lookup response.");
      }

      const responsePayload = unwrapSuccessEnvelope(payload);

      return identityUserLookupResponseSchema.parse(responsePayload).user;
    }
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    throw new SourceplaneHttpError(502, "internal_error", "The IDENTITY service returned malformed JSON.");
  }
}

function unwrapSuccessEnvelope(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (!("data" in payload) || !("meta" in payload)) {
    return payload;
  }

  return payload.data;
}
