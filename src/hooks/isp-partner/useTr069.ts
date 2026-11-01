/** Queries and mutations for the partner console's TR-069 screens (API_CONTRACT §5). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tr069Service } from "@/services/isp-partner/tr069";
import { ispKeys } from "@/hooks/isp-partner/keys";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import type {
  Tr069DeviceQuery,
  Tr069DeviceUpdate,
  Tr069LocationSettings,
} from "@/services/isp-partner/types";

export function useTr069Acs(enabled = true) {
  return useQuery({
    queryKey: ispKeys.tr069Acs,
    queryFn: () => tr069Service.getAcs(),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useRotateTr069Acs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => tr069Service.rotateAcs(),
    onSuccess: (data) => qc.setQueryData(ispKeys.tr069Acs, data),
  });
}

export function useTr069Customer(customerId: string) {
  return useQuery({
    queryKey: ispKeys.tr069Customer(customerId),
    queryFn: () => tr069Service.getCustomer(customerId),
    retry: retryUnless4xx,
  });
}

export function useSetTr069CustomerEnabled(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => tr069Service.setCustomerEnabled(customerId, enabled),
    onSuccess: (data) => {
      qc.setQueryData(ispKeys.tr069Customer(customerId), data);
      return Promise.all([
        qc.invalidateQueries({ queryKey: ispKeys.customers }),
        qc.invalidateQueries({ queryKey: ["isp", "tr069", "devices"] }),
      ]);
    },
  });
}

export function useRotateTr069Customer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => tr069Service.rotateCustomer(customerId),
    onSuccess: (data) => qc.setQueryData(ispKeys.tr069Customer(customerId), data),
  });
}

export function useTr069Location(locationId: string, enabled = true) {
  return useQuery({
    queryKey: ispKeys.tr069Location(locationId),
    queryFn: () => tr069Service.getLocation(locationId),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useSetTr069Location(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Tr069LocationSettings) => tr069Service.setLocation(locationId, body),
    onSuccess: (data) => {
      qc.setQueryData(ispKeys.tr069Location(locationId), data);
      return Promise.all([
        qc.invalidateQueries({ queryKey: ispKeys.locations }),
        qc.invalidateQueries({ queryKey: ["isp", "tr069", "script"] }),
      ]);
    },
  });
}

/** The script carries a password: never kept in the cache after use. */
export function useTr069RouterScript(routerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ispKeys.tr069Script(routerId),
    queryFn: () => tr069Service.routerScript(routerId),
    retry: retryUnless4xx,
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useTr069Devices(q: Tr069DeviceQuery, enabled = true) {
  return useQuery({
    queryKey: ispKeys.tr069Devices(q),
    queryFn: () => tr069Service.listDevices(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTr069Device(cpeId: string) {
  return useQuery({
    queryKey: ispKeys.tr069Device(cpeId),
    queryFn: () => tr069Service.getDevice(cpeId),
    retry: retryUnless4xx,
  });
}

export function useTr069Tasks(cpeId: string) {
  return useQuery({
    queryKey: ispKeys.tr069Tasks(cpeId),
    queryFn: () => tr069Service.deviceTasks(cpeId),
    retry: retryUnless4xx,
  });
}

function useInvalidateDevice(cpeId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ispKeys.tr069Device(cpeId) }),
      qc.invalidateQueries({ queryKey: ["isp", "tr069", "devices"] }),
    ]);
}

export function useUpdateTr069Device(cpeId: string) {
  const invalidate = useInvalidateDevice(cpeId);
  return useMutation({
    mutationFn: (body: Tr069DeviceUpdate) => tr069Service.updateDevice(cpeId, body),
    onSuccess: () => invalidate(),
  });
}

export function useTr069DeviceTask(cpeId: string) {
  const invalidate = useInvalidateDevice(cpeId);
  return useMutation({
    mutationFn: (kind: "refresh" | "reboot") =>
      kind === "refresh" ? tr069Service.refreshDevice(cpeId) : tr069Service.rebootDevice(cpeId),
    onSuccess: () => invalidate(),
  });
}
