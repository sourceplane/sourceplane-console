import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateEnvironmentRequest } from "@sourceplane/contracts";

import { useApiClient } from "../../app/providers.js";

export function useEnvironments(orgId: string | null, projectId: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["org-scoped", "envs", orgId ?? "none", projectId ?? "none"],
    queryFn: () => {
      if (!orgId || !projectId) throw new Error("orgId/projectId required");
      return client.projects.environments.list(projectId, { orgId });
    },
    enabled: Boolean(orgId && projectId)
  });
}

export function useCreateEnvironment(orgId: string, projectId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEnvironmentRequest) => client.projects.environments.create(projectId, input, { orgId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-scoped", "envs", orgId, projectId] })
  });
}

export function useArchiveEnvironment(orgId: string, projectId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (environmentId: string) => client.projects.environments.archive(environmentId, { orgId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-scoped", "envs", orgId, projectId] })
  });
}
