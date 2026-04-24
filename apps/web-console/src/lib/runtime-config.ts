export interface SourceplaneRuntimeConfig {
  apiBaseUrl?: string;
}

const localHostnames = new Set(["127.0.0.1", "localhost"]);

export function normalizeConfiguredApiBaseUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function deriveApiBaseUrl(currentUrl: URL): string {
  if (localHostnames.has(currentUrl.hostname)) {
    return "http://127.0.0.1:8787";
  }

  const previewWorkersHost = replaceWorkerHostname(
    currentUrl.hostname,
    "sourceplane-web-console-preview",
    "sourceplane-api-edge-preview"
  );
  if (previewWorkersHost) {
    return `${currentUrl.protocol}//${previewWorkersHost}`;
  }

  const productionWorkersHost = replaceWorkerHostname(
    currentUrl.hostname,
    "sourceplane-web-console-production",
    "sourceplane-api-edge-production"
  );
  if (productionWorkersHost) {
    return `${currentUrl.protocol}//${productionWorkersHost}`;
  }

  return "/";
}

export function readRuntimeApiBaseUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeConfiguredApiBaseUrl(window.__SOURCEPLANE_RUNTIME_CONFIG__?.apiBaseUrl);
}

export function resolveApiBaseUrl(envValue: unknown): string {
  const runtimeValue = readRuntimeApiBaseUrl();
  if (runtimeValue) {
    return runtimeValue;
  }

  const configuredEnvValue = normalizeConfiguredApiBaseUrl(typeof envValue === "string" ? envValue : null);
  if (configuredEnvValue) {
    return configuredEnvValue;
  }

  if (typeof window !== "undefined") {
    return deriveApiBaseUrl(new URL(window.location.href));
  }

  return "http://127.0.0.1:8787";
}

function replaceWorkerHostname(hostname: string, sourcePrefix: string, targetPrefix: string): string | null {
  const sourcePrefixWithSeparator = `${sourcePrefix}.`;
  if (!hostname.startsWith(sourcePrefixWithSeparator)) {
    return null;
  }

  return `${targetPrefix}.${hostname.slice(sourcePrefixWithSeparator.length)}`;
}

declare global {
  interface Window {
    __SOURCEPLANE_RUNTIME_CONFIG__?: SourceplaneRuntimeConfig;
  }
}
