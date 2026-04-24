import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateOrganizationRequest, UpdateOrganizationRequest } from "@sourceplane/contracts";

import { useApiClient, useSession } from "../../app/providers.js";

export function useOrganizations() {
  const client = useApiClient();
  const { token } = useSession();
  return useQuery({
    queryKey: ["organizations", token ?? "anon"],
    queryFn: () => client.organizations.list(),
    enabled: Boolean(token)
  });
}

export function useCreateOrganization() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationRequest) => client.organizations.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] })
  });
}

export function useUpdateOrganization(orgId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationRequest) => client.organizations.update(orgId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] })
  });
}
