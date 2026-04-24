import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { SourceplaneClient } from "@sourceplane/sdk";

import { Providers } from "../src/app/providers.js";
import { LoginRoute } from "../src/routes/auth/login.js";

function makeClient(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return new SourceplaneClient({
    baseUrl: "http://api.test",
    fetch: handler as typeof fetch
  });
}

function renderWithProviders(ui: React.ReactNode, client: SourceplaneClient) {
  return render(
    <MemoryRouter>
      <Providers client={client}>{ui}</Providers>
    </MemoryRouter>
  );
}

describe("LoginRoute", () => {
  it("starts a login challenge and shows the local debug code", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          data: {
            challengeId: "chal_abc",
            delivery: { mode: "local_debug", code: "424242", emailHint: "user@example.com" },
            expiresAt: "2030-01-01T00:00:00.000Z"
          },
          meta: { cursor: null, requestId: "req_x" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    renderWithProviders(<LoginRoute />, makeClient(fetchMock));

    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByLabelText(/one-time code/i)).toHaveValue("424242");
    expect(screen.getByText(/local debug code: 424242/i)).toBeInTheDocument();
  });
});
