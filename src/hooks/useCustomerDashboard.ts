import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService, isDemo } from "@/services/customer.service";

/** SSR-safe demo-mode flag. isDemo() reads localStorage, which doesn't
 * exist during server render -- calling it directly during render (e.g. in
 * a useState initializer or JSX conditional) makes the server's output
 * disagree with the client's hydration pass and React discards the tree.
 * Defaults to true (demo, the common path for this app) so server and
 * client agree on the first render, then corrects itself via effect once
 * mounted client-side. */
export function useIsDemo(): boolean {
  const [demo, setDemo] = useState(true);
  useEffect(() => { setDemo(isDemo()); }, []);
  return demo;
}

export const customerKeys = {
  permissions: ["customer", "permissions"] as const,
  sidebar: ["customer", "sidebar"] as const,
  locations: ["customer", "locations"] as const,
  dashboard: (locationId: string) => ["customer", "dashboard", locationId] as const,
  users: (locationId: string, params?: Record<string, unknown>) => ["customer", "users", locationId, params] as const,
  features: (feature: string, locationId: string) => ["customer", "features", feature, locationId] as const,
};

export function useCustomerPermissions() {
  return useQuery({ queryKey: customerKeys.permissions, queryFn: () => customerService.getPermissions(), staleTime: 60_000 });
}

export function useCustomerSidebar() {
  return useQuery({ queryKey: customerKeys.sidebar, queryFn: () => customerService.getSidebar(), staleTime: 60_000 });
}

export function useCustomerLocations() {
  return useQuery({ queryKey: customerKeys.locations, queryFn: () => customerService.listLocations(), staleTime: 30_000, retry: 1 });
}

export function useCustomerDashboard(locationId: string) {
  return useQuery({ queryKey: customerKeys.dashboard(locationId), queryFn: () => customerService.getDashboard(locationId), enabled: !!locationId, staleTime: 15_000, retry: 1 });
}

export function useCustomerUsers(locationId: string, params?: { search?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: customerKeys.users(locationId, params),
    queryFn: () => customerService.getUsers(locationId, params?.search, params?.status, params?.page || 1, params?.pageSize || 20),
    enabled: !!locationId, staleTime: 10_000, retry: 1,
  });
}

export function useCustomerFeatureData(feature: string, locationId: string) {
  return useQuery({
    queryKey: customerKeys.features(feature, locationId),
    queryFn: () => customerService.getFeatureData(feature, locationId),
    enabled: !!feature && !!locationId, staleTime: 15_000,
  });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (sessionId: string) => customerService.disconnectSession(sessionId), onSuccess: () => qc.invalidateQueries({ queryKey: ["customer"] }) });
}
