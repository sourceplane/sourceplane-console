import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateProjectRequest, UpdateProjectRequest } from "@sourceplane/contracts";

import { useApiClient } from "../../app/providers.js";

export function useProjects(orgId: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["org-scoped", "projects", orgId ?? "none"],
    queryFn: () => {
      if (!orgId) throw new Error("orgId is required");
      return client.projects.list({ orgId });
    },
    enabled: Boolean(orgId)
  });
}

export function useProject(orgId: string | null, projectId: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["org-scoped", "project", orgId ?? "none", projectId ?? "none"],
    queryFn: () => {
      if (!orgId || !projectId) throw new Error("orgId/projectId required");
      return client.projects.get(projectId, { orgId });
    },
    enabled: Boolean(orgId && projectId)
  });
}

export function useCreateProject(orgId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectRequest) => client.projects.create(input, { orgId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-scoped", "projects", orgId] })
  });
}

export function useUpdateProject(orgId: string, projectId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectRequest) => client.projects.update(projectId, input, { orgId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["org-scoped", "projects", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["org-scoped", "project", orgId, projectId] });
    }
  });
}

export function useArchiveProject(orgId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => client.projects.archive(projectId, { orgId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-scoped", "projects", orgId] })
  });
}
