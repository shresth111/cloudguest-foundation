import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService, type ProvisioningPayload } from "@/services/customer.service";
import { locationKeys } from "./useLocations";
import { orgKeys } from "./useOrganizations";

export const customerKeys = {
  ownerCheck: (email: string) => ["customers", "ownerCheck", email.toLowerCase()] as const,
  list: ["customers", "list"] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
  locationResources: (id: string) => ["customers", "locationResources", id] as const,
};

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customerService.getCustomer(id),
    enabled: !!id,
  });
}

export function useLocationResources(locationId: string) {
  return useQuery({
    queryKey: customerKeys.locationResources(locationId),
    queryFn: () => customerService.getLocationResources(locationId),
    enabled: !!locationId,
  });
}


export function useCheckOwner(email: string, enabled: boolean) {
  return useQuery({
    queryKey: customerKeys.ownerCheck(email),
    queryFn: () => customerService.checkOwner(email),
    enabled: enabled && email.length > 3 && /\S+@\S+\.\S+/.test(email),
    staleTime: 30_000,
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.list,
    queryFn: () => customerService.listCustomers(),
  });
}

export function useProvisionCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProvisioningPayload) => customerService.provision(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all });
      qc.invalidateQueries({ queryKey: orgKeys.all });
      qc.invalidateQueries({ queryKey: customerKeys.list });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Parameters<typeof customerService.updateCustomer>) =>
      customerService.updateCustomer(...args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.list });
    },
  });
}

export function useSetCustomerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: "active" | "trial" | "suspended" }) =>
      customerService.setStatus(args.id, args.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.list });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerService.deleteCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.list });
    },
  });
}

