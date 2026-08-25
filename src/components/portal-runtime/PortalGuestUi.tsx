import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

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
      className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
      style={{
        borderColor: "var(--pg-danger-border, #FECACA)",
        backgroundColor: "var(--pg-danger-bg, #FEF2F2)",
        color: "var(--pg-danger, #DC2626)",
      }}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * A short safety reminder shown once per sign-in screen (phone/email entry,
 * OTP code entry, password entry) -- a real, original security tip about
 * this platform's own auth methods (never a fixed color/venue concern),
 * not fixed marketing copy. Sits below the primary action, separated by a
 * hairline the same way the terms notice already is, echoing a reference
 * competitor design's "Caution!" placement without copying its wording.
 * Amber/warning tone is semantic (matches this app's own warning color
 * elsewhere) rather than tied to venue or Wyfy brand color, the same
 * reasoning `AlertBanner`'s fixed red already follows.
 */
export function SecurityTip() {
  const { t } = usePortalRuntime();
  return (
    <div className="mt-1 border-t border-[var(--pg-border)] pt-3 text-center">
      <p className="flex items-center justify-center gap-1.5 pg-meta font-semibold text-amber-700">
        <ShieldAlert className="h-3.5 w-3.5" /> {t("securityTipLabel")}
      </p>
      <p className="mt-1 pg-meta text-[var(--pg-ink-muted)]">{t("securityTipBody")}</p>
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
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--pg-surface,#fff)]/90 px-6 text-center backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--pr-primary,#6366f1)]" />
      <p className="pg-body font-medium text-[var(--pg-ink,#1E1B4B)]">{label}</p>
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
 * there's no remount-bounce risk before any session exists at all.
 *
 * Visual note (captive-portal-redesign-spec.md §4, Engineer B): restyled
 * to read as the same flattened "card" language as the rest of this
 * flow (thin 1px border, 16px radius, a small tight shadow -- not the
 * `0 24px 60px -20px rgba(79,70,229,.28)` glass-card recipe the spec
 * calls out as the thing to move away from) instead of a bare spinner
 * floating in open page space, so the guest's one continuous "getting you
 * online" moment reads as one visual object throughout, not "card, then
 * nothing." Deliberately does NOT reuse `ConnectingOverlay` (that
 * component is an *overlay* absolutely-positioned over a real in-flight
 * mutation's own card in `GuestSignInCard`, and drives a creeping
 * progress bar off that mutation's real `isPending`) -- this state has no
 * real mutation of its own to track, so per the spec's own "simpler and
 * honest" alternative this stays a spinner + label, just inside the same
 * card shape, with no fabricated progress indicator. Spinner color reads
 * `--pr-primary` (the venue's own brand color, same as `ConnectingOverlay`)
 * rather than a hardcoded indigo, so it stays on-brand per organization
 * like the rest of the redesigned flow. Still the single shared component
 * across `portal.index.tsx` and `portal.success.tsx` -- do not fork this
 * into a second component (see PR #50 / this file's own docstring above). */
export function PortalConnectingState() {
  // Shared across portal.index.tsx and portal.success.tsx (see the doc
  // comment above -- do not fork), so both render sites pick up the same
  // translated copy from the one provider they both mount under.
  const { t } = usePortalRuntime();
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      {/* `pg-surface-card` + `rounded-[20px]`: the one shared surface
       * recipe (PortalCard / GUEST_LEGIBILITY_CARD_CLASS) -- this was the
       * last 16px-radius card on the guest flow, and without the marker
       * class its text tokens would not flip back to ink under
       * `data-pg-scrim="dark"`. Hex fallbacks match the retuned v7 tokens
       * (#1E1B4B / #475569), not the stale pre-#108 slate values. */}
      <div
        className="pg-surface-card flex w-full max-w-[360px] flex-col items-center gap-4 rounded-[20px] border px-8 py-10 text-center"
        style={{
          borderColor: "var(--pg-border, #E2E8F0)",
          backgroundColor: "var(--pg-surface, #fff)",
          boxShadow: "0 1px 2px rgba(30,27,75,0.06), 0 8px 24px -12px rgba(30,27,75,0.18)",
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--pr-primary,#6366f1)]" />
        <div>
          <p className="pg-body font-semibold text-[var(--pg-ink,#1E1B4B)]">
            {t("connectingTitle")}
          </p>
          <p className="mt-1 pg-meta font-normal text-[var(--pg-ink-muted,#475569)]">
            {t("connectingSubtitle")}
          </p>
        </div>
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
// `text-[color:var(--pr-primary-foreground,#ffffff)]`, not a hardcoded
// `text-white` -- v4 §2's contrast-safe fix: a venue that picks a pale
// accent color (a light yellow, a pastel) used to get illegible button
// text, the identical legibility failure PR #80 fixed for background
// photos, just for a different element. `--pr-primary-foreground` is
// computed once, alongside `--pr-primary` itself, by
// `accessibleForeground()` (PortalRuntimeContext.tsx).
// captive-portal-v5-design-spec.md §3.3/§5.4: 52px -> 48px -- still
// comfortably above the 44x44px WCAG 2.1 / Purple splash-page-guidance
// touch-target floor (§0), this is trimming the excess above that floor,
// not undercutting accessibility.
// captive-portal-v7-design-spec.md §7.3: `h-[48px]` -> `h-auto
// min-h-[3rem]` + `py-2`. A fixed height is the exact shape that fails on
// Android WebView, which DOES apply the system font scale to web text --
// the label grows and clips inside a box that cannot grow with it (SC
// 1.4.4 + 1.4.10 + 1.4.12). `min-height` in `rem` is the same 48px at a
// 16px root and expands instead of clipping. `h-auto` is load-bearing:
// `min-h-*` does not displace `h-9` from the shared `<Input>`/`<button>`
// base classes under tailwind-merge, but `h-auto` does.
// The focus-visible ring closes an asymmetry that sat below the shadcn
// bar: PG_INPUT has carried a visible 4px focus ring since v7, while the
// primary button -- the single most-focused element on the surface -- had
// no visible keyboard-focus state at all. Same ring family as the input
// (venue `--pr-primary` at low alpha), offset against the card surface.
export const PG_PRIMARY_BTN =
  "h-auto min-h-[3rem] w-full rounded-2xl bg-[var(--pr-primary,#6366f1)] px-4 py-2 font-semibold text-[color:var(--pr-primary-foreground,#ffffff)] shadow-[0_2px_8px_-2px_rgba(30,27,75,0.18)] transition-[background-color,box-shadow,transform] duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pg-surface,#fff)] active:translate-y-px disabled:opacity-60 disabled:shadow-none";

// The one secondary-button recipe (captive-portal redesign spec §1.4).
// Before this constant existed every screen that needed a "not the
// primary action" button hand-rolled its own -- `h-12 rounded-[14px]
// border-slate-200 text-slate-700` on expired, `h-11 rounded-[14px]
// text-slate-500` on team/set-password, a red-hover variant on session --
// four different geometries and three different greys for one role.
// Same control geometry as PG_PRIMARY_BTN (48px floor, 16px radius,
// h-auto so Android font scale grows the box instead of clipping), quiet
// surface fill, and the same focus-ring family as PG_INPUT.
export const PG_SECONDARY_BTN =
  "h-auto min-h-[3rem] w-full rounded-2xl border border-[var(--pg-border,#E2E8F0)] bg-[var(--pg-surface,#fff)] px-4 py-2 font-semibold text-[var(--pg-ink-muted,#475569)] transition-[border-color,background-color,color] duration-200 hover:border-[var(--pg-ink-faint,#505E73)] hover:text-[var(--pg-ink,#1E1B4B)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15 active:translate-y-px disabled:opacity-60";

// v7 §7.2/§7.4-4: `placeholder:text-[var(--pg-ink-faint)]` is gone.
// `--pg-ink-faint` was 2.56:1 on this input's own white background, and
// under the old "high contrast" root filter it dropped to 2.30:1 -- on
// what was, until this branch, the *only* labelling these fields had. The
// placeholder is now `--pg-ink-muted` (7.58:1 on #FFFFFF) and it is an
// example, not a name: every field on the primary path carries a real
// `<Label htmlFor>` (AuthFields.tsx).
// The hover border moving to the retuned `--pg-ink-faint` also fixes a
// second, quieter failure: the old #94A3B8 hover state was 2.56:1 against
// --pg-surface and so missed SC 1.4.11's 3:1 for a non-text UI indicator.
// #505E73 is 6.58:1.
// captive-portal-v7-design-spec.md §8.2, and this was left explicitly
// unfixed by the Part 7 pass: **every input must be >= 16px**, or iOS
// zooms the page on focus. That zoom is not a cosmetic wobble -- it
// rescales a layout that has already committed to `viewport-fit=cover`
// and `dvh`, so the primary button can end up off-screen at the exact
// moment the guest is typing into the field above it, on the one screen
// the whole product exists to complete. 0.9375rem (15px) was under it.
//
// Two font-size utilities, not one: the shared `<Input>` base carries
// `text-base md:text-sm`, and tailwind-merge resolves `md:` variants
// independently of the bare class -- so a single unprefixed size here
// leaves `md:text-sm` (14px) winning from 768px up, which is both under
// the threshold and the width the admin Portal Preview renders the guest
// card at. Both forms are `text-[length:...]` arbitrary values rather
// than a custom `@utility`, because only that form is recognised as a
// font-size by tailwind-merge and therefore only that form can displace
// the base class at all (a custom utility silently loses -- the exact bug
// the first cut of the Part 7 branch shipped).
export const PG_INPUT =
  "h-auto min-h-[3rem] rounded-2xl border-[var(--pg-border,#E2E8F0)] bg-[var(--pg-surface,#fff)] py-2 text-[length:calc(1rem*var(--pg-type-scale,1))] md:text-[length:calc(1rem*var(--pg-type-scale,1))] text-[var(--pg-ink,#1E1B4B)] placeholder:text-[var(--pg-ink-muted,#475569)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--pg-ink-faint,#505E73)] focus-visible:border-[var(--pr-primary,#6366f1)] focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15";
