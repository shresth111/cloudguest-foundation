import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService, type ProvisioningPayload } from "@/services/customer.service";
import { locationKeys } from "./useLocations";
import { orgKeys } from "./useOrganizations";

export const customerKeys = {
  ownerCheck: (email: string) => ["customers", "ownerCheck", email.toLowerCase()] as const,
  list: ["customers", "list"] as const,
};

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
