import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService, isDemo } from "@/services/customer.service";
import type { CustomerUsersData } from "@/services/customer.service";

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
  adminLogsDashboardLogins: (page: number, pageSize: number) => ["customer", "admin-logs", "dashboard-logins", page, pageSize] as const,
  adminLogsRouterEvents: (page: number, pageSize: number) => ["customer", "admin-logs", "router-events", page, pageSize] as const,
  adminLogsAccountActivity: (page: number, pageSize: number) => ["customer", "admin-logs", "account-activity", page, pageSize] as const,
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

/** Real, server-side–paginated Logs sections (see customer.service.ts's
 * own "Logs (real, server-side–paginated)" comment) -- each keeps its own
 * page/pageSize in the query key so switching pages in one section (e.g.
 * Dashboard Logins) never refetches or resets the others. `placeholderData`
 * keeps the previous page's rows on screen while the next page loads,
 * rather than flashing the "Loading…" state on every page-number click. */
export function useAdminLogsDashboardLogins(page: number, pageSize = 25) {
  return useQuery({
    queryKey: customerKeys.adminLogsDashboardLogins(page, pageSize),
    queryFn: () => customerService.getAdminLogsDashboardLogins(page, pageSize),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useAdminLogsRouterEvents(page: number, pageSize = 25) {
  return useQuery({
    queryKey: customerKeys.adminLogsRouterEvents(page, pageSize),
    queryFn: () => customerService.getAdminLogsRouterEvents(page, pageSize),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useAdminLogsAccountActivity(page: number, pageSize = 25) {
  return useQuery({
    queryKey: customerKeys.adminLogsAccountActivity(page, pageSize),
    queryFn: () => customerService.getAdminLogsAccountActivity(page, pageSize),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => customerService.disconnectSession(sessionId),
    onSuccess: (_void, sessionId) => {
      // Patch every cached Users-list page in place so the row we just
      // disconnected visibly flips to offline right away. Demo mode's
      // disconnectSession() is intentionally a no-op (there's no real
      // session to kill) and getUsers() always regenerates the same static
      // fixture -- an invalidate-and-refetch there would silently undo this
      // click and make "Disconnect" look like it did nothing. Real sessions
      // still get a follow-up invalidate below so the eventual server truth
      // (already-ended session, updated counts) replaces this local patch.
      qc.setQueriesData({ queryKey: ["customer", "users"] }, (old: CustomerUsersData | undefined) => {
        if (!old) return old;
        return { ...old, users: old.users.map((u) => (u.id === sessionId ? { ...u, status: "offline" as const } : u)) };
      });
      if (!isDemo()) qc.invalidateQueries({ queryKey: ["customer"] });
    },
  });
}
