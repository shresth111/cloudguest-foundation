import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { RuntimeAuthMethod, RuntimeSession } from "@/types/portal-runtime";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/auth/$method")({
  component: AuthMethodPage,
});

const METHODS: RuntimeAuthMethod[] = ["otp_sms", "otp_email", "username_password"];

function AuthMethodPage() {
  const { method } = Route.useParams();
  const {
    t,
    organizationId,
    locationId,
    routerId,
    config,
    setOtpTarget,
    setSelectedMethod,
    setSession,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/auth/$method" });
  const m = (METHODS as string[]).includes(method) ? (method as RuntimeAuthMethod) : null;

  const onSent = (target: string, authMethod: RuntimeAuthMethod) => {
    setOtpTarget(target);
    setSelectedMethod(authMethod);
    navigate({ to: "/portal/verify", search: (prev) => prev });
  };

  const onPasswordLoggedIn = (session: RuntimeSession) => {
    setSelectedMethod("username_password");
    setSession(session);
    toast.success("Signed in");
    // A password login always belongs to a guest who already has one set
    // (see GuestService.login_via_password's docstring) -- never offer the
    // "set a password?" prompt again here.
    navigate({
      to: config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success",
      search: (prev) => prev,
    });
  };

  const titleKey =
    m === "otp_email" ? "emailOtp" : m === "username_password" ? "passwordLogin" : "mobileOtp";

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link
          to="/portal/auth"
          from="/portal/auth/$method"
          search={(prev) => prev}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
          <p className="mt-1 text-sm text-white/60">Complete the form below to get online.</p>
        </div>

        <PortalCard>
          {m === "otp_sms" && (
            <MobileForm
              organizationId={organizationId}
              locationId={locationId}
              onSent={(target) => onSent(target, "otp_sms")}
            />
          )}
          {m === "otp_email" && (
            <EmailForm
              organizationId={organizationId}
              locationId={locationId}
              onSent={(target) => onSent(target, "otp_email")}
            />
          )}
          {m === "username_password" && (
            <PasswordForm
              organizationId={organizationId}
              locationId={locationId}
              routerId={routerId}
              onLoggedIn={onPasswordLoggedIn}
            />
          )}
          {!m && <p className="text-sm text-white/70">Unknown sign-in method.</p>}
        </PortalCard>
      </div>
    </PortalShell>
  );
}

const mobileSchema = z.object({
  countryCode: z.string().min(1, "Required"),
  phone: z.string().min(6, "Enter a valid number"),
});
function MobileForm({
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
function EmailForm({
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
function PasswordForm({
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
  const { t, config, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/auth/$method" });
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
    // just offers a one-tap escape hatch below instead.
    onError: (e: AppError) => toast.error(e.message),
  });

  // First enabled OTP method, so a guest who's new (or never set a
  // password) is one tap from the actual form that will get them online,
  // not back to a full picker. Undefined (link hidden) only when this
  // portal has password login as its *only* enabled method.
  const otpFallback: RuntimeAuthMethod | undefined = config?.otpSmsEnabled
    ? "otp_sms"
    : config?.otpEmailEnabled
      ? "otp_email"
      : undefined;

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
      {otpFallback && (
        <button
          type="button"
          onClick={() => {
            setSelectedMethod(otpFallback);
            navigate({
              to: "/portal/auth/$method",
              params: { method: otpFallback },
              search: (prev) => prev,
            });
          }}
          className="w-full text-center text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
        >
          New here, or forgot your password? Use a one-time code instead
        </button>
      )}
    </form>
  );
}
