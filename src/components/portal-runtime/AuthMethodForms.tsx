import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import { buildDemoSession } from "@/lib/portal-demo";
import {
  defaultCountryCode,
  nationalNumberMaxLength,
  normalizeNationalPhone,
} from "@/lib/portal-locale";
import { PG_INPUT, PG_PRIMARY_BTN } from "./PortalGuestUi";
import { PhoneNumberFields, EmailField, PG_FIELD_LABEL } from "./AuthFields";
import type { RuntimeAuthMethod, RuntimeSession } from "@/types/portal-runtime";
import type { AppError } from "@/services/api";

/**
 * The five sign-in forms (mobile OTP request, email OTP request, WhatsApp
 * OTP request, saved password, voucher redeem) -- the real fields a guest
 * fills in, shared by both the single-page guest flow
 * (src/routes/portal.welcome.tsx, the page a guest actually lands on) and
 * the deep-linkable per-method route (src/routes/portal.auth.$method.tsx,
 * kept for direct/bookmarked links) so the two can never drift into
 * different field sets or validation for the same method.
 *
 * v4 §6.8: `MobileForm`/`WhatsAppForm`/`EmailForm`'s actual phone/email
 * inputs now render `AuthFields.tsx`'s shared `PhoneNumberFields`/
 * `EmailField` -- the exact same pieces `GuestSignInCard`'s `OtpForm`
 * uses for the real, primary sign-in path -- instead of a second
 * hand-authored copy of the same JSX (UX v4 §3.2/§3.8's audit finding).
 * `PasswordForm`/`VoucherForm` are unchanged -- v4 §6.8 only asked for
 * the phone/email/code fields to stop being duplicated.
 *
 * `VoucherForm` has a THIRD caller now: `GuestSignInCard` renders it
 * inline, without navigating, when the guest walkthrough (`demoMode`) is
 * running -- see that file's voucher demo step and this form's own
 * `onSubmit`. The route above is untouched by that, and so is what a real
 * guest sees on it.
 */

type PhoneFormProps = {
  organizationId: string;
  locationId: string;
  onSent: (target: string) => void;
};

function usePhoneOtpForm(
  channel: "sms" | "whatsapp",
  { organizationId, locationId, onSent }: PhoneFormProps,
) {
  const { config, t } = usePortalRuntime();
  // v7 §8.1, same change as the primary path (see useGuestSignIn.ts): the
  // dialling code is a fixed prefix derived from the venue's own
  // `location_country`, not a second editable box, so there is no state to
  // hold for it.
  const dialCode = defaultCountryCode(config?.defaultLanguage, config?.locationCountry);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (identifier: string) =>
      portalRuntimeService.requestOtp({ identifier, channel, organizationId, locationId }),
    onSuccess: (_r, identifier) => {
      toast.success("Code sent");
      onSent(identifier);
    },
    onError: (e: AppError) => toast.error(friendlyGuestAuthError(e, "otp_request")),
  });
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const national = normalizeNationalPhone(phone, dialCode);
    const expected = nationalNumberMaxLength(dialCode);
    const ok = expected === 15 ? national.length >= 6 : national.length === expected;
    if (!ok) {
      // Keyed (errValidMobile/errValidWhatsapp existed unused): inline
      // field errors were the last hardcoded-English strings here.
      setError(t(channel === "whatsapp" ? "errValidWhatsapp" : "errValidMobile"));
      return;
    }
    setError(null);
    send.mutate(dialCode + national);
  };
  return { dialCode, phone, setPhone, error, send, onSubmit };
}

export function MobileForm(props: PhoneFormProps) {
  const { t } = usePortalRuntime();
  const f = usePhoneOtpForm("sms", props);
  return (
    <form onSubmit={f.onSubmit} className="space-y-3">
      {/* v7 §7.2: the bare `<Label>` here carried no `htmlFor`, so it named
       * nothing. The name now goes *into* the field component, which owns
       * the `htmlFor`/`id` pairing. */}
      <PhoneNumberFields
        label={t("mobileNumber")}
        hint={t("whyWeAskMobile")}
        dialCode={f.dialCode}
        phone={f.phone}
        onPhoneChange={f.setPhone}
      />
      {f.error && (
        <p role="alert" className="pg-meta text-[var(--pg-danger,#DC2626)]">
          {f.error}
        </p>
      )}
      <button type="submit" disabled={f.send.isPending} className={PG_PRIMARY_BTN}>
        {f.send.isPending ? t("sendingLabel") : t("sendOtp")}
      </button>
    </form>
  );
}

