import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customer.service";

export const customerKeys = {
  locations: ["customer", "locations"] as const,
  dashboard: (locationId: string) => ["customer", "dashboard", locationId] as const,
  users: (locationId: string, params?: Record<string, unknown>) => ["customer", "users", locationId, params] as const,
};

export function useCustomerLocations() {
  return useQuery({
    queryKey: customerKeys.locations,
    queryFn: () => customerService.listLocations(),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCustomerDashboard(locationId: string) {
  return useQuery({
    queryKey: customerKeys.dashboard(locationId),
    queryFn: () => customerService.getDashboard(locationId),
    enabled: !!locationId,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCustomerUsers(
  locationId: string,
  params?: { search?: string; status?: string; page?: number; pageSize?: number }
) {
  return useQuery({
    queryKey: customerKeys.users(locationId, params),
    queryFn: () => customerService.getUsers(
      locationId,
      params?.search,
      params?.status,
      params?.page || 1,
      params?.pageSize || 20,
    ),
    enabled: !!locationId,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => customerService.disconnectSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer"] }),
  });
}
