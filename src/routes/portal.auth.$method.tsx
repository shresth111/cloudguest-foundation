import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { otherAuthMethods, AUTH_METHOD_FALLBACK_COPY } from "@/lib/portal-auth-methods";
import {
  MobileForm,
  EmailForm,
  PasswordForm,
  VoucherForm,
} from "@/components/portal-runtime/AuthMethodForms";
import type {
  RuntimeAuthMethod,
  RuntimePortalConfig,
  RuntimeSession,
} from "@/types/portal-runtime";

export const Route = createFileRoute("/portal/auth/$method")({
  component: AuthMethodPage,
});

const METHODS: RuntimeAuthMethod[] = ["otp_sms", "otp_email", "username_password", "voucher"];

function OtherMethodsLinks({
  config,
  current,
}: {
  config: RuntimePortalConfig | undefined;
  current: RuntimeAuthMethod;
}) {
  const { setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/auth/$method" });
  const others = config ? otherAuthMethods(config, current) : [];
  if (others.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-1">
      {others.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => {
            setSelectedMethod(m);
            navigate({ to: "/portal/auth/$method", params: { method: m }, search: (prev) => prev });
          }}
          className="block w-full text-center text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
        >
          {AUTH_METHOD_FALLBACK_COPY[m]}
        </button>
      ))}
    </div>
  );
}

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

  // A voucher login redeems and connects in one step (no separate OTP-style
  // verify page) -- same "already fully authenticated" destination as a
  // password login, and for the identical reason (no code left to verify).
  const onVoucherLoggedIn = (session: RuntimeSession) => {
    setSelectedMethod("voucher");
    setSession(session);
    toast.success("Connected");
    navigate({
      to: config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success",
      search: (prev) => prev,
    });
  };

  const titleKey =
    m === "otp_email"
      ? "emailOtp"
      : m === "username_password"
        ? "passwordLogin"
        : m === "voucher"
          ? "voucherCode"
          : "mobileOtp";

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
          {m === "voucher" && (
            <VoucherForm
              organizationId={organizationId}
              locationId={locationId}
              routerId={routerId}
              onLoggedIn={onVoucherLoggedIn}
            />
          )}
          {!m && <p className="text-sm text-white/70">Unknown sign-in method.</p>}
          {m && <OtherMethodsLinks config={config} current={m} />}
        </PortalCard>
      </div>
    </PortalShell>
  );
}
