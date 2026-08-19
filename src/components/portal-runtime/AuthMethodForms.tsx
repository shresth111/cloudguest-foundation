import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Smartphone, Mail, KeyRound, Ticket, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import { defaultCountryCode } from "@/lib/portal-locale";
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
 */

export const METHOD_META: Record<
  RuntimeAuthMethod,
  { icon: React.ComponentType<{ className?: string }>; labelKey: string; desc: string }
> = {
  otp_sms: { icon: Smartphone, labelKey: "mobileOtp", desc: "Receive a code by SMS" },
  otp_email: { icon: Mail, labelKey: "emailOtp", desc: "Receive a code by email" },
  otp_whatsapp: {
    icon: MessageCircle,
    labelKey: "whatsappOtp",
    desc: "Receive a code via WhatsApp",
  },
  username_password: {
    icon: KeyRound,
    labelKey: "passwordLogin",
    desc: "Sign in with your saved password",
  },
  voucher: { icon: Ticket, labelKey: "voucherCode", desc: "Redeem a voucher code" },
};

type PhoneFormProps = {
  organizationId: string;
  locationId: string;
  onSent: (target: string) => void;
};

function usePhoneOtpForm(
  channel: "sms" | "whatsapp",
  { organizationId, locationId, onSent }: PhoneFormProps,
) {
  const { config } = usePortalRuntime();
  const [countryCode, setCountryCode] = useState(() => defaultCountryCode(config?.defaultLanguage));
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
    const identifier = countryCode + phone;
    if (phone.trim().replace(/\D/g, "").length < 6) {
      setError("Enter a valid number");
      return;
    }
    setError(null);
    send.mutate(identifier);
  };
  return { countryCode, setCountryCode, phone, setPhone, error, send, onSubmit };
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
        countryCode={f.countryCode}
        onCountryCodeChange={f.setCountryCode}
        phone={f.phone}
        onPhoneChange={f.setPhone}
      />
      {f.error && <p className="text-xs text-red-600">{f.error}</p>}
      <button type="submit" disabled={f.send.isPending} className={PG_PRIMARY_BTN}>
        {f.send.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("sendOtp")}
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
        label={t("mobileNumber")}
        countryCode={f.countryCode}
        onCountryCodeChange={f.setCountryCode}
        phone={f.phone}
        onPhoneChange={f.setPhone}
      />
      {f.error && <p className="text-xs text-red-600">{f.error}</p>}
      <button type="submit" disabled={f.send.isPending} className={PG_PRIMARY_BTN}>
        {f.send.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("sendOtp")}
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
      setError("Enter a valid email");
      return;
    }
    setError(null);
    send.mutate(email.trim());
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <EmailField label={t("emailAddress")} email={email} onEmailChange={setEmail} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={send.isPending} className={PG_PRIMARY_BTN}>
        {send.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("sendOtp")}
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
        <p className="text-xs text-red-600">{form.formState.errors.identifier.message}</p>
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
        <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
      )}
      <button type="submit" disabled={login.isPending} className={PG_PRIMARY_BTN}>
        {login.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("signIn")}
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
  const { t, setGuestIdentifier, deviceMac, deviceIp } = usePortalRuntime();
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
  // v7 §7.2 -- see PasswordForm above.
  const fieldId = useId();
  const identifierId = `${fieldId}-identifier`;
  const codeId = `${fieldId}-code`;
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
        <p className="text-xs text-red-600">{form.formState.errors.identifier.message}</p>
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
        <p className="text-xs text-red-600">{form.formState.errors.code.message}</p>
      )}
      <button type="submit" disabled={login.isPending} className={PG_PRIMARY_BTN}>
        {login.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("submit")}
      </button>
    </form>
  );
}
