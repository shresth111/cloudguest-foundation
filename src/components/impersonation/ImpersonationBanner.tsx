import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth, IMPERSONATION_EXPIRES_AT_KEY } from "@/context/AuthContext";
import { getActiveImpersonationClaim } from "@/lib/jwt";

function readImpersonationExpiresAt(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IMPERSONATION_EXPIRES_AT_KEY);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Safety-critical disclosure that a Master Console operator is currently
 * looking at a customer's dashboard as that customer, not chrome -- so it
 * renders at the app root (see __root.tsx's `RootComponent`), ahead of
 * `<Outlet />`, once for the whole app rather than once per customer page.
 * That single placement is deliberate: whichever surface the impersonated
 * session can reach, this is already mounted above it.
 *
 * Presence is driven purely by decoding the ACTIVE session token, not a
 * separate "am I impersonating" flag that could drift from it -- whenever
 * it carries a top-level `impersonation` claim (written by the backend's
 * `impersonate_user`, present because `AuthContext.beginImpersonation`
 * stored that exact token as the active session, cleared by
 * `endImpersonation`), this renders; a normal login token never has that
 * claim, so this renders nothing for every ordinary session, on every
 * ordinary route.
 *
 * Both identities the person reading this needs are kept visible at all
 * times, per this feature's own top requirement: the impersonated
 * customer's name (`user.name`, from `useAuth()` -- while impersonating,
 * that IS the target's identity, see `beginImpersonation`) and the real
 * staff member's email (`actor_email`, off the token claim itself, since
 * that's the one place the acting operator's identity survives the
 * session swap).
 */
export function ImpersonationBanner() {
  const { user, endImpersonation } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const endedRef = useRef(false);

  // Client-only, same reason src/routes/index.tsx's useHostname() is:
  // reading localStorage during SSR/first paint would make the server and
  // client disagree about whether this renders at all.
  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const claim = mounted ? getActiveImpersonationClaim() : null;
  const expiresAt = mounted ? readImpersonationExpiresAt() : null;
  const msRemaining = expiresAt ? expiresAt.getTime() - nowMs : 0;

  function endSession() {
    if (endedRef.current) return;
    endedRef.current = true;
    endImpersonation();
    // Same "operator's most likely next stop" as the entry point itself
    // (see master.customers.tsx) -- back to the Customers list they left,
    // not just the Master Console's bare index.
    navigate({ to: "/master/customers", replace: true });
  }

  // Auto-end at zero, not just disabling the button -- the countdown
  // reaching zero IS the expiry, not a suggestion.
  useEffect(() => {
    if (!claim || !expiresAt) return;
    if (msRemaining <= 0) endSession();
    // endSession is intentionally not in the dep list -- it's a plain
    // function recreated every render, and re-running this effect for
    // that (rather than for the tick/claim/expiry actually changing) would
    // defeat `endedRef`'s whole job of making this idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim, expiresAt, msRemaining]);

  if (!mounted || !claim) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b-2 border-amber-800 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-md dark:border-amber-600 dark:bg-amber-500"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Viewing as <strong>{user?.name ?? "this customer"}</strong> — signed in as staff{" "}
        <strong>{claim.actor_email}</strong> · ends in{" "}
        <span className="tabular-nums">{formatCountdown(msRemaining)}</span>
      </span>
      <button
        type="button"
        onClick={endSession}
        className="rounded-md border border-amber-950/30 bg-amber-950/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 hover:bg-amber-950/20 dark:border-black/20 dark:bg-black/10 dark:text-amber-950 dark:hover:bg-black/20"
      >
        End session
      </button>
    </div>
  );
}
