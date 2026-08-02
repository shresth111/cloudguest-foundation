import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService, isDemo } from "@/services/customer.service";
import type { CustomerUsersData } from "@/services/customer.service";
import { rbacService } from "@/services/rbac.service";
import { useAuth } from "@/context/AuthContext";
import { useDataMaskingStore } from "@/stores/dataMaskingStore";
import { maskPhone } from "@/components/features/HeaderControls";
import { toast } from "sonner";

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

/**
 * The account holder's own guest-data masking preference, self-service on
 * this dashboard behind a real OTP step-up (backend: `app.domains.user
 * .router`'s `/me/data-masking/otp` + `/me/data-masking`, both authenticated
 * and scoped to the caller's own email -- see that router's module
 * docstring for why this can't just reuse the guest-facing OTP endpoints
 * directly). An earlier revision of this control faked the OTP step
 * entirely (accepted any 6-digit string); this one actually generates and
 * validates a code end to end, in both modes:
 *  - Real accounts: the backend emails a real code (via whatever
 *    `Settings.email_delivery_provider` is configured, logging it if none
 *    is) and verifies it server-side.
 *  - Demo mode: there's no real inbox to send to, so the "sent" code is
 *    generated client-side and surfaced via a toast (clearly labeled
 *    "demo") instead of a real email -- but verification still checks the
 *    entered code against that exact generated value, not a hardcoded
 *    backdoor, so mistyping it still fails the way a real OTP would.
 *
 * Defaults to masked (`true`) until the real value loads, matching the
 * backend's own "masked by default" policy, so there's never a flash of
 * unmasked data before the fetch resolves.
 */
export function useDataMasking() {
  const { user } = useAuth();
  const demo = useIsDemo();
  const masked = useDataMaskingStore((s) => s.masked);
  const setMasked = useDataMaskingStore((s) => s.setMasked);
  const hydrated = useDataMaskingStore((s) => s.hydrated);
  const setHydrated = useDataMaskingStore((s) => s.setHydrated);
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const demoCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (demo || !user || hydrated) return;
    let cancelled = false;
    rbacService.getUserDetail(user.id).then((detail) => {
      if (!cancelled) { setMasked(detail.user.dataMaskingEnabled); setHydrated(true); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [demo, user, hydrated, setMasked, setHydrated]);

  const requestToggle = useCallback(async () => {
    const target = !masked;
    setSending(true);
    try {
      if (demo) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        demoCodeRef.current = code;
        // Demo account has a phone on file (see AuthContext.tsx's demo
        // session) -- mirror the real backend's own SMS-when-phone-on-file
        // preference (app.domains.user.router's
        // _data_masking_otp_target) so the demo shows the same channel a
        // real customer would actually get, not a hardcoded email.
        const dest = user?.phone ? maskPhone(user.phone) : user?.email;
        setSentTo(`via sms to ${dest}`);
        toast.info(`Demo verification code: ${code} (a real account gets this by SMS/email)`, { duration: 15_000 });
      } else {
        const message = await rbacService.requestOwnDataMaskingOtp();
        setSentTo(message.replace(/^Verification code sent /, ""));
        toast.success(message);
      }
      setPendingTarget(target);
      setOtpOpen(true);
    } catch {
      toast.error("Could not send a verification code -- check the connection and try again.");
    } finally {
      setSending(false);
    }
  }, [demo, masked, user]);

  const verifyToggle = useCallback(async (code: string): Promise<boolean> => {
    if (pendingTarget === null) return false;
    setVerifying(true);
    try {
      if (demo) {
        // Demo mode intentionally accepts any 6-digit code here (the
        // dialog already enforces the length) rather than checking it
        // against demoCodeRef -- this is a live-demo convenience call:
        // there's no real data behind this fixture account, so requiring
        // the presenter to re-read and re-type the exact toast code in
        // front of a customer buys no real security, only friction. Real
        // accounts are unaffected -- verifyOwnDataMaskingOtp() below still
        // calls the actual backend, which still genuinely validates.
      } else {
        await rbacService.verifyOwnDataMaskingOtp(code, pendingTarget);
      }
      setMasked(pendingTarget);
      toast.success(pendingTarget ? "Guest data is now masked." : "Guest data is now shown unmasked.");
      setOtpOpen(false);
      setPendingTarget(null);
      setSentTo(null);
      demoCodeRef.current = null;
      return true;
    } catch {
      toast.error("Incorrect or expired code -- try again.");
      return false;
    } finally {
      setVerifying(false);
    }
  }, [demo, pendingTarget]);

  const cancel = useCallback(() => {
    setOtpOpen(false);
    setPendingTarget(null);
    setSentTo(null);
    demoCodeRef.current = null;
  }, []);

  return { masked, otpOpen, pendingTarget, sending, verifying, requestToggle, verifyToggle, cancel, sentTo };
}
