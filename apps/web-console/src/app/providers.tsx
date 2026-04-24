import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { OrganizationListItem } from "@sourceplane/contracts";
import type { SourceplaneClient } from "@sourceplane/sdk";
import { ToastProvider } from "@sourceplane/ui";

import { createApiClient, persistActiveOrgId, persistSessionToken, resolveBaseUrl } from "../lib/api-client.js";

interface SessionContextValue {
  client: SourceplaneClient;
  token: string | null;
  setToken: (token: string | null) => void;
  activeOrgId: string | null;
  setActiveOrgId: (orgId: string | null) => void;
  organizations: OrganizationListItem[];
  setOrganizations: (orgs: OrganizationListItem[]) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export interface ProvidersProps {
  children: ReactNode;
  client?: SourceplaneClient;
  queryClient?: QueryClient;
}

export function Providers({ children, client: providedClient, queryClient: providedQueryClient }: ProvidersProps) {
  const clientRef = useRef<SourceplaneClient>(providedClient ?? createApiClient(resolveBaseUrl()));
  const client = clientRef.current;
  const queryClientRef = useRef<QueryClient>(
    providedQueryClient ?? new QueryClient({
      defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 }
      }
    })
  );

  const [token, setTokenState] = useState<string | null>(client.getToken() ?? null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(client.getActiveOrgId() ?? null);
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);

  const setToken = useCallback(
    (next: string | null) => {
      client.setToken(next ?? undefined);
      persistSessionToken(next);
      setTokenState(next);
      if (!next) {
        // dropping the session also drops the active org and cached queries
        client.setActiveOrgId(undefined);
        persistActiveOrgId(null);
        setActiveOrgIdState(null);
        setOrganizations([]);
        queryClientRef.current.clear();
      }
    },
    [client]
  );

  const setActiveOrgId = useCallback(
    (next: string | null) => {
      client.setActiveOrgId(next ?? undefined);
      persistActiveOrgId(next);
      setActiveOrgIdState(next);
      // refetch org-scoped data when org changes
      void queryClientRef.current.invalidateQueries({ predicate: (query) => query.queryKey[0] === "org-scoped" });
    },
    [client]
  );

  useEffect(() => {
    // sync client token to persisted state on mount in case external callers changed it
    if (token) client.setToken(token);
    if (activeOrgId) client.setActiveOrgId(activeOrgId);
  }, [client, token, activeOrgId]);

  const value = useMemo<SessionContextValue>(
    () => ({ client, token, setToken, activeOrgId, setActiveOrgId, organizations, setOrganizations }),
    [client, token, setToken, activeOrgId, setActiveOrgId, organizations]
  );

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <SessionContext.Provider value={value}>
        <ToastProvider>{children}</ToastProvider>
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within Providers");
  }
  return context;
}

export function useApiClient(): SourceplaneClient {
  return useSession().client;
}
