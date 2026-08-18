import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * Small shared visual primitives for the redesigned "light indigo" guest
 * sign-in flow (src/routes/portal.welcome/success/expired.tsx) -- kept
 * here rather than duplicated per-page since the spec calls for the exact
 * same alert banner and connecting overlay everywhere they appear.
 */

/**
 * The real Wyfy Guest brand mark (the corrected, symmetric hand-drawn
 * dot+arcs glyph -- see public/brand/*.svg), shown on the guest sign-in
 * screen (GuestSignInCard) and shell header (PortalShell) whenever a
 * location hasn't configured its own logo (`config.logoUrl` is falsy).
 * Previously both spots fell back to a generic lucide `Wifi` icon inside a
 * gradient badge -- a placeholder, not the actual product mark -- so a
 * guest at any location that hadn't uploaded a custom logo never saw real
 * Wyfy Guest branding at all. `mark-compact-blue` (not the full
 * horizontal lockup) matches the square/round slot both callers render a
 * logo into. This never overrides a location's real uploaded logo, which
 * still wins whenever `logoUrl` is set.
 */
export const DEFAULT_PORTAL_LOGO_SRC = "/brand/mark-compact-blue.svg";

/** Inline red alert banner -- "invalid mobile, wrong OTP, wrong password,
 * terms unchecked" per the design spec. Renders nothing when `message` is
 * falsy so callers can pass a possibly-undefined error message directly. */
export function AlertBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * "Connecting" overlay with a progress bar, shown while `active` is true.
 * `active` must be wired directly to a real mutation's own `isPending`
 * (the actual async login/verify call's lifecycle) -- never a fixed
 * setTimeout disconnected from whether a real request is still in flight.
 * The bar itself creeps toward (never reaches) ~92% while the request is
 * outstanding -- ordinary "work is happening, exact progress unknown"
 * UI -- and only ever completes to 100% for an instant right as `active`
 * flips back to false because the real request just resolved.
 */
export function ConnectingOverlay({ active, label }: { active: boolean; label: string }) {
  const [pct, setPct] = useState(0);
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    if (active) {
      setJustFinished(false);
      setPct(10);
      const id = setInterval(() => {
        setPct((p) => Math.min(92, p + (92 - p) * 0.15 + 1));
      }, 160);
      return () => clearInterval(id);
    }
    // Was active a moment ago -- flash to 100% then let the overlay
    // unmount (the caller navigates away right after the real mutation
    // resolves, so this mostly never gets seen mid-fade, but it's honest
    // if it is).
    setPct((p) => (p > 0 ? 100 : 0));
    const t = setTimeout(() => setPct(0), 300);
    return () => clearTimeout(t);
  }, [active]);

  if (!active && pct === 0) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[24px] bg-white/90 px-6 text-center backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--pr-primary,#6366f1)]" />
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--pr-primary,#6366f1)]/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--pr-primary,#6366f1)] to-[var(--pr-accent,#4f46e5)] transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {justFinished && <span className="sr-only">Connected</span>}
    </div>
  );
}

// disabled:shadow-none matters here, not just cosmetic: compounding the
// already-translucent shadow-indigo-500/25 with disabled:opacity-60
// multiplies down to a very-low-alpha blurred shadow that several
// renderers (this env's headless Chromium included) band/dash instead of
// blurring smoothly -- visible on first paint of the OTP screen, since
// the Verify button starts disabled before a guest has typed 6 digits.
// bg-gradient-to-r from/to reference var(--pr-primary)/var(--pr-accent)
// directly (Tailwind arbitrary values support CSS custom properties) --
// see PortalShell.tsx's own "portal-runtime" class fix for why these
// previously always resolved to the hardcoded #6366f1/#4f46e5 fallback
// regardless of the organization's real brand color: the class that
// scopes those variables was missing from its wrapper, so the CSS
// variable was never actually defined, and the fallback value inside
// var(--pr-primary, #6366f1) is exactly what silently rendered instead.
/**
 * Full-page "Connecting you to the internet…" state -- the one steady
 * visual shown both by `portal.index.tsx` (once a persisted session says
 * this device is already authenticated and just passing through on its way
 * to `/portal/success` or `/portal/session`) and `portal.success.tsx`
 * (actually firing the real hotspot-login POST). Real incident: iOS/
 * Android's own captive-portal-detection mini-browser periodically reloads
 * itself back to the original portal URL mid-flow (see
 * PortalRuntimeContext's `loadPersistedHotspotSubmit` docstring for the
 * confirmed-live specifics) -- that used to bounce a guest between this
 * page's own differently-styled "loading" screen (branded logo fade-in +
 * pulsing dots) and success.tsx's spinner+copy, and two visually distinct
 * screens alternating rapidly is exactly what read as a jarring "flick
 * flick" flash, on top of (and separate from) the remounting itself.
 * Rendering this identical frame on both sides means an already-
 * authenticated guest sees one steady, unchanging spinner throughout,
 * regardless of how many times the underlying route remounts underneath
 * it. Deliberately NOT shown for a genuinely first-time guest (no session
 * yet) -- that case keeps the real branded welcome/loading screen, since
 * there's no remount-bounce risk before any session exists at all. */
export function PortalConnectingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      <div>
        <p className="text-lg font-semibold text-slate-900">Connecting you to the internet…</p>
        <p className="mt-1 text-sm text-slate-500">Just a moment.</p>
      </div>
    </div>
  );
}

// Flat, single-color fill in the venue's own --pr-primary -- not the
// previous from/to gradient across --pr-primary/--pr-accent, which can
// produce muddy or low-contrast combinations for venues that didn't pick
// those two colors to work together as a gradient (see the visual-redesign
// spec's §2 "Card" note). `transition-property` is scoped to the 2-3
// things that actually change on hover/press/disabled (background/shadow/
// transform), not `transition-all`, which used to animate every
// animatable property on every state change for no visual payoff.
export const PG_PRIMARY_BTN =
  "h-[52px] w-full rounded-2xl bg-[var(--pr-primary,#6366f1)] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)] transition-[background-color,box-shadow,transform] duration-200 hover:brightness-105 active:translate-y-px disabled:opacity-60 disabled:shadow-none";

export const PG_INPUT =
  "h-[52px] rounded-2xl border-slate-200 bg-white text-[15px] text-slate-900 placeholder:text-slate-400 transition-[border-color,box-shadow] duration-200 hover:border-slate-300 focus-visible:border-[var(--pr-primary,#6366f1)] focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15";
