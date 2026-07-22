import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queueService } from "@/services/queue.service";
import type { CreateQueueAssignmentPayload, CreateQueueProfilePayload, UpdateQueueProfilePayload } from "@/types/queue";

export const queueKeys = {
  profiles: ["queue", "profiles"] as const,
  assignments: ["queue", "assignments"] as const,
  kpis: ["queue", "kpis"] as const,
};

export const useQueueProfiles = () =>
  useQuery({ queryKey: queueKeys.profiles, queryFn: () => queueService.listProfiles() });

export const useQueueAssignments = () =>
  useQuery({ queryKey: queueKeys.assignments, queryFn: () => queueService.listAssignments() });

export const useQueueKpis = () => useQuery({ queryKey: queueKeys.kpis, queryFn: queueService.getKpis });

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queueKeys.profiles });
  qc.invalidateQueries({ queryKey: queueKeys.assignments });
  qc.invalidateQueries({ queryKey: queueKeys.kpis });
}

export function useCreateQueueProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQueueProfilePayload) => queueService.createProfile(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateQueueProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateQueueProfilePayload }) =>
      queueService.updateProfile(id, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteQueueProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => queueService.deleteProfile(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateQueueAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQueueAssignmentPayload) => queueService.createAssignment(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useExpireQueueAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => queueService.expireAssignment(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useApplyQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => queueService.applyQueue(assignmentId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemoveQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => queueService.removeQueue(assignmentId),
    onSuccess: () => invalidateAll(qc),
  });
}
