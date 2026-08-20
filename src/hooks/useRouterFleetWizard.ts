import { useMutation, useQuery } from "@tanstack/react-query";
import { routerFleetWizardService } from "@/services/router-fleet-wizard.service";
import type { FleetGuestNetworkRequest } from "@/types/router-fleet-wizard";

export const fleetWizardKeys = {
  all: ["router-fleet-wizard"] as const,
  compatibility: (routerId: string) => [...fleetWizardKeys.all, "compatibility", routerId] as const,
  snapshot: (routerId: string) => [...fleetWizardKeys.all, "snapshot", routerId] as const,
  wanGate: (routerId: string) => [...fleetWizardKeys.all, "wan-gate", routerId] as const,
  provisionJob: (jobId: string) => [...fleetWizardKeys.all, "job", jobId] as const,
  guestAvailability: (routerId: string) =>
    [...fleetWizardKeys.all, "guest-availability", routerId] as const,
  plan: (routerId: string, planId: string) =>
    [...fleetWizardKeys.all, "plan", routerId, planId] as const,
};

export function usePreviewBootstrapScript() {
  return useMutation({
    mutationFn: (args: { routerId: string; organizationId?: string }) =>
      routerFleetWizardService.previewBootstrap(args.routerId, args.organizationId),
  });
}

export function useDiscoverRouter() {
  return useMutation({
    mutationFn: (args: { routerId: string; organizationId?: string }) =>
      routerFleetWizardService.discover(args.routerId, args.organizationId),
  });
}

export function useRouterCompatibility(routerId: string, organizationId?: string, enabled = true) {
  return useQuery({
    queryKey: fleetWizardKeys.compatibility(routerId),
    queryFn: () => routerFleetWizardService.getCompatibility(routerId, organizationId),
    enabled: !!routerId && enabled,
  });
}

export function useLatestRouterSnapshot(routerId: string, organizationId?: string) {
  return useQuery({
    queryKey: fleetWizardKeys.snapshot(routerId),
    queryFn: () => routerFleetWizardService.getLatestSnapshot(routerId, organizationId),
    enabled: !!routerId,
  });
}

export function usePreviewBasicWan() {
  return useMutation({
    mutationFn: (args: { routerId: string; lanBridge?: string; organizationId?: string }) =>
      routerFleetWizardService.previewBasicWan(args.routerId, args.lanBridge, args.organizationId),
  });
}

export function useApplyBasicWan() {
  return useMutation({
    mutationFn: (args: {
      routerId: string;
      organizationId?: string;
      lanBridge?: string;
      staticAddresses?: { linkId: string; staticAddress: string }[];
    }) =>
      routerFleetWizardService.applyBasicWan(
        args.routerId,
        {
          lanBridge: args.lanBridge,
          staticAddresses: args.staticAddresses,
        },
        args.organizationId,
      ),
  });
}

export function useVerifyRouterWan() {
  return useMutation({
    mutationFn: (args: { routerId: string; organizationId?: string }) =>
      routerFleetWizardService.verifyWan(args.routerId, args.organizationId),
  });
}

export function useWanVerificationGate(
  routerId: string,
  organizationId?: string,
  opts?: { pollWhilePending?: boolean },
) {
  return useQuery({
    queryKey: fleetWizardKeys.wanGate(routerId),
    queryFn: () => routerFleetWizardService.getWanVerificationGate(routerId, organizationId),
    enabled: !!routerId,
    refetchInterval: opts?.pollWhilePending ? 3000 : false,
  });
}

export function useFleetProvisionJob(jobId: string | null, pollWhileActive = false) {
  return useQuery({
    queryKey: fleetWizardKeys.provisionJob(jobId ?? ""),
    queryFn: () => routerFleetWizardService.getProvisionJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      if (!pollWhileActive) return false;
      const status = query.state.data?.status;
      return status === "pending" || status === "in_progress" || status === "running"
        ? 3000
        : false;
    },
  });
}

export function useGuestInterfaceAvailability(routerId: string, organizationId?: string) {
  return useQuery({
    queryKey: fleetWizardKeys.guestAvailability(routerId),
    queryFn: () => routerFleetWizardService.getGuestInterfaceAvailability(routerId, organizationId),
    enabled: !!routerId,
  });
}

export function useBuildConfigurationPlan() {
  return useMutation({
    mutationFn: (args: {
      routerId: string;
      organizationId?: string;
      snapshotId?: string;
      requestedConfig: FleetGuestNetworkRequest;
    }) =>
      routerFleetWizardService.buildConfigurationPlan(
        args.routerId,
        args.requestedConfig,
        args.organizationId,
        args.snapshotId,
      ),
  });
}

export function useApproveConfigurationPlan() {
  return useMutation({
    mutationFn: (args: { routerId: string; planId: string; organizationId?: string }) =>
      routerFleetWizardService.approveConfigurationPlan(
        args.routerId,
        args.planId,
        args.organizationId,
      ),
  });
}

export function useRenderConfigurationPlan() {
  return useMutation({
    mutationFn: (args: { routerId: string; planId: string; organizationId?: string }) =>
      routerFleetWizardService.renderConfigurationPlan(
        args.routerId,
        args.planId,
        args.organizationId,
      ),
  });
}

export function usePrepareConfigurationPlan() {
  return useMutation({
    mutationFn: (args: { routerId: string; planId: string; organizationId?: string }) =>
      routerFleetWizardService.prepareConfigurationPlan(
        args.routerId,
        args.planId,
        args.organizationId,
      ),
  });
}

export function useApplyConfigurationPlan() {
  return useMutation({
    mutationFn: (args: { routerId: string; planId: string; organizationId?: string }) =>
      routerFleetWizardService.applyConfigurationPlan(
        args.routerId,
        args.planId,
        args.organizationId,
      ),
  });
}

export function useVerifyPlanFinal() {
  return useMutation({
    mutationFn: (args: { routerId: string; planId: string; organizationId?: string }) =>
      routerFleetWizardService.verifyPlanFinal(args.routerId, args.planId, args.organizationId),
  });
}
