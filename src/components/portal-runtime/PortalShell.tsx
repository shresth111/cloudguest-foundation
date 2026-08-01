import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { A11yMenu } from "./A11yMenu";

// A static "network" mesh -- a handful of connected nodes, a couple of
// concentric range rings, and a faint grid -- replacing the two blurred
// gradient "glow blobs" the light variant used before. Reads as
// connectivity without a literal wifi-signal icon, and is genuinely
// on-brand per organization: colors come from the same `--pr-primary`/
// `--pr-accent` CSS custom properties every other per-org accent in this
// file already uses, not a hardcoded indigo. Deliberately static (no
// animation loop) -- this renders on a guest's own phone before they have
// real internet, not worth the extra CPU/battery for a decorative touch.
const MESH_NODES: Array<{ x: number; y: number; r: number }> = [
  { x: 60, y: 90, r: 3 },
  { x: 180, y: 40, r: 2.5 },
  { x: 300, y: 130, r: 3.5 },
  { x: 120, y: 220, r: 2.5 },
  { x: 260, y: 260, r: 3 },
];
const MESH_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 4],
  [0, 3],
  [3, 4],
];

function AmbientMesh() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute -left-24 -top-28 h-[420px] w-[420px] opacity-[0.18]"
        viewBox="0 0 240 240"
        fill="none"
      >
        {[40, 75, 110].map((r) => (
          <circle
            key={r}
            cx="120"
            cy="120"
            r={r}
            stroke="var(--pr-primary, #6366f1)"
            strokeWidth="1"
          />
        ))}
      </svg>
      <svg
        className="absolute -left-10 -top-10 h-[340px] w-[340px] sm:h-[420px] sm:w-[420px]"
        viewBox="0 0 320 320"
        fill="none"
      >
        <g>
          {MESH_EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={MESH_NODES[a].x}
              y1={MESH_NODES[a].y}
              x2={MESH_NODES[b].x}
              y2={MESH_NODES[b].y}
              stroke="var(--pr-primary, #6366f1)"
              strokeOpacity="0.16"
              strokeWidth="1"
            />
          ))}
          {MESH_NODES.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="var(--pr-primary, #6366f1)"
              fillOpacity="0.35"
            />
          ))}
        </g>
      </svg>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.5] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--pr-accent, #4f46e5) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

/** The lg:+ (laptop-width) left-hand context panel -- fills the space
 * that used to be empty gradient next to a small floating card. Copy is
 * deliberately generic (real venue name, phrased so it never repeats the
 * exact headline sentence the sign-in card on the right already shows)
 * rather than fabricated marketing claims (speed, encryption, session
 * length) this codebase has no real config field for -- see this
 * session's own audit call-out on not inventing guest-facing copy that
 * isn't backed by real data. */
function BrandPanel({ venueName }: { venueName?: string }) {
  return (
    <div className="max-w-lg">
      <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 backdrop-blur">
        <Wifi className="h-3.5 w-3.5" /> Guest network
      </span>
      <h2
        className="mt-6 text-[42px] font-bold leading-[1.08] tracking-[-0.02em] text-slate-900 xl:text-[50px]"
        style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
      >
        Fast, secure WiFi{venueName ? <>, courtesy of {venueName}</> : null}.
      </h2>
      <p className="mt-5 max-w-md text-[16px] leading-relaxed text-slate-500">
        Verify your device on the right to get connected -- it takes about fifteen seconds.
      </p>
    </div>
  );
}

interface Props {
  children: ReactNode;
  showHeader?: boolean;
  contentClassName?: string;
  /** "dark" (default) is the original glass-on-navy look, still used by
   * every portal.* route this visual redesign didn't touch
   * (offline/failure/ad/redirect/terms/session/auth picker). "light" is
   * the new spec-driven look (white card, 24px radius, soft layered
   * shadow, indigo-tinted gradient background with an animated glow
   * blob) used by the redesigned guest sign-in flow itself (welcome,
   * success, expired, set-password). */
  variant?: "dark" | "light";
  /** When true, sizes to 100% of its parent container (`h-full`) instead
   * of the full viewport (`min-h-dvh`) -- used by the admin Portal
   * Preview (src/routes/preview.portal.$locationId.tsx), which renders
   * this exact component inside a fixed-size phone-bezel mockup rather
   * than a real full-page /portal/* route. */
  constrained?: boolean;
}

