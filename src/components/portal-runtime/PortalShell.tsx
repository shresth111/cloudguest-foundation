import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { A11yMenu } from "./A11yMenu";

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
  const heightCls = constrained ? "h-full" : "min-h-dvh";

  if (variant === "light") {
    return (
      <div
        className={cn(
          "pg-shell relative w-full overflow-hidden",
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
         * below already renders -- this branch never referenced
         * `config.backgroundImageUrl` at all, so a customer's uploaded
         * image never appeared on the welcome/success/expired/set-password
         * screens guests actually land on. Kept faint (12%, vs. dark's
         * 30%) so the white card and its text stay legible against a
         * light background. */}
        {config?.backgroundImageUrl && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
          />
        )}
        <div
          aria-hidden
          className="pg-glow-1 pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-60 blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--pr-primary, #6366f1) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pg-glow-2 pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full opacity-50 blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--pr-accent, #4f46e5) 0%, transparent 70%)",
          }}
        />

        <div className={cn("relative z-10 mx-auto flex w-full max-w-[420px] flex-col px-4 pb-8 pt-6 sm:max-w-[460px] md:max-w-[520px]", heightCls)}>
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
          <footer className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-slate-400">
            {/* Both link to the real /portal/terms page (config's actual
             * terms_and_conditions_text/url + privacy_policy_text/url --
             * see src/routes/portal.terms.tsx). "Support" has no real
             * guest-facing contact field wired through
             * /captive-portal/resolve today (only an org/location
             * `contactEmail` that's admin-facing, not part of
             * RuntimePortalConfig), so it's left as plain text rather
             * than a fabricated mailto/tel link -- see this session's own
             * report for the honest call-out. */}
            <Link
              to="/portal/terms"
              search={portalSearch}
              className="hover:text-slate-600 hover:underline"
            >
              Terms
            </Link>
            <span>·</span>
            <Link
              to="/portal/terms"
              search={portalSearch}
              className="hover:text-slate-600 hover:underline"
            >
              Privacy
            </Link>
            <span>·</span>
            <span>Support: ask venue staff</span>
          </footer>
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
        />
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
        <footer className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-white/40">
          <Link to="/portal/terms" search={portalSearch} className="hover:text-white/70 hover:underline">
            Terms
          </Link>
          <span>·</span>
          <Link to="/portal/terms" search={portalSearch} className="hover:text-white/70 hover:underline">
            Privacy
          </Link>
          <span>·</span>
          <span>Support: ask venue staff</span>
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
