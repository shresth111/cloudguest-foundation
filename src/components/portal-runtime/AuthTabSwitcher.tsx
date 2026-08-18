import { Link } from "@tanstack/react-router";
import { ChevronDown, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { UseGuestSignInReturn } from "./useGuestSignIn";

/**
 * v4 §6/§6.9: the auth-method switcher's three tiers of visual weight,
 * now explicit as separate pieces instead of "a pill, plus a collapsed
 * disclosure that silently also has to carry a channel-switch case it
 * was never designed for" (UX v4 §3.5's finding). Rendered in two spots
 * by `GuestSignInCard` -- tiers 1-2 above the active form, tier 3
 * (`AuthMoreOptions`) below it -- matching where each one has always
 * lived, just no longer hand-authored inline.
 *
 * - Tier 1 -- the OTP-vs-*password* pill (`pg-tab-pill`, unchanged
 *   mechanism). Full `pg-body` weight, `--pr-primary`-tinted active
 *   state. Only when a location has both an OTP method and password.
 * - Tier 2 -- the OTP-*channel* switcher (UX v4 §6.7): small icon-tabs at
 *   `pg-meta` weight, visually subordinate to tier 1 and never sharing
 *   its pill treatment -- deliberately, so it never implies a false
 *   parity between "channel" and "method". Only when there's no tier-1
 *   pill to begin with (no password) and 2+ OTP channels are enabled.
 * - Tier 3 -- the collapsed `<details>` disclosure (voucher, and any
 *   channel *not* already visible via tier 2). `pg-meta`/`--pg-ink-muted`,
 *   closed by default, unchanged from before.
 */
export function AuthTabSwitcher(sign: UseGuestSignInReturn) {
  const { t } = usePortalRuntime();

  return (
    <>
      {sign.showTabs && (
        // CSS-only sliding pill: there are always exactly 2 tabs in this
        // fixed 2-column grid, so no framer-motion `layoutId`
        // shared-element measurement is needed -- `.pg-tab-pill`
        // (styles.css) is a single absolutely positioned pill sized to
        // one grid cell, sliding via `transform` driven by this
        // container's own `data-active-tab` attribute.
        <div
          role="tablist"
          aria-label="Sign-in method"
          data-active-tab={sign.tab}
          className="relative mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-indigo-50 p-1 ring-1 ring-inset ring-indigo-100"
        >
          <span
            aria-hidden
            className="pg-tab-pill absolute bottom-1 left-1 top-1 w-[calc(50%-6px)] rounded-[14px] bg-white shadow-[0_1px_2px_rgba(17,20,40,0.06),0_6px_16px_-8px_rgba(49,46,129,0.35)]"
          />
          {[
            { id: "otp" as const, label: sign.otpTabLabel },
            { id: "password" as const, label: t("haveAPassword") },
          ].map((item) => {
            const active = sign.tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => sign.setTab(item.id)}
                className="relative z-10 min-h-[52px] rounded-[14px] px-2 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-50"
              >
                <span
                  className={cn(
                    "block pg-body leading-tight",
                    active ? "text-indigo-700" : "text-slate-500",
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {sign.tab === "otp" && sign.showChannelSwitcher && (
        // Tier 2 -- small icon-tabs, `pg-meta` weight, no pill/background
        // treatment of its own so it reads as clearly subordinate to a
        // real tier-1 pill on screens that have one, and never looks like
        // a second competing "choose your method" control.
        <div
          role="tablist"
          aria-label={t("switchOtpChannel")}
          className="mb-3.5 flex items-center justify-center gap-1.5"
        >
          {sign.enabledOtpChannels.map(({ channel, label, icon: Icon, active }) => (
            <button
              key={channel}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => sign.onSwitchOtpChannel(channel)}
              title={label}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 pg-meta transition-colors",
                active
                  ? "border-[var(--pr-primary,#6366f1)]/30 bg-[var(--pr-primary,#6366f1)]/10 text-[var(--pr-primary,#6366f1)]"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Tier 3 (the collapsed disclosure) plus the voucher-only fallback --
 * both belong *below* the active form, not above it like tiers 1-2, so
 * this is a separate component `GuestSignInCard` renders at the end of
 * its card rather than a second concern folded into `AuthTabSwitcher`. */
export function AuthMoreOptions(sign: UseGuestSignInReturn) {
  const { t } = usePortalRuntime();
  return (
    <>
      {!sign.hasOtp && !sign.hasPassword && sign.hasVoucher && (
        <p className="py-2 text-center text-xs text-slate-500">
          {t("voucherFallbackPrefix")}{" "}
          <Link
            to="/portal/auth/$method"
            params={{ method: "voucher" }}
            search={sign.portalSearch}
            className="font-medium text-indigo-600 hover:underline"
          >
            {t("redeemVoucherLink")}
          </Link>
          .
        </p>
      )}

      {sign.hasMoreSignInOptions && (
        // Native <details>, not JS state, so the expand/collapse itself
        // costs nothing extra. Collapsed by default.
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1 pg-meta text-[var(--pg-ink-muted)] hover:text-indigo-600 [&::-webkit-details-marker]:hidden">
            {t("otherWaysToSignIn")}
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            {sign.otherMethodLinks.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={l.onClick}
                className="inline-flex items-center gap-1.5 pg-meta text-[var(--pg-ink-muted)] hover:text-indigo-600 hover:underline"
              >
                <l.icon className="h-3.5 w-3.5" /> {l.label}
              </button>
            ))}
            {sign.showVoucherFallback && (
              <Link
                to="/portal/auth/$method"
                params={{ method: "voucher" }}
                search={sign.portalSearch}
                className="inline-flex items-center gap-1.5 pg-meta text-[var(--pg-ink-muted)] hover:text-indigo-600 hover:underline"
              >
                <Ticket className="h-3.5 w-3.5" /> {t("haveVoucherUseInstead")}
              </Link>
            )}
          </div>
        </details>
      )}
    </>
  );
}
