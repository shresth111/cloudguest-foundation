import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PortalShell, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN, PG_SECONDARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { GlyphExpired } from "@/components/portal-runtime/PortalGlyphs";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { enabledAuthMethods } from "@/lib/portal-auth-methods";

export const Route = createFileRoute("/portal/expired")({
  component: ExpiredPage,
});

/**
 * Reached either by a real guest-initiated disconnect (success screen's
 * Disconnect button) or by the real, honest client-side expiry check on
 * the success screen (its own real `session_timeout_minutes` countdown
 * hitting zero -- see src/routes/portal.success.tsx). "Sign in again"
 * defaults to the password tab, "Use OTP instead" switches to the OTP
 * tab -- both by setting the same real `selectedMethod` context field
 * GuestSignInCard already reads to pick its initial tab, then navigating
 * back to the one real sign-in card (no separate expired-specific form).
 */
function ExpiredPage() {
  const { t, config, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/expired" });

  const methods = config ? enabledAuthMethods(config) : [];
  const hasPassword = methods.includes("username_password");
  const hasOtp = methods.includes("otp_sms") || methods.includes("otp_email");
  const preferredOtp = methods.includes("otp_sms") ? "otp_sms" : "otp_email";

  const goSignIn = (method: "username_password" | "otp_sms" | "otp_email") => {
    setSelectedMethod(method);
    navigate({ to: "/portal/welcome", search: (prev) => prev });
  };

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1). The plate is
         * `PortalTextPlate` -- the one seam that owns "is there a photo",
         * the bounded `w-fit` sizing that is deliberately NOT a wash over
         * the whole content column (§0.1 item 1's twice-shipped mistake),
         * and §1.4 C5's refusal rule. Its own doc comment carries the
         * reasoning this used to copy per route.
         *
         * The wrapper `<div>` is this route's layout box, not the plate,
         * and has to stay: with no photo the plate renders its children
         * bare, so without this box they would drop straight into the
         * column's `gap-5` and lose `text-center`. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            {/* Amber stays: it is the one semantic "caution, not error"
             * hue on this surface. amber-500 -> amber-600 lifts the 40px
             * glyph from 2.85:1 to 3.9:1 on white (SC 1.4.11's 3:1
             * non-text floor). GlyphExpired is the brand set's hourglass. */}
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-50 text-amber-600">
              <GlyphExpired className="h-8 w-8" />
            </div>
            <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("sessionExpired")}</h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1 pg-meta text-[var(--pg-ink-muted)]">{t("expiredSubtitle")}</p>
            {/* Was a whole PortalCard whose entire content was this one
             * grey sentence -- 68px of opaque surface on a short viewport
             * for a helper line. Folded into the plate (both lines now sit
             * on the same composited backing the alpha floors guarantee),
             * which also uncovers more of the venue photo -- the opposite
             * of the twice-reverted column wash (§0.1 item 1). */}
            <p className="mt-3 pg-meta text-[var(--pg-ink-faint)]">{t("expiredHelp")}</p>
          </PortalTextPlate>
        </div>
        <div className="flex flex-col gap-2.5">
          {hasPassword && (
            <button
              type="button"
              onClick={() => goSignIn("username_password")}
              className={PG_PRIMARY_BTN}
            >
              {t("signInAgainLink")}
            </button>
          )}
          {hasOtp && (
            <button
              type="button"
              onClick={() => goSignIn(preferredOtp)}
              className={hasPassword ? PG_SECONDARY_BTN : PG_PRIMARY_BTN}
            >
              {t("useOtpInsteadLabel")}
            </button>
          )}
          {!hasPassword && !hasOtp && (
            <button
              type="button"
              onClick={() => navigate({ to: "/portal/welcome", search: (prev) => prev })}
              className={PG_PRIMARY_BTN}
            >
              {t("reconnect")}
            </button>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
