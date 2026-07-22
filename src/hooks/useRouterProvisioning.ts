import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routerProvisioningService } from "@/services/router-provisioning.service";
import type { ApproveEnrollmentPayload } from "@/types/router-provisioning";

const K = {
  status: (routerId: string) => ["router-provisioning", "status", routerId] as const,
  versions: (routerId: string) => ["router-provisioning", "versions", routerId] as const,
  enrollments: ["router-provisioning", "enrollments"] as const,
};

export const useProvisioningStatus = (routerId: string) =>
  useQuery({
    queryKey: K.status(routerId),
    queryFn: () => routerProvisioningService.getStatus(routerId),
    enabled: !!routerId,
  });

export const useConfigVersionHistory = (routerId: string) =>
  useQuery({
    queryKey: K.versions(routerId),
    queryFn: () => routerProvisioningService.listVersions(routerId),
    enabled: !!routerId,
  });

export function useRollbackConfigVersion(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => routerProvisioningService.rollback(routerId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.versions(routerId) });
      qc.invalidateQueries({ queryKey: K.status(routerId) });
    },
  });
}

export function useCreateBackup(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => routerProvisioningService.createBackup(routerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.status(routerId) }),
  });
}

export function useRestoreBackup(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (backupVersionId: string) =>
      routerProvisioningService.restoreBackup(routerId, backupVersionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.status(routerId) }),
  });
}

export function useFactoryReset(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => routerProvisioningService.factoryReset(routerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.status(routerId) }),
  });
}

export function useRotateSecret(routerId: string) {
  return useMutation({
    mutationFn: () => routerProvisioningService.rotateSecret(routerId),
  });
}

export const usePendingEnrollments = () =>
  useQuery({
    queryKey: K.enrollments,
    queryFn: () => routerProvisioningService.listPendingEnrollments(),
  });

export function useApproveEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApproveEnrollmentPayload }) =>
      routerProvisioningService.approveEnrollment(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.enrollments });
      qc.invalidateQueries({ queryKey: ["routers"] });
    },
  });
}

export function useRejectEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      routerProvisioningService.rejectEnrollment(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.enrollments }),
  });
}
