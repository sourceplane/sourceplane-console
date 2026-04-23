import type { IdentityEdgeClient } from "../clients/identity.js";
import { EdgeHttpError } from "../errors/edge-error.js";

import type { AuthContext, ServiceRequestMetadata } from "../types.js";

export async function resolveAuthContext(
  request: Request,
  identityClient: IdentityEdgeClient,
  metadata: Omit<ServiceRequestMetadata, "auth">
): Promise<AuthContext> {
  const bearerToken = parseBearerToken(request.headers.get("authorization"));

  if (!bearerToken) {
    return {
      actor: null,
      bearerToken: null,
      organizationId: null,
      sessionId: null
    };
  }

  const resolvedIdentity = await identityClient.resolveBearerToken(bearerToken, {
    ...metadata,
    auth: {
      actor: null,
      bearerToken,
      organizationId: null,
      sessionId: null
    }
  });

  return {
    actor: resolvedIdentity.actor
      ? {
          ...resolvedIdentity.actor,
          authenticationSource: "bearer_token"
        }
      : null,
    bearerToken,
    organizationId: resolvedIdentity.organizationId ?? null,
    sessionId: resolvedIdentity.sessionId ?? null
  };
}

export function requireAuthenticatedActor(auth: AuthContext): asserts auth is AuthContext & {
  actor: NonNullable<AuthContext["actor"]>;
} {
  if (!auth.actor) {
    throw new EdgeHttpError(401, "unauthenticated", "Authentication is required for mutating routes.");
  }
}

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}