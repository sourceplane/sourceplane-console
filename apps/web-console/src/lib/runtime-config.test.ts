import { beforeEach, describe, expect, it } from "vitest";

import { deriveApiBaseUrl, normalizeConfiguredApiBaseUrl, resolveApiBaseUrl } from "./runtime-config.js";

describe("runtime-config", () => {
  beforeEach(() => {
    delete window.__SOURCEPLANE_RUNTIME_CONFIG__;
  });

  it("normalizes configured values", () => {
    expect(normalizeConfiguredApiBaseUrl("  https://api.example.com  ")).toBe("https://api.example.com");
    expect(normalizeConfiguredApiBaseUrl("   ")).toBeNull();
    expect(normalizeConfiguredApiBaseUrl(undefined)).toBeNull();
  });

  it("derives the local edge URL for localhost", () => {
    expect(deriveApiBaseUrl(new URL("http://127.0.0.1:4173/login"))).toBe("http://127.0.0.1:8787");
  });

  it("derives the preview workers.dev edge URL from the console hostname", () => {
    expect(
      deriveApiBaseUrl(new URL("https://sourceplane-web-console-preview.example.workers.dev/login"))
    ).toBe("https://sourceplane-api-edge-preview.example.workers.dev");
  });

  it("defaults custom domains to same-origin routing", () => {
    expect(deriveApiBaseUrl(new URL("https://console.sourceplane.ai/login"))).toBe("/");
  });

  it("prefers runtime config over build-time env", () => {
    window.__SOURCEPLANE_RUNTIME_CONFIG__ = { apiBaseUrl: "https://runtime.example.com" };

    expect(resolveApiBaseUrl("https://env.example.com")).toBe("https://runtime.example.com");
  });

  it("falls back to build-time env when runtime config is absent", () => {
    expect(resolveApiBaseUrl("https://env.example.com")).toBe("https://env.example.com");
  });
});
