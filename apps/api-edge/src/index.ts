import { publicRouteGroups } from "@sourceplane/contracts";
import {
  createRequestContext,
  hasServiceBinding,
  jsonError,
  jsonSuccess,
  parseDeploymentEnvironment,
  type SourceplaneWorkerEnv,
  type WorkerServiceBinding
} from "@sourceplane/shared";

export interface ApiEdgeEnv extends SourceplaneWorkerEnv {
  IDENTITY?: WorkerServiceBinding;
}

const authPingPath = "/v1/auth/ping";
const systemRoutesPath = "/v1/system/routes";

const worker = {
  async fetch(request: Request, env: ApiEdgeEnv): Promise<Response> {
    const context = createRequestContext(request);
    const url = new URL(request.url);
    const stage = parseDeploymentEnvironment(env.ENVIRONMENT);

    try {
      if (url.pathname === "/healthz") {
        return jsonSuccess(
          {
            environment: stage,
            ok: true,
            service: env.APP_NAME
          },
          context.requestId
        );
      }

      if (url.pathname === systemRoutesPath) {
        return jsonSuccess(
          {
            groups: [...publicRouteGroups]
          },
          context.requestId
        );
      }

      if (url.pathname === authPingPath) {
        if (!hasServiceBinding(env.IDENTITY)) {
          return jsonError(501, {
            code: "unsupported",
            details: {
              binding: "IDENTITY"
            },
            message: "The identity service binding is not configured for this environment.",
            requestId: context.requestId
          });
        }

        const forwardedHeaders = new Headers({
          "x-sourceplane-request-id": context.requestId
        });

        if (context.traceparent) {
          forwardedHeaders.set("traceparent", context.traceparent);
        }

        const upstreamResponse = await env.IDENTITY.fetch(
          new Request("http://identity.internal/internal/ping", {
            headers: forwardedHeaders
          })
        );

        const upstreamPayload = await upstreamResponse.json();

        return jsonSuccess(
          {
            binding: "IDENTITY",
            stage,
            upstream: upstreamPayload
          },
          context.requestId
        );
      }

      const routeGroup = publicRouteGroups.find(
        (group) => url.pathname === group || url.pathname.startsWith(`${group}/`)
      );

      if (routeGroup) {
        return jsonError(501, {
          code: "unsupported",
          details: {
            routeGroup,
            scaffoldOnly: true
          },
          message: `The ${routeGroup} route group is scaffolded but not implemented yet.`,
          requestId: context.requestId
        });
      }

      return jsonError(404, {
        code: "not_found",
        details: {
          pathname: url.pathname
        },
        message: "Route not found.",
        requestId: context.requestId
      });
    } catch (error) {
      return jsonError(500, {
        code: "internal_error",
        details: {
          message: error instanceof Error ? error.message : "Unknown error"
        },
        message: "api-edge failed to handle the request.",
        requestId: context.requestId
      });
    }
  }
} satisfies ExportedHandler<ApiEdgeEnv>;

export default worker;
