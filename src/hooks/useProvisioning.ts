import { useMutation, useQuery } from "@tanstack/react-query";
import { provisioningService } from "@/services/provisioning.service";

export const useDiscoverDevice = () =>
  useMutation({ mutationFn: (routerId: string) => provisioningService.discover(routerId) });

export const useValidateDevice = () =>
  useMutation({
    mutationFn: (args: { routerId: string; provisionTemplateId?: string }) =>
      provisioningService.validate(args.routerId, args.provisionTemplateId),
  });

export const usePreviewConfiguration = () =>
  useMutation({
    mutationFn: (args: { routerId: string; provisionTemplateId: string }) =>
      provisioningService.previewConfiguration(args.routerId, args.provisionTemplateId),
  });

export const useCreateProvisionJob = () =>
  useMutation({
    mutationFn: (args: { routerId: string; provisionTemplateId?: string; maxRetries?: number }) =>
      provisioningService.createJob(args.routerId, args.provisionTemplateId, args.maxRetries),
  });

export const useStartProvisionJob = () =>
  useMutation({ mutationFn: (jobId: string) => provisioningService.startJob(jobId) });

export const useRetryProvisionJob = () =>
  useMutation({ mutationFn: (jobId: string) => provisioningService.retryJob(jobId) });

export const useRollbackProvisionJob = () =>
  useMutation({ mutationFn: (jobId: string) => provisioningService.rollbackJob(jobId) });

export const useCancelProvisionJob = () =>
  useMutation({
    mutationFn: (args: { jobId: string; reason?: string }) =>
      provisioningService.cancelJob(args.jobId, args.reason),
  });

export const useProvisionJob = (jobId: string | null, opts?: { pollWhileActive?: boolean }) =>
  useQuery({
    queryKey: ["provisioning", "job", jobId],
    queryFn: () => provisioningService.getJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      if (!opts?.pollWhileActive) return false;
      const status = query.state.data?.status;
      return status === "pending" || status === "in_progress" || status === "running"
        ? 3000
        : false;
    },
  });

export const useProvisionTimeline = (jobId: string | null) =>
  useQuery({
    queryKey: ["provisioning", "timeline", jobId],
    queryFn: () => provisioningService.getTimeline(jobId as string),
    enabled: !!jobId,
    refetchInterval: 4000,
  });
