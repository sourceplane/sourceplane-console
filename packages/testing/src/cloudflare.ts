import type { WorkerServiceBinding } from "@sourceplane/shared";

export function createServiceBinding(
  handler: (request: Request) => Response | Promise<Response>
): WorkerServiceBinding {
  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const request = input instanceof Request ? input : new Request(input, init);
      return handler(request);
    }
  };
}
