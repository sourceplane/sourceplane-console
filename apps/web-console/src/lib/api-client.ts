import { SourceplaneClient } from "@sourceplane/sdk";

import { resolveApiBaseUrl } from "./runtime-config.js";

const ACTIVE_ORG_KEY = "sourceplane.activeOrgId";
const TOKEN_KEY = "sourceplane.sessionToken";

export interface PersistedSession {
  token: string | null;
  activeOrgId: string | null;
}

export function readPersistedSession(): PersistedSession {
  if (typeof window === "undefined") {
    return { token: null, activeOrgId: null };
  }
  return {
    token: window.localStorage.getItem(TOKEN_KEY),
    activeOrgId: window.localStorage.getItem(ACTIVE_ORG_KEY)
  };
}

export function persistSessionToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function persistActiveOrgId(orgId: string | null): void {
  if (typeof window === "undefined") return;
  if (orgId) {
    window.localStorage.setItem(ACTIVE_ORG_KEY, orgId);
  } else {
    window.localStorage.removeItem(ACTIVE_ORG_KEY);
  }
}

export function createApiClient(baseUrl: string): SourceplaneClient {
  const persisted = readPersistedSession();
  return new SourceplaneClient({
    baseUrl,
    ...(persisted.token ? { token: persisted.token } : {}),
    ...(persisted.activeOrgId ? { activeOrgId: persisted.activeOrgId } : {})
  });
}

export function resolveBaseUrl(): string {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  const env = meta.env ?? {};
  const value: unknown = env.VITE_API_BASE_URL;
  const resolved = resolveApiBaseUrl(value);
  // The SDK URL constructor requires an absolute URL. When same-origin routing is
  // active (deriveApiBaseUrl returns "/"), convert it to the current window origin.
  if (resolved.startsWith("/") && typeof window !== "undefined") {
    return window.location.origin;
  }
  return resolved;
}
