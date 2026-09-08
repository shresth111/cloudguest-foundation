import { useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PG_INPUT, PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { PG_FIELD_LABEL } from "@/components/portal-runtime/AuthFields";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import { buildDemoSession } from "@/lib/portal-demo";
import type { AppError } from "@/services/api";
import type { RuntimeSession } from "@/types/portal-runtime";

/**
 * The voucher redemption form.
 *
 * Own module (not a sibling export of AuthMethodForms.tsx) so the real
 * guest welcome surface can pull it in lazily: AuthMethodForms carries
 * react-hook-form + zod for its legacy per-method forms, and the only
 * consumer of THIS form on the welcome card is the demo walkthrough --
 * real guests reach voucher via the separate /portal/auth/voucher route.
 * Static-importing it into GuestSignInCard put RHF/zod in the pre-auth
 * welcome bundle; splitting it out lets that surface load them only when
 * a demo actually opens the voucher step.
 */
const voucherLoginSchema = z.object({
  identifier: z.string().min(3, "Enter your phone number or email"),
  code: z.string().min(1, "Enter your voucher code"),
});
export function VoucherForm({
  organizationId,
  locationId,
  routerId,
  onLoggedIn,
}: {
  organizationId: string;
  locationId: string;
  routerId: string;
  onLoggedIn: (session: RuntimeSession) => void;
}) {
  const { t, setGuestIdentifier, deviceMac, deviceIp, previewMode, demoMode } = usePortalRuntime();
  const form = useForm<z.infer<typeof voucherLoginSchema>>({
    resolver: zodResolver(voucherLoginSchema),
    defaultValues: { identifier: "", code: "" },
  });
  const login = useMutation({
    mutationFn: (v: z.infer<typeof voucherLoginSchema>) =>
      portalRuntimeService.loginWithVoucher({
        identifier: v.identifier,
        code: v.code,
        organizationId,
        locationId,
        routerId,
        deviceMac,
        deviceIp,
      }),
    onSuccess: (session, variables) => {
      // See PortalRuntimeState.guestIdentifier's docstring -- the NAS's
      // own RADIUS Authorize checks this exact value, not a hardcoded one.
      setGuestIdentifier(variables.identifier.trim());
      onLoggedIn(session);
    },
    onError: (e: AppError) => toast.error(friendlyGuestAuthError(e, "voucher")),
  });

  /**
   * THE ONE `loginWithVoucher` CALL SITE, AND ITS SIMULATED-SURFACE BRANCH.
   *
   * Voucher is the only sign-in method whose submit does not live in
   * `useGuestSignIn`, so it never inherited that hook's `demoMode`/
   * `previewMode` short-circuits -- which is why a voucher-only venue had
   * no runnable guest walkthrough at all: the walkthrough's very first
   * step was its last one. The branch below is the exact shape
   * `useGuestSignIn` already uses for OTP and password (see its
   * `onVerifyOtp`/`onSignInPassword`), applied at the only place that can
   * reach the voucher mutation:
   *
   *   - `demoMode` (the guest walkthrough / demo portal) runs the DUMMY
   *     flow: ANY code the operator types is accepted -- exactly as any
   *     6-digit code is accepted for the demo OTP -- and the screen moves
   *     on from a fake in-memory `buildDemoSession`. Nothing is validated,
   *     nothing is redeemed, and NO voucher row is touched, because the
   *     mutation is never reached. The screen that renders this form says
   *     so in as many words (see `GuestSignInCard`'s voucher demo step);
   *     this branch must never be made to look like a real redemption.
   *   - `previewMode` (the static Portal Preview) toasts, the same as
   *     every other sign-in action on that surface. Nothing renders this
   *     form under `previewMode` today -- the affordance there is inert
   *     (see `AuthTabSwitcher`'s `VoucherAffordance`) -- so this arm is
   *     belt-and-braces: the "no real login from a simulated surface"
   *     invariant is enforced HERE, at the call site, rather than resting
   *     on every future caller remembering it.
   *
   * ORDER MATTERS and matches `useGuestSignIn` exactly: `demoMode` first
   * (a working dummy flow), `previewMode` second (a toast). Both flags are
   * false for a real guest, so the real path below is byte-for-byte the
   * `login.mutate(v)` it has always been -- zod validation still runs
   * first, unchanged, for every surface.
   */
  const onSubmit = (v: z.infer<typeof voucherLoginSchema>) => {
    if (demoMode) {
      // Mirrors the real `onSuccess` above so the walkthrough's connected
      // screen shows what a real one would -- minus the network, minus the
      // session row. `setGuestIdentifier` is this tab's own sessionStorage
      // and nothing else (`DemoPortalFlow` clears it on mount AND unmount).
      setGuestIdentifier(v.identifier.trim());
      onLoggedIn(buildDemoSession(v.identifier.trim(), "voucher"));
      return;
    }
    if (previewMode) {
      toast.info("Preview mode — connect a real device to test sign-in.");
      return;
    }
    login.mutate(v);
  };

  // v7 §7.2 -- see PasswordForm above.
  const fieldId = useId();
  const identifierId = `${fieldId}-identifier`;
  const codeId = `${fieldId}-code`;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Label htmlFor={identifierId} className={PG_FIELD_LABEL}>
        {t("mobileOrEmailLabel")}
      </Label>
      <Input
        id={identifierId}
        {...form.register("identifier")}
        autoComplete="username"
        placeholder="you@example.com or +1 555 010 2200"
        className={PG_INPUT}
      />
      {form.formState.errors.identifier && (
        <p role="alert" className="pg-meta text-[var(--pg-danger,#DC2626)]">
          {form.formState.errors.identifier.message}
        </p>
      )}
      <Label htmlFor={codeId} className={PG_FIELD_LABEL}>
        {t("voucherCode")}
      </Label>
      <Input
        id={codeId}
        {...form.register("code")}
        autoComplete="off"
        placeholder="ABCD-1234"
        className={`${PG_INPUT} uppercase`}
      />
      {form.formState.errors.code && (
        <p role="alert" className="pg-meta text-[var(--pg-danger,#DC2626)]">
          {form.formState.errors.code.message}
        </p>
      )}
      <button type="submit" disabled={login.isPending} className={PG_PRIMARY_BTN}>
        {login.isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
