import { EdgeHttpError } from "../errors/edge-error.js";

export async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type");

  if (!contentType) {
    return undefined;
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new EdgeHttpError(415, "unsupported", "Only application/json request bodies are supported.", {
      contentType
    });
  }

  const requestBody = await request.text();
  if (!requestBody.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(requestBody) as unknown;
  } catch {
    throw new EdgeHttpError(400, "bad_request", "Request body contains invalid JSON.");
  }
}