import { describe, expect, it, vi } from "vitest";

import worker, { type WebConsoleEnv } from "./worker.js";

function createAssetsBinding(handler: (request: Request) => Promise<Response> | Response): WebConsoleEnv["ASSETS"] {
  return {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const request = input instanceof Request ? input : new Request(input, init);
      return Promise.resolve(handler(request));
    }
  };
}

describe("web-console worker", () => {
  it("serves the app shell for deep links and injects runtime config", async () => {
    const response = await worker.fetch(
      new Request("https://sourceplane-web-console-preview.example.workers.dev/login", {
        headers: { accept: "text/html" }
      }),
      {
        APP_NAME: "web-console",
        ASSETS: createAssetsBinding((request) => {
          expect(new URL(request.url).pathname).toBe("/index.html");
          return new Response("<html><head></head><body><div id='root'></div></body></html>", {
            headers: { "content-type": "text/html; charset=utf-8" }
          });
        }),
        ENVIRONMENT: "preview"
      }
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("window.__SOURCEPLANE_RUNTIME_CONFIG__");
    expect(html).toContain("https://sourceplane-api-edge-preview.example.workers.dev");
  });

  it("passes through static assets without rewriting the request", async () => {
    const assetFetch = vi.fn((request: Request) => {
      void request;
      return Promise.resolve(
        new Response("console.log('ok');", {
          headers: { "content-type": "application/javascript" }
        })
      );
    });

    const response = await worker.fetch(
      new Request("https://sourceplane-web-console-preview.example.workers.dev/assets/index.js"),
      {
        APP_NAME: "web-console",
        ASSETS: createAssetsBinding(assetFetch),
        ENVIRONMENT: "preview"
      }
    );

    expect(assetFetch).toHaveBeenCalledTimes(1);
    const firstCall = assetFetch.mock.calls[0];
    expect(firstCall).toBeDefined();
    const forwardedRequest = firstCall?.[0];
    expect(forwardedRequest).toBeInstanceOf(Request);
    expect(new URL((forwardedRequest as Request).url).pathname).toBe("/assets/index.js");
    expect(await response.text()).toBe("console.log('ok');");
  });

  it("uses the explicit API base URL when provided by the worker env", async () => {
    const response = await worker.fetch(
      new Request("https://www.console.sourceplane.ai/", {
        headers: { accept: "text/html" }
      }),
      {
        API_BASE_URL: "https://api.sourceplane.ai",
        APP_NAME: "web-console",
        ASSETS: createAssetsBinding(
          () =>
            new Response("<html><head></head><body><div id='root'></div></body></html>", {
              headers: { "content-type": "text/html; charset=utf-8" }
            })
        ),
        ENVIRONMENT: "preview"
      }
    );

    expect(await response.text()).toContain("https://api.sourceplane.ai");
  });

  it("redirects bare apex console.sourceplane.ai to the canonical www host", async () => {
    const assetFetch = vi.fn();
    const response = await worker.fetch(
      new Request("https://console.sourceplane.ai/orgs?next=/projects", {
        headers: { accept: "text/html" }
      }),
      {
        APP_NAME: "web-console",
        ASSETS: createAssetsBinding((request) => {
          assetFetch(request);
          return new Response("should not be served", { status: 200 });
        }),
        ENVIRONMENT: "preview"
      }
    );

    expect(assetFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.console.sourceplane.ai/orgs?next=/projects"
    );
  });

  it("uses 307 for non-idempotent methods so request bodies are preserved", async () => {
    const response = await worker.fetch(
      new Request("https://console.sourceplane.ai/api-thing", {
        method: "POST",
        body: "{}"
      }),
      {
        APP_NAME: "web-console",
        ASSETS: createAssetsBinding(() => new Response("nope", { status: 200 })),
        ENVIRONMENT: "preview"
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.console.sourceplane.ai/api-thing");
  });
});
