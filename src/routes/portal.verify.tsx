import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalShell,
  PortalCard,
  GUEST_LEGIBILITY_CARD_CLASS,
  PortalTextPlate,
} from "@/components/portal-runtime/PortalShell";
import { AlertBanner, PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { OtpCodeInput } from "@/components/portal-runtime/AuthFields";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { scriptClassOf } from "@/lib/portal-script";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import { useOtpResendCooldown } from "@/lib/portal-otp-cooldown";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/verify")({
  component: VerifyPage,
});

/**
 * The deep-linkable per-method OTP verify step -- GuestSignInCard's own
 * inline OTP tab is the real path almost every guest takes today (see its
 * own docstring), so this only fires for a bookmarked/direct link into the
 * older per-method flow (portal.auth.$method.tsx's Mobile/Email/WhatsApp
 * forms navigate here after sending a code). Same light shell/card/OTP-
 * slot/button language as the rest of the redesigned flow now -- previously
 * still the old dark shell, the class of leftover page portal.terms.tsx's
 * own comment describes.
 */
function VerifyPage() {
  const {
    t,
    otpTarget,
    selectedMethod,
    organizationId,
    locationId,
    routerId,
    deviceMac,
    deviceIp,
    config,
    setSession,
    setGuestIdentifier,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/verify" });
  const hasPhoto = !!config?.backgroundImageUrl;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // v4 UX §6.4: was a fixed 60-second client-side countdown regardless of
  // server truth -- the same server-driven cooldown GuestSignInCard's own
  // inline OTP flow uses (see this hook's own docstring for the full
  // "why"). Starts at 0 (a guest can resend immediately) exactly like the
  // inline flow, and only gets a real cooldown once the server 429s.
  const { cooldown, applyServerCooldown, resetCooldown } = useOtpResendCooldown();

  const requiresTerms = !!(
    config?.termsAndConditionsText ||
    config?.termsAndConditionsUrl ||
    config?.privacyPolicyText ||
    config?.privacyPolicyUrl
  );

  useEffect(() => {
    if (!otpTarget || !selectedMethod)
      navigate({ to: "/portal/auth", replace: true, search: (prev) => prev });
  }, [otpTarget, selectedMethod, navigate]);

  const login = useMutation({
    mutationFn: (c: string) =>
      portalRuntimeService.loginWithOtp({
        identifier: otpTarget ?? "",
        code: c,
        authMethod: selectedMethod ?? "otp_sms",
        organizationId,
        locationId,
        routerId,
        deviceMac,
        deviceIp,
      }),
    onSuccess: async (session) => {
      setError(null);
      toast.success("Verified");
      setSession(session);
      // See PortalRuntimeState.guestIdentifier's docstring -- the NAS's
      // own RADIUS Authorize checks this exact value, not a hardcoded one.
      setGuestIdentifier(otpTarget?.trim());
      // Consent is now implied by continuing (no checkbox) whenever there
      // is real terms/privacy content to consent to -- see requiresTerms.
      if (requiresTerms) {
        portalRuntimeService
          .recordConsent({ guestId: session.guestId, captivePortalConfigId: config?.id })
          .catch(() => undefined);
      }
      // First (or any) OTP-verified login by a guest who hasn't set a
      // password yet, on a portal that offers password login at all --
      // offer the skippable "save a password for next time?" prompt before
      // continuing on to the success screen. A password login itself
      // never reaches here (see portal.auth.$method.tsx's own onLoggedIn),
      // so this can only ever fire right after a real OTP verification.
      const offerPasswordSetup = config?.usernamePasswordEnabled && !session.hasPassword;
      navigate({
        to: offerPasswordSetup ? "/portal/set-password" : "/portal/success",
        search: (prev) => prev,
      });
    },
    onError: (e: AppError) => setError(friendlyGuestAuthError(e, "otp_verify")),
  });

  const resend = useMutation({
    mutationFn: () =>
      portalRuntimeService.requestOtp({
        identifier: otpTarget ?? "",
        channel: selectedMethod === "otp_email" ? "email" : "sms",
        organizationId,
        locationId,
      }),
    onSuccess: () => {
      toast.success("New code sent");
      resetCooldown();
    },
    onError: (e: AppError) => {
      applyServerCooldown(e);
      toast.error(friendlyGuestAuthError(e, "otp_request"));
    },
  });

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        {/* Same §1.1 L1 problem, same bounded fix, pill-shaped because this
         * one is a single short line: this back link was `text-slate-500`
         * set directly on the photo with nothing behind it. `w-fit` was
         * already on it, so the plate hugs the label with no layout
         * change; the colour moves to `--pg-ink-muted` for the same
         * reason the subtitles below do.
         *
         * Deliberately NOT `PortalTextPlate shape="pill"`, which is
         * otherwise exactly this shape. That component *wraps* its children
         * in the plate `<div>`, and here the plate classes are on the
         * anchor itself: wrapping would move the pill's padding off the
         * link, shrinking the tap target from the padded pill to the bare
         * ~20px text box, and its hardcoded `mx-auto` would re-centre a
         * link that is deliberately start-aligned. Decorating the
         * interactive element instead of wrapping it is a mode the
         * component does not have, and adding one is out of scope here --
         * so this stays hand-written rather than being fought into shape
         * with `mx-0` overrides and a worse hit area. */}
        <Link
          to="/portal/auth"
          from="/portal/verify"
          search={(prev) => prev}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 pg-meta font-medium text-[var(--pg-ink-muted)] hover:text-[var(--pr-primary,#6366f1)]",
            hasPhoto && cn(GUEST_LEGIBILITY_CARD_CLASS, "rounded-full px-3.5 py-1.5"),
          )}
        >
          <ArrowLeft className="h-4 w-4" /> {t("changeNumber")}
        </Link>
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
            <h1
              className="pg-subtitle text-[var(--pg-ink)]"
              data-pg-script={scriptClassOf(t("verifyTitle"))}
            >
              {t("verifyTitle")}
            </h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1.5 pg-meta text-[var(--pg-ink-muted)]">
              {t("sentCodeToPrefix")}{" "}
              <span className="font-semibold text-[var(--pg-ink)]">{otpTarget}</span>
            </p>
          </PortalTextPlate>
        </div>
        <PortalCard>
          {/* A real <form>, mirroring OtpForm on the primary path: the
           * phone keyboard's "Go"/"Done" key only submits a form, and this
           * page's actions were bare onClick buttons -- the exact defect
           * OtpForm already fixed. Presentation-level only: the submit
           * guard is the same condition set the old button's `disabled`
           * enforced, and the mutation call is unchanged. */}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length !== 6 || login.isPending) return;
              login.mutate(code);
            }}
            className="space-y-4"
          >
            {/* v7 §7.2: `autoComplete` is a required, literal-typed prop --
             * SC 3.3.8 (AA) is not left resting on the `input-otp`
             * dependency's internal default. */}
            <OtpCodeInput value={code} onChange={setCode} autoFocus autoComplete="one-time-code" />

            <AlertBanner message={error} />

            <button
              type="submit"
              disabled={code.length !== 6 || login.isPending}
              className={PG_PRIMARY_BTN}
            >
              {login.isPending ? t("verifyingLabel") : t("verifyOtpConnect")}
            </button>
            {/* Consent is now implied by continuing -- no checkbox, matching
             * the reference design's "By clicking Continue, you agree
             * to..." pattern. Same legal text as before (reused verbatim). */}
            {requiresTerms && (
              <p className="text-center pg-meta font-medium text-[var(--pg-ink-muted)]">
                {t("agreeTerms")}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 pg-meta">
              {cooldown > 0 ? (
                <span className="font-normal text-[var(--pg-ink-faint)]">
                  {t("resendAvailableInTemplate").replace("{n}", String(cooldown))}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => resend.mutate()}
                  disabled={resend.isPending}
                  className="inline-flex min-h-6 items-center px-2 py-1 font-medium text-[var(--pr-primary,#6366f1)] underline-offset-2 hover:underline"
                >
                  {t("resend")}
                </button>
              )}
            </div>
          </form>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
