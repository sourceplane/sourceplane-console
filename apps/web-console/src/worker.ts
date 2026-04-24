import { deriveApiBaseUrl, normalizeConfiguredApiBaseUrl, type SourceplaneRuntimeConfig } from "./lib/runtime-config.js";

interface AssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface WebConsoleEnv {
  API_BASE_URL?: string;
  APP_NAME: string;
  ASSETS: AssetsBinding;
  ENVIRONMENT: string;
}

const appShellPath = "/index.html";
const assetPathPrefix = "/assets/";
const staticFilePattern = /\/[^/]+\.[a-z0-9]+$/iu;
const canonicalApexRedirects: Record<string, string> = {
  "console.sourceplane.ai": "www.console.sourceplane.ai"
};

const worker = {
  async fetch(request: Request, env: WebConsoleEnv): Promise<Response> {
    try {
      const canonicalRedirect = buildCanonicalRedirect(request);
      if (canonicalRedirect) {
        return canonicalRedirect;
      }

      const assetRequest = shouldServeAppShell(request) ? buildAppShellRequest(request) : request;
      const assetResponse = await env.ASSETS.fetch(assetRequest);

      if (request.method !== "GET" || !isHtmlResponse(assetResponse)) {
        return assetResponse;
      }

      return injectRuntimeConfig(assetResponse, {
        apiBaseUrl: resolveRuntimeApiBaseUrl(request, env)
      });
    } catch (error) {
      console.error("web-console request failed", {
        error,
        method: request.method,
        pathname: new URL(request.url).pathname
      });
      throw error;
    }
  }
};

export default worker;

function buildCanonicalRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const target = canonicalApexRedirects[url.hostname];
  if (!target) {
    return null;
  }

  const redirectUrl = new URL(url.toString());
  redirectUrl.hostname = target;

  const headers = new Headers({ location: redirectUrl.toString() });
  // Cache the redirect itself but force revalidation so we can change canonical hosts later.
  headers.set("cache-control", "public, max-age=0, must-revalidate");

  const status = request.method === "GET" || request.method === "HEAD" ? 308 : 307;
  return new Response(null, { headers, status });
}

function buildAppShellRequest(request: Request): Request {
  const appShellUrl = new URL(request.url);
  appShellUrl.pathname = appShellPath;
  appShellUrl.search = "";

  return new Request(appShellUrl, {
    headers: request.headers,
    method: request.method
  });
}

async function injectRuntimeConfig(response: Response, config: SourceplaneRuntimeConfig): Promise<Response> {
  const originalHtml = await response.text();
  const runtimeConfigScript = `<script>window.__SOURCEPLANE_RUNTIME_CONFIG__=${JSON.stringify(config)};</script>`;
  const html = originalHtml.includes("</head>")
    ? originalHtml.replace("</head>", `${runtimeConfigScript}</head>`)
    : `${runtimeConfigScript}${originalHtml}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(html, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}

function isHtmlResponse(response: Response): boolean {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
}

function resolveRuntimeApiBaseUrl(request: Request, env: WebConsoleEnv): string {
  const configuredApiBaseUrl = normalizeConfiguredApiBaseUrl(env.API_BASE_URL);
  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl;
  }

  return deriveApiBaseUrl(new URL(request.url));
}

function shouldServeAppShell(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith(assetPathPrefix)) {
    return false;
  }

  if (staticFilePattern.test(url.pathname)) {
    return false;
  }

  const acceptHeader = request.headers.get("accept");
  return !acceptHeader || acceptHeader.includes("text/html") || acceptHeader.includes("*/*");
}
