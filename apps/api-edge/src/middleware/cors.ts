import { internalOrgIdHeaderName } from "@sourceplane/contracts";

const allowedRequestHeaders = [
  "authorization",
  "content-type",
  "idempotency-key",
  internalOrgIdHeaderName,
  "x-request-id",
  "traceparent"
].join(", ");

const allowedMethods = "GET, POST, PATCH, DELETE, OPTIONS";

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function resolveCorsOrigin(requestOrigin: string | null, allowed: string[]): string | null {
  if (!requestOrigin) return null;
  if (allowed.includes("*")) return requestOrigin;
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

export function buildCorsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", allowedRequestHeaders);
  headers.set("access-control-allow-methods", allowedMethods);
  headers.set("access-control-max-age", "600");
  headers.set("vary", "origin");
  return headers;
}

export function applyCorsHeaders(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => {
    merged.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged
  });
}

export function handleCorsPreflight(request: Request, headers: Headers): Response {
  const requestedHeaders = request.headers.get("access-control-request-headers");
  if (requestedHeaders) {
    headers.set("access-control-allow-headers", requestedHeaders);
  }
  return new Response(null, { status: 204, headers });
}
