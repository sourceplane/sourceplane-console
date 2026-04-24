import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApiClient, useSession } from "../../app/providers.js";

export function useResolveSession() {
  const client = useApiClient();
  const { token } = useSession();
  return useQuery({
    queryKey: ["session", token ?? "anon"],
    queryFn: () => client.auth.session(),
    enabled: Boolean(token)
  });
}

export function useLoginStart() {
  const client = useApiClient();
  return useMutation({ mutationFn: (email: string) => client.auth.loginStart({ email }) });
}

export function useLoginComplete() {
  const client = useApiClient();
  return useMutation({
    mutationFn: (input: { challengeId: string; code: string }) => client.auth.loginComplete(input)
  });
}

export function useLogout() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.auth.logout(),
    onSuccess: () => {
      queryClient.clear();
    }
  });
}