export function WhatsAppForm(props: PhoneFormProps) {
  const { t } = usePortalRuntime();
  const f = usePhoneOtpForm("whatsapp", props);
  return (
    <form onSubmit={f.onSubmit} className="space-y-3">
      {/* v7 §7.2: the bare `<Label>` here carried no `htmlFor`, so it named
       * nothing. The name now goes *into* the field component, which owns
       * the `htmlFor`/`id` pairing. */}
      <PhoneNumberFields
        label={t("whatsappNumberLabel")}
        hint={t("whyWeAskWhatsapp")}
        dialCode={f.dialCode}
        phone={f.phone}
        onPhoneChange={f.setPhone}
      />
      {f.error && (
        <p role="alert" className="pg-meta text-[var(--pg-danger,#DC2626)]">
          {f.error}
        </p>
      )}
      <button type="submit" disabled={f.send.isPending} className={PG_PRIMARY_BTN}>
        {f.send.isPending ? t("sendingLabel") : t("sendOtp")}
      </button>
    </form>
  );
}

export function EmailForm({ organizationId, locationId, onSent }: PhoneFormProps) {
  const { t } = usePortalRuntime();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (identifier: string) =>
      portalRuntimeService.requestOtp({ identifier, channel: "email", organizationId, locationId }),
    onSuccess: (_r, identifier) => {
      toast.success("Code sent");
      onSent(identifier);
    },
    onError: (e: AppError) => toast.error(friendlyGuestAuthError(e, "otp_request")),
  });
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email.trim())) {
      setError(t("errValidEmail"));
      return;
    }
    setError(null);
    send.mutate(email.trim());
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <EmailField label={t("emailAddress")} email={email} onEmailChange={setEmail} />
      {error && (
        <p role="alert" className="pg-meta text-[var(--pg-danger,#DC2626)]">
          {error}
        </p>
      )}
      <button type="submit" disabled={send.isPending} className={PG_PRIMARY_BTN}>
        {send.isPending ? t("sendingLabel") : t("sendOtp")}
      </button>
    </form>
  );
}

const passwordLoginSchema = z.object({
  identifier: z.string().min(3, "Enter your phone number or email"),
  password: z.string().min(1, "Enter your password"),
});
export function PasswordForm({
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
  const { t, setGuestIdentifier, deviceMac, deviceIp } = usePortalRuntime();
  const form = useForm<z.infer<typeof passwordLoginSchema>>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const login = useMutation({
    mutationFn: (v: z.infer<typeof passwordLoginSchema>) =>
      portalRuntimeService.loginWithPassword({
        identifier: v.identifier,
        password: v.password,
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
    // The backend deliberately returns one generic message for "wrong
    // password", "no such guest", and "guest exists but never set a
    // password" -- see GuestPasswordLoginFailedError's own docstring, and
    // never a distinguishable one (avoids leaking account existence) --
    // so this page can't auto-detect "you're new, here's OTP instead" and
    // just relies on the method switcher above the form instead.
    onError: (e: AppError) => toast.error(friendlyGuestAuthError(e, "password")),
  });

  // v7 §7.2 -- these `<Label>`s had no `htmlFor` and these `<Input>`s had
  // no `id`, so the labels named nothing. `react-hook-form`'s `register()`
  // supplies `name`, never `id`, so the pairing has to be explicit.
  const fieldId = useId();
  const identifierId = `${fieldId}-identifier`;
  const passwordId = `${fieldId}-password`;
  return (
    <form onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-3">
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
      <Label htmlFor={passwordId} className={PG_FIELD_LABEL}>
        {t("password")}
      </Label>
      <Input
        id={passwordId}
        {...form.register("password")}
        type="password"
        autoComplete="current-password"
        placeholder="••••••••••••"
        className={PG_INPUT}
      />
      {form.formState.errors.password && (
        <p role="alert" className="pg-meta text-[var(--pg-danger,#DC2626)]">
          {form.formState.errors.password.message}
        </p>
      )}
      <button type="submit" disabled={login.isPending} className={PG_PRIMARY_BTN}>
        {login.isPending ? t("signingInLabel") : t("signIn")}
      </button>
    </form>
  );
}

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
