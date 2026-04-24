import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateOrganizationInviteRequest,
  OrganizationRole,
  UpdateOrganizationMemberRequest
} from "@sourceplane/contracts";

import { useApiClient } from "../../app/providers.js";

export function useMembers(orgId: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["org-scoped", "members", orgId ?? "none"],
    queryFn: () => {
      if (!orgId) throw new Error("orgId is required");
      return client.organizations.members.list(orgId);
    },
    enabled: Boolean(orgId)
  });
}

export function useUpdateMemberRole(orgId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: string; role: OrganizationRole }) =>
      client.organizations.members.update(orgId, input.memberId, { role: input.role } satisfies UpdateOrganizationMemberRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-scoped", "members", orgId] })
  });
}

export function useRemoveMember(orgId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => client.organizations.members.remove(orgId, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-scoped", "members", orgId] })
  });
}

export function useCreateInvite(orgId: string) {
  const client = useApiClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInviteRequest) => client.organizations.invites.create(orgId, input)
  });
}

export function useAcceptInvite() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { inviteId: string; token: string }) =>
      client.organizations.invites.accept(input.inviteId, input.token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] })
  });
}
