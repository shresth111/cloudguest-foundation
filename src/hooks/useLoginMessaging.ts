import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loginMessagingService } from "@/services/login-messaging.service";
import type { LoginChannel, LoginMessagingTarget, LoginProviderPut } from "@/types/login-messaging";

export const loginMessagingKeys = {
  overview: (target: LoginMessagingTarget) =>
    ["login-messaging", target.kind === "own" ? "own" : target.organizationId] as const,
};

export function useLoginMessaging(target: LoginMessagingTarget, enabled = true) {
  return useQuery({
    queryKey: loginMessagingKeys.overview(target),
    queryFn: () => loginMessagingService.overview(target),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

function useInvalidate(target: LoginMessagingTarget) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: loginMessagingKeys.overview(target) });
}

export function useSaveLoginProvider(target: LoginMessagingTarget) {
  const after = useInvalidate(target);
  return useMutation({
    mutationFn: (v: { channel: LoginChannel; body: LoginProviderPut }) =>
      loginMessagingService.put(target, v.channel, v.body),
    onSettled: () => after(),
  });
}

export function useRemoveLoginProvider(target: LoginMessagingTarget) {
  const after = useInvalidate(target);
  return useMutation({
    mutationFn: (channel: LoginChannel) => loginMessagingService.remove(target, channel),
    onSettled: () => after(),
  });
}

export function useStartLoginVerify(target: LoginMessagingTarget) {
  const after = useInvalidate(target);
  return useMutation({
    mutationFn: (v: { channel: LoginChannel; to: string }) =>
      loginMessagingService.startVerify(target, v.channel, v.to),
    onSettled: () => after(),
  });
}

export function useConfirmLoginVerify(target: LoginMessagingTarget) {
  const after = useInvalidate(target);
  return useMutation({
    mutationFn: (v: { channel: LoginChannel; code: string }) =>
      loginMessagingService.confirmVerify(target, v.channel, v.code),
    onSettled: () => after(),
  });
}
