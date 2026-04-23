import type { PublicRouteGroup } from "@sourceplane/contracts";
import { parseDeploymentEnvironment, type SourceplaneWorkerEnv } from "@sourceplane/shared";

import { createApiEdgeServices } from "./clients/index.js";
import type { ApiEdgeServices } from "./clients/index.js";
import type { ApiEdgeEnv } from "./env.js";
import { getEdgeServiceStatuses } from "./env.js";
import { EdgeHttpError } from "./errors/edge-error.js";
import { jsonError, jsonSuccess, toErrorResponse } from "./http/json.js";
import { buildAuthorizationRequest } from "./middleware/authorization.js";
import { requireAuthenticatedActor, resolveAuthContext } from "./middleware/auth.js";
import {
  assertIdempotencyPreconditions,
  createIdempotencyStoreFromEnv,
  replayIdempotentSuccessIfPresent,
  storeIdempotentSuccess,
  type IdempotencyStore
} from "./middleware/idempotency.js";
import { parseJsonBody } from "./middleware/json-body.js";
import { createEdgeRequestContext, isMutatingMethod, matchPublicRoute } from "./middleware/request-context.js";
import { extractTenantContext } from "./middleware/tenant.js";
import { getPublicRouteDefinition, publicRouteDefinitions } from "./routes/groups.js";
import type { DomainRouteResult, PublicRouteClientRequest, ServiceRequestMetadata } from "./types.js";

export interface ApiEdgeAppOptions {
  idempotencyStore?: IdempotencyStore;
}

export function createApiEdgeApp(options: ApiEdgeAppOptions = {}): ExportedHandler<ApiEdgeEnv> {
  return {
    async fetch(request: Request, env: ApiEdgeEnv): Promise<Response> {
      const url = new URL(request.url);
      const routeMatch = matchPublicRoute(url.pathname);
      const requestContext = createEdgeRequestContext(request, routeMatch);
      const services = createApiEdgeServices(env);
      const idempotencyStore = options.idempotencyStore ?? createIdempotencyStoreFromEnv(env);

      try {
        if (url.pathname === "/healthz") {
          return handleHealthRoute(env, requestContext.requestId);
        }

        if (url.pathname === "/readyz") {
          return handleReadyRoute(env, requestContext.requestId);
        }

        if (url.pathname === "/v1" || url.pathname === "/v1/") {
          return jsonSuccess(
            {
              groups: publicRouteDefinitions,
              version: "v1"
            },
            {
              requestId: requestContext.requestId
            }
          );
        }

        if (url.pathname === "/v1/system/routes") {
          return jsonSuccess(
            {
              bindings: getEdgeServiceStatuses(env),
              groups: publicRouteDefinitions
            },
            {
              requestId: requestContext.requestId
            }
          );
        }

        if (routeMatch?.group === "/v1/auth" && routeMatch.subpath === "/ping" && requestContext.method === "GET") {
          return await handleAuthPingRoute(request, requestContext, services);
        }

        if (routeMatch) {
          const jsonBody = await parseJsonBody(request);
          const tenant = extractTenantContext(url.pathname);
          const auth = await resolveAuthContext(request, services.identity, {
            request,
            requestContext,
            tenant
          });
          const metadata: ServiceRequestMetadata = {
            auth,
            request,
            requestContext,
            tenant
          };
          const allowsAnonymousMutation = isAnonymousAuthMutation(routeMatch.group, routeMatch.subpath, requestContext.method);

          if (isMutatingMethod(requestContext.method) && !allowsAnonymousMutation) {
            requireAuthenticatedActor(auth);

            const authorizationRequest = buildAuthorizationRequest({
              auth,
              method: requestContext.method,
              routeGroup: routeMatch.group,
              tenant
            });

            if (env.POLICY && authorizationRequest) {
              const authorizationResponse = await services.policy.authorize(authorizationRequest, metadata);

              if (!authorizationResponse.allow) {
                throw new EdgeHttpError(403, "forbidden", "The authenticated actor is not allowed to perform this action.", {
                  policyVersion: authorizationResponse.policyVersion,
                  reason: authorizationResponse.reason
                });
              }
            }
          }

          const routeInput: PublicRouteClientRequest = {
            ...metadata,
            jsonBody,
            method: requestContext.method,
            publicPathname: url.pathname,
            publicSearch: url.search
          };

          let idempotencyCacheKey: string | null = null;
          let activeIdempotencyStore: IdempotencyStore | null = null;
          if (requestContext.method === "POST" && !allowsAnonymousMutation) {
            requireAuthenticatedActor(auth);

            idempotencyCacheKey = assertIdempotencyPreconditions({
              actor: auth.actor,
              idempotencyKey: requestContext.idempotencyKey,
              routeSignature: `${requestContext.method}:${routeMatch.group}`,
              store: idempotencyStore
            });

            activeIdempotencyStore = idempotencyStore;

            if (!activeIdempotencyStore) {
              throw new EdgeHttpError(
                501,
                "unsupported",
                "The edge idempotency store is not configured for this environment.",
                {
                  binding: "EDGE_IDEMPOTENCY"
                }
              );
            }

            const replayedResponse = await replayIdempotentSuccessIfPresent({
              cacheKey: idempotencyCacheKey,
              requestId: requestContext.requestId,
              store: activeIdempotencyStore
            });

            if (replayedResponse) {
              return replayedResponse;
            }
          }

          const routeResult = await dispatchPublicRoute(routeMatch.group, routeInput, services);
          const responseStatus = routeResult.status ?? 200;

          if (idempotencyCacheKey && responseStatus >= 200 && responseStatus < 300 && activeIdempotencyStore) {
            const idempotencyWriteOptions: {
              cacheKey: string;
              data: unknown;
              status: number;
              store: IdempotencyStore;
              cursor?: string | null;
            } = {
              cacheKey: idempotencyCacheKey,
              data: routeResult.data,
              status: responseStatus,
              store: activeIdempotencyStore
            };

            if (routeResult.cursor !== undefined) {
              idempotencyWriteOptions.cursor = routeResult.cursor;
            }

            await storeIdempotentSuccess(idempotencyWriteOptions);
          }

          const successOptions: {
            requestId: string;
            status: number;
            cursor?: string | null;
          } = {
            requestId: requestContext.requestId,
            status: responseStatus
          };

          if (routeResult.cursor !== undefined) {
            successOptions.cursor = routeResult.cursor;
          }

          return jsonSuccess(routeResult.data, successOptions);
        }

        return jsonError(404, {
          code: "not_found",
          details: {
            pathname: url.pathname
          },
          message: "Route not found.",
          requestId: requestContext.requestId
        });
      } catch (error) {
        return toErrorResponse(error, requestContext.requestId);
      }
    }
  } satisfies ExportedHandler<ApiEdgeEnv>;
}

