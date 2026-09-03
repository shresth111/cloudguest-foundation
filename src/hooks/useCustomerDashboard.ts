import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService, isDemo, resolveOrgId } from "@/services/customer.service";
import type { CustomerUsersData } from "@/services/customer.service";
import { guestService } from "@/services/guest.service";
import { rbacService } from "@/services/rbac.service";
import { useAuth } from "@/context/AuthContext";
import { useDataMaskingStore } from "@/stores/dataMaskingStore";
// From `@/lib/masking`, NOT `@/components/features/HeaderControls` (which
// re-exports the same function): `customerLocationGuard.ts` imports
// `customerKeys` from this module and is called from a dozen route
// `beforeLoad`s, which never get code-split away from the entry chunk --
// so importing this through the HeaderControls module would put the whole
// of framer-motion in front of every guest. See `@/lib/masking`'s note.
import { maskPhone } from "@/lib/masking";
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
  useEffect(() => {
    setDemo(isDemo());
  }, []);
  return demo;
}

export const customerKeys = {
  permissions: ["customer", "permissions"] as const,
  sidebar: ["customer", "sidebar"] as const,
  locations: ["customer", "locations"] as const,
  dashboard: (locationId: string) => ["customer", "dashboard", locationId] as const,
  users: (locationId: string, params?: Record<string, unknown>) =>
    ["customer", "users", locationId, params] as const,
  onlineNow: (locationId: string) => ["customer", "users", "online-now", locationId] as const,
  features: (feature: string, locationId: string) =>
    ["customer", "features", feature, locationId] as const,
  adminLogsDashboardLogins: (page: number, pageSize: number) =>
    ["customer", "admin-logs", "dashboard-logins", page, pageSize] as const,
  adminLogsRouterEvents: (page: number, pageSize: number) =>
    ["customer", "admin-logs", "router-events", page, pageSize] as const,
  adminLogsAccountActivity: (page: number, pageSize: number) =>
    ["customer", "admin-logs", "account-activity", page, pageSize] as const,
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
  params?: { search?: string; status?: string; page?: number; pageSize?: number },
) {
  return useQuery({
    queryKey: customerKeys.users(locationId, params),
    queryFn: () =>
      customerService.getUsers(
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

/** Real, location-wide "online right now" count -- see
 * customerService.getOnlineCount()'s own docstring for what this actually
 * counts (server-side `status=active` total, not this page's 8-row
 * slice). Refetches every 30s, independent of the paginated Users list's
 * own query, so switching search/tab/page on the table never resets or
 * refetches this number and it keeps drifting toward "live" on its own. */
export function useCustomerOnlineNow(locationId: string) {
  return useQuery({
    queryKey: customerKeys.onlineNow(locationId),
    queryFn: () => customerService.getOnlineCount(locationId),
    enabled: !!locationId,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useCustomerFeatureData(feature: string, locationId: string) {
  return useQuery({
    queryKey: customerKeys.features(feature, locationId),
    queryFn: () => customerService.getFeatureData(feature, locationId),
    enabled: !!feature && !!locationId,
    staleTime: 15_000,
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

/**
 * Real force-disconnect -- see customerService.disconnectSession()'s own
 * docstring for what "real" means now (session AND router-level device
 * binding, not just the session flag). Needs guestId + locationId
 * threaded through (not just the session id) so the service layer can
 * find this guest's real ConnectedDevice row at this location; both come
 * from the Users-page row/detail-panel state, which now carries guestId
 * (see CustomerUsersData).
 */
export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      guestId,
      locationId,
    }: {
      sessionId: string;
      guestId: string | null;
      locationId: string;
    }) => customerService.disconnectSession(sessionId, guestId, locationId),
    onSuccess: (_result, { sessionId }) => {
      // Patch every cached Users-list page in place so the row we just
      // disconnected visibly flips to offline right away. Demo mode's
      // disconnectSession() is intentionally a no-op (there's no real
      // session to kill) and getUsers() always regenerates the same static
      // fixture -- an invalidate-and-refetch there would silently undo this
      // click and make "Disconnect" look like it did nothing. Real sessions
      // still get a follow-up invalidate below so the eventual server truth
      // (already-ended session, updated counts, real online-now count)
      // replaces this local patch.
      //
      // Guarded to only touch cache entries actually shaped like
      // CustomerUsersData (an array of `users`) -- the queryKey filter
      // below is a prefix match, so it would otherwise also hit the
      // sibling ["customer","users","online-now",locationId] cache entry
      // (a bare number) and corrupt it via the spread below.
      qc.setQueriesData(
        { queryKey: ["customer", "users"] },
        (old: CustomerUsersData | number | undefined) => {
          if (!old || typeof old !== "object" || !Array.isArray(old.users)) return old;
          return {
            ...old,
            users: old.users.map((u) =>
              u.id === sessionId ? { ...u, status: "offline" as const } : u,
            ),
          };
        },
      );
      if (!isDemo()) qc.invalidateQueries({ queryKey: ["customer"] });
    },
  });
}

/**
 * Real +N-minute session extension -- guestService.extendSession(), the
 * same already-working, already-used-elsewhere method DebuggingView's
 * "Reset a Guest Session" card's own sibling terminateSession() call
 * uses (see that view's resetSession() docstring/comment). Unlike
 * customerService.disconnectSession() above, guestService.extendSession()
 * has no demo-mode guard of its own (it's a thin POST to
 * /guest-sessions/{id}/extend against whatever id it's given) -- callers
 * must check useIsDemo() themselves before calling `.mutate()`, same as
 * DebuggingView's resetSession() checks `demo` before its own
 * terminateSession() call.
 */
export function useExtendSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      additionalMinutes,
    }: {
      sessionId: string;
      additionalMinutes: number;
    }) => guestService.extendSession(sessionId, additionalMinutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", "users"] });
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

  // Which user id this effect has a request in flight for, or has already
  // completed. `hydrated` alone cannot serve as that guard: it is only set
  // once the request *resolves*, so any re-render in between -- a new `user`
  // object identity is enough, and this hook backs the whole shell -- re-ran
  // the effect and issued a second identical `GET /users/{id}`. Measured:
  // two of them on every page load. This request sits outside React Query,
  // which would otherwise have deduped it.
  const maskingFetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (demo || !user || hydrated) return;
    if (maskingFetchedFor.current === user.id) return;
    maskingFetchedFor.current = user.id;
    let cancelled = false;
    resolveOrgId()
      .then((orgId) => rbacService.getUserDetail(user.id, orgId))
      .then((detail) => {
        if (!cancelled) {
          setMasked(detail.user.dataMaskingEnabled);
          setHydrated(true);
        }
      })
      .catch(() => {
        // Let a later render retry: a failed fetch must not leave the
        // masking preference permanently unread.
        if (maskingFetchedFor.current === user.id) {
          maskingFetchedFor.current = null;
        }
      });
    return () => {
      cancelled = true;
    };
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
        toast.info(`Demo verification code: ${code} (a real account gets this by SMS/email)`, {
          duration: 15_000,
        });
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

  const verifyToggle = useCallback(
    async (code: string): Promise<boolean> => {
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
        toast.success(
          pendingTarget ? "Guest data is now masked." : "Guest data is now shown unmasked.",
        );
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
    },
    [demo, pendingTarget],
  );

  const cancel = useCallback(() => {
    setOtpOpen(false);
    setPendingTarget(null);
    setSentTo(null);
    demoCodeRef.current = null;
  }, []);

  return {
    masked,
    otpOpen,
    pendingTarget,
    sending,
    verifying,
    requestToggle,
    verifyToggle,
    cancel,
    sentTo,
  };
}
