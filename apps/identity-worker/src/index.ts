import {
  createRequestContext,
  jsonError,
  jsonSuccess,
  parseDeploymentEnvironment,
  type SourceplaneWorkerEnv
} from "@sourceplane/shared";

export type IdentityWorkerEnv = SourceplaneWorkerEnv;

const worker = {
  fetch(request: Request, env: IdentityWorkerEnv): Response {
    const context = createRequestContext(request);
    const stage = parseDeploymentEnvironment(env.ENVIRONMENT);
    const url = new URL(request.url);

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

    if (url.pathname === "/internal/ping") {
      return jsonSuccess(
        {
          ok: true,
          receivedRequestId: context.requestId,
          receivedTraceparent: context.traceparent,
          service: env.APP_NAME,
          stage
        },
        context.requestId
      );
    }

    return jsonError(404, {
      code: "not_found",
      details: {
        pathname: url.pathname
      },
      message: "Route not found.",
      requestId: context.requestId
    });
  }
} satisfies ExportedHandler<IdentityWorkerEnv>;

export default worker;