export function PortalShell({
  children,
  showHeader = true,
  contentClassName,
  variant = "dark",
  constrained = false,
}: Props) {
  const { config, highContrast, largeText, organizationId, locationId, routerId } =
    usePortalRuntime();
  // Every portal.* route requires these three as real, required search
  // params (see src/routes/portal.tsx's own searchSchema) -- built
  // explicitly from the real runtime context here (rather than
  // `search={(prev) => prev}`) because PortalShell itself is shared
  // across routes with different search shapes, so there's no single
  // `from` route TanStack Router could type that callback against.
  const portalSearch = { organizationId, locationId, routerId };
  // `min-h-full`, not `h-full` -- the sole `constrained` caller (the Portal
  // Preview's laptop mockup) used to pair `h-full` with a fixed-height
  // parent box, which clipped (or forced an internal scrollbar on) any
  // guest-flow state taller than that box: "ye complete page nahi dikha
  // sakte ho... sahi se full page scroll nahi kr paunga". `min-h-full`
  // only sets a floor, so this shell (and its fixed-height-turned-min-height
  // parent) can grow to fit whatever the real content needs instead of
  // ever clipping or needing to scroll.
  const heightCls = constrained ? "min-h-full" : "min-h-dvh";

  if (variant === "light") {
    return (
      <div
        className={cn(
          "pg-shell relative w-full overflow-hidden",
          // The two-column desktop composition below is driven by Tailwind's
          // `lg:` *viewport*-width media query, not this element's own
          // (container) width -- fine for the real full-page guest route,
          // where the two always match, but not for the Portal Preview's
          // `constrained` mockup, which renders this same component inside
          // a much narrower fixed-width "laptop bezel" box while the
          // browser window itself can still be arbitrarily wide. Confirmed
          // live: on a real >=1024px browser window, `lg:grid-cols-
          // [minmax(0,1fr)_480px]` still activated inside that ~700px box,
          // collapsing the `1fr` BrandPanel column down to a sliver and
          // wrapping its heading to one word per line -- exactly the
          // "broken/garbled" preview the founder reported. Skipping the
          // whole `lg:` two-column treatment when constrained keeps this
          // to the single-column composition that already renders
          // correctly below that breakpoint, regardless of the real
          // window's width.
          !constrained && "lg:flex lg:items-center lg:justify-center",
          heightCls,
          highContrast && "contrast-125 saturate-150",
          largeText && "text-[17px]",
        )}
        style={{
          fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",
          background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)",
        }}
      >
        {/* Same organization-uploaded background image the "dark" variant
         * below already renders. Shown at full clarity, not faded --
         * a customer's own uploaded photo/artwork should actually be
         * visible, not washed out to near-invisibility. On viewports much
         * wider than the uploaded image's own resolution this can look
         * soft/stretched -- that's a "upload a higher-resolution image"
         * problem for the customer to fix, not something to paper over
         * with an artificial blur here. */}
        {config?.backgroundImageUrl && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
            />
            {/* A legibility scrim, not a fade -- keeps the image crystal
             * clear through the middle (where the sign-in card already
             * has its own opaque white background) while protecting the
             * logo/heading text at top and the Terms/Privacy footer at
             * bottom, which sit directly on the image with no card
             * behind them. Necessary regardless of how busy or plain the
             * uploaded image is -- a customer's background could be
             * anything from a subtle texture to a dense promotional
             * flyer with its own bold text. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 16%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.65) 100%)",
              }}
            />
          </>
        )}
        <AmbientMesh />

        {/* Below lg:, this fills the viewport edge-to-edge like every
         * phone/tablet captive-portal page should (single column, the
         * `lg:grid` below is a no-op until that breakpoint). At lg:
         * (laptop+) it becomes two columns -- a left context panel plus
         * the actual sign-in content on the right, vertically centered by
         * the parent's `lg:flex lg:items-center lg:justify-center` above
         * -- so a laptop-width viewport gets a considered composition
         * instead of a small card adrift in open gradient space. */}
        <div
          className={cn(
            "relative z-10 mx-auto flex w-full max-w-[420px] flex-col px-4 pb-8 pt-6 sm:max-w-[460px] md:max-w-[520px]",
            // See this component's own top-level comment on `constrained` --
            // these `lg:` classes assume this element's width tracks the
            // real browser viewport, which isn't true inside the Portal
            // Preview's narrower fixed-width mockup.
            !constrained &&
              "lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center lg:gap-16 lg:px-12 lg:py-10 xl:gap-24",
            heightCls,
          )}
        >
          {!constrained && (
            <div className="hidden lg:block">
              <BrandPanel venueName={config?.name} />
            </div>
          )}
          <div
            className={cn(
              "flex w-full flex-col",
              !constrained && "lg:mx-auto lg:w-full lg:max-w-[480px]",
            )}
          >
            <div className="mb-2 flex items-center justify-end gap-1.5">
              <LanguageSwitcher tone="light" />
              <A11yMenu tone="light" />
            </div>
            <motion.main
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={cn("flex flex-1 flex-col", contentClassName)}
            >
              {children}
            </motion.main>
            <footer className="mt-8 flex items-center justify-center gap-2.5 text-center text-[11px]">
              {/* One link, not two -- /portal/terms already covers both
               * Terms of service and Privacy policy as separate sections
               * (config's actual terms_and_conditions_text/url +
               * privacy_policy_text/url, see src/routes/portal.terms.tsx).
               * Two identically-styled links pointing at the exact same
               * page read as a broken/duplicate link, not two real
               * destinations. "Support" has no real guest-facing contact
               * field wired through /captive-portal/resolve today (only
               * an org/location `contactEmail` that's admin-facing, not
               * part of RuntimePortalConfig), so it stays plain text
               * rather than a fabricated mailto/tel link -- visually set
               * apart (no separator, dimmer, non-interactive) so it
               * doesn't read as a third, silently-broken link next to a
               * real one. */}
              <Link
                to="/portal/terms"
                search={portalSearch}
                className="text-slate-400 hover:text-slate-600 hover:underline"
              >
                Terms &amp; Privacy
              </Link>
              <span className="text-slate-300">·</span>
              <span className="text-slate-300">Support: ask venue staff</span>
            </footer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "portal-runtime relative min-h-dvh w-full overflow-hidden text-white",
        highContrast && "contrast-125 saturate-150",
        largeText && "text-[17px]",
      )}
      style={{
        background: config
          ? `linear-gradient(135deg, var(--pr-bg-from), var(--pr-bg-to))`
          : "linear-gradient(135deg,#0F172A,#1E293B)",
      }}
    >
      {config?.backgroundImageUrl && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
          />
          {/* Same legibility scrim as the "light" variant, dark-tinted to
           * match this variant's navy background/white text instead of
           * fading the image itself -- see that one's own comment. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.35) 16%, rgba(15,23,42,0) 34%, rgba(15,23,42,0) 72%, rgba(15,23,42,0.6) 100%)",
            }}
          />
        </>
      )}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-5 sm:max-w-lg">
        {showHeader && (
          <header className="mb-6 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {config?.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12 md:h-14 md:w-14"
                />
              ) : (
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-semibold text-white shadow-lg sm:h-12 sm:w-12 md:h-14 md:w-14"
                  style={{
                    background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))`,
                  }}
                >
                  <Wifi className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{config?.name ?? "ZIP WiFi"}</p>
                <p className="truncate text-[11px] text-white/60">
                  {config?.splashHeadline ?? "Guest WiFi"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <LanguageSwitcher />
              <A11yMenu />
            </div>
          </header>
        )}
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={cn("flex flex-1 flex-col", contentClassName)}
        >
          {children}
        </motion.main>
        {/* Same real footer convention as the light variant (Terms/Privacy
         * link to the real /portal/terms page, "Support" left as plain
         * text -- see that footer's own comment for why) -- this variant
         * used to show a "Powered by CloudGuest · v1.0" line instead, an
         * internal engineering name and a raw version string that never
         * belonged in guest-facing copy and didn't match the rest of the
         * flow. */}
        <footer className="mt-8 flex items-center justify-center gap-2.5 text-center text-[11px]">
          {/* See the light variant's own footer comment -- one merged
           * Terms &amp; Privacy link (same destination either way), Support
           * visually set apart as non-interactive. */}
          <Link
            to="/portal/terms"
            search={portalSearch}
            className="text-white/40 hover:text-white/70 hover:underline"
          >
            Terms &amp; Privacy
          </Link>
          <span className="text-white/25">·</span>
          <span className="text-white/25">Support: ask venue staff</span>
        </footer>
      </div>
    </div>
  );
}

export function PortalCard({
  children,
  className,
  variant = "dark",
}: {
  children: ReactNode;
  className?: string;
  variant?: "dark" | "light";
}) {
  if (variant === "light") {
    return (
      <div
        className={cn("rounded-[24px] border border-indigo-100/80 bg-white p-6", className)}
        style={{
          boxShadow: "0 24px 60px -20px rgba(79,70,229,0.28), 0 8px 24px -10px rgba(15,23,42,0.12)",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-[var(--pr-radius,18px)] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
