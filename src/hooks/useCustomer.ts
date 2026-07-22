import { useQuery } from "@tanstack/react-query";
import { customerService } from "@/services/customer.service";

export const customerKeys = {
  list: ["customers", "list"] as const,
  locationResources: (id: string) => ["customers", "locationResources", id] as const,
};

export function useLocationResources(locationId: string) {
  return useQuery({
    queryKey: customerKeys.locationResources(locationId),
    queryFn: () => customerService.getLocationResources(locationId),
    enabled: !!locationId,
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.list,
    queryFn: () => customerService.listCustomers(),
  });
}