async function dispatchPublicRoute(
  routeGroup: PublicRouteGroup,
  routeInput: PublicRouteClientRequest,
  services: ApiEdgeServices
): Promise<DomainRouteResult> {
  const routeDefinition = getPublicRouteDefinition(routeGroup);

  return services.publicClients[routeDefinition.clientKey].handlePublicRequest(routeInput);
}

async function handleAuthPingRoute(
  request: Request,
  requestContext: ServiceRequestMetadata["requestContext"],
  services: ApiEdgeServices
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const pingResult = await services.identity.ping({
    auth: {
      actor: null,
      bearerToken: null,
      organizationId: null,
      sessionId: null
    },
    request,
    requestContext,
    tenant: extractTenantContext(pathname)
  });

  return jsonSuccess(
    {
      binding: "IDENTITY",
      upstream: pingResult
    },
    {
      requestId: requestContext.requestId
    }
  );
}

function handleHealthRoute(env: SourceplaneWorkerEnv, requestId: string): Response {
  const environment = parseDeploymentEnvironment(env.ENVIRONMENT);

  return jsonSuccess(
    {
      environment,
      ok: true,
      service: env.APP_NAME
    },
    {
      requestId
    }
  );
}

function isAnonymousAuthMutation(routeGroup: PublicRouteGroup, subpath: string, method: string): boolean {
  if (routeGroup !== "/v1/auth" || method !== "POST") {
    return false;
  }

  return subpath === "/login/start" || subpath === "/login/complete";
}

function handleReadyRoute(env: ApiEdgeEnv, requestId: string): Response {
  const environment = parseDeploymentEnvironment(env.ENVIRONMENT);

  return jsonSuccess(
    {
      bindings: getEdgeServiceStatuses(env),
      environment,
      ok: true,
      service: env.APP_NAME
    },
    {
      requestId
    }
  );
}