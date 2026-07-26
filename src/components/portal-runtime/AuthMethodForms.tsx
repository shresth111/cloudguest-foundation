import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Smartphone, Mail, KeyRound, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { RuntimeAuthMethod, RuntimeSession } from "@/types/portal-runtime";
import type { AppError } from "@/services/api";

/**
 * The four sign-in forms (mobile OTP request, email OTP request, saved
 * password, voucher redeem) -- the real fields a guest fills in, shared by
 * both the single-page guest flow (src/routes/portal.welcome.tsx, the page
 * a guest actually lands on) and the deep-linkable per-method route
 * (src/routes/portal.auth.$method.tsx, kept for direct/bookmarked links)
 * so the two can never drift into different field sets or validation for
 * the same method.
 */

export const METHOD_META: Record<
  RuntimeAuthMethod,
  { icon: React.ComponentType<{ className?: string }>; labelKey: string; desc: string }
> = {
  otp_sms: { icon: Smartphone, labelKey: "mobileOtp", desc: "Receive a code by SMS" },
  otp_email: { icon: Mail, labelKey: "emailOtp", desc: "Receive a code by email" },
  username_password: {
    icon: KeyRound,
    labelKey: "passwordLogin",
    desc: "Sign in with your saved password",
  },
  voucher: { icon: Ticket, labelKey: "voucherCode", desc: "Redeem a voucher code" },
};

const mobileSchema = z.object({
  countryCode: z.string().min(1, "Required"),
  phone: z.string().min(6, "Enter a valid number"),
});
export function MobileForm({
  organizationId,
  locationId,
  onSent,
}: {
  organizationId: string;
  locationId: string;
  onSent: (target: string) => void;
}) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof mobileSchema>>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { countryCode: "+1", phone: "" },
  });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof mobileSchema>) =>
      portalRuntimeService.requestOtp({
        identifier: v.countryCode + v.phone,
        channel: "sms",
        organizationId,
        locationId,
      }),
    onSuccess: (_r, v) => {
      toast.success("Code sent");
      onSent(v.countryCode + v.phone);
    },
    onError: (e: AppError) => toast.error(e.message),
  });
  return (
    <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("mobileNumber")}</Label>
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <Input
          {...form.register("countryCode")}
          className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
        />
        <Input
          {...form.register("phone")}
          inputMode="tel"
          placeholder="555 010 2200"
          className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
        />
      </div>
      {form.formState.errors.phone && (
        <p className="text-xs text-red-300">{form.formState.errors.phone.message}</p>
      )}
      <Button
        type="submit"
        disabled={send.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sendOtp")}
      </Button>
    </form>
  );
}

const emailSchema = z.object({ email: z.string().email("Enter a valid email") });
export function EmailForm({
  organizationId,
  locationId,
  onSent,
}: {
  organizationId: string;
  locationId: string;
  onSent: (target: string) => void;
}) {
  const { t } = usePortalRuntime();
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof emailSchema>) =>
      portalRuntimeService.requestOtp({
        identifier: v.email,
        channel: "email",
        organizationId,
        locationId,
      }),
    onSuccess: (_r, v) => {
      toast.success("Code sent");
      onSent(v.email);
    },
    onError: (e: AppError) => toast.error(e.message),
  });
  return (
    <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("emailAddress")}</Label>
      <Input
        {...form.register("email")}
        type="email"
        placeholder="you@example.com"
        className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
      />
      {form.formState.errors.email && (
        <p className="text-xs text-red-300">{form.formState.errors.email.message}</p>
      )}
      <Button
        type="submit"
        disabled={send.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sendOtp")}
      </Button>
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
  const { t } = usePortalRuntime();
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
      }),
    onSuccess: onLoggedIn,
    // The backend deliberately returns one generic message for "wrong
    // password", "no such guest", and "guest exists but never set a
    // password" -- see GuestPasswordLoginFailedError's own docstring, and
    // never a distinguishable one (avoids leaking account existence) --
    // so this page can't auto-detect "you're new, here's OTP instead" and
    // just relies on the method switcher above the form instead.
    onError: (e: AppError) => toast.error(e.message),
  });

  return (
    <form onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("mobileNumber")}</Label>
      <Input
        {...form.register("identifier")}
        placeholder="you@example.com or +1 555 010 2200"
        className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
      />
      {form.formState.errors.identifier && (
        <p className="text-xs text-red-300">{form.formState.errors.identifier.message}</p>
      )}
      <Label className="text-white/80">{t("password")}</Label>
      <Input
        {...form.register("password")}
        type="password"
        placeholder="••••••••••••"
        className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
      />
      {form.formState.errors.password && (
        <p className="text-xs text-red-300">{form.formState.errors.password.message}</p>
      )}
      <Button
        type="submit"
        disabled={login.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("signIn")}
      </Button>
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
  const { t } = usePortalRuntime();
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
      }),
    onSuccess: onLoggedIn,
    onError: (e: AppError) => toast.error(e.message),
  });
  return (
    <form onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-3">
      <Label className="text-white/80">{t("mobileNumber")}</Label>
      <Input
        {...form.register("identifier")}
        placeholder="you@example.com or +1 555 010 2200"
        className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
      />
      {form.formState.errors.identifier && (
        <p className="text-xs text-red-300">{form.formState.errors.identifier.message}</p>
      )}
      <Label className="text-white/80">{t("voucherCode")}</Label>
      <Input
        {...form.register("code")}
        placeholder="ABCD-1234"
        className="bg-white/10 border-white/10 text-white placeholder:text-white/40 uppercase"
      />
      {form.formState.errors.code && (
        <p className="text-xs text-red-300">{form.formState.errors.code.message}</p>
      )}
      <Button
        type="submit"
        disabled={login.isPending}
        className="h-11 w-full font-semibold text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
      >
        {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("submit")}
      </Button>
    </form>
  );
}
