import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalShell,
  PortalCard,
  GUEST_LEGIBILITY_CARD_CLASS,
} from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { otherAuthMethods, AUTH_METHOD_FALLBACK_COPY } from "@/lib/portal-auth-methods";
import {
  MobileForm,
  EmailForm,
  WhatsAppForm,
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

const METHODS: RuntimeAuthMethod[] = [
  "otp_sms",
  "otp_email",
  "otp_whatsapp",
  "username_password",
  "voucher",
];

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
          className="block w-full text-center text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
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
  const portalSearch = { organizationId, locationId, routerId };
  const hasPhoto = !!config?.backgroundImageUrl;
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
    // "set a password?" prompt again here. Always /portal/success: that
    // brief transitional screen fires the real hotspot-login POST and
    // lands the guest on /portal/session once it completes -- the legacy
    // static-banner /portal/ad interstitial was removed (superseded by the
    // real Campaigns feature, now shown on /portal/session).
    navigate({
      to: "/portal/success",
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
      to: "/portal/success",
      search: (prev) => prev,
    });
  };

  const titleKey =
    m === "otp_email"
      ? "emailOtp"
      : m === "otp_whatsapp"
        ? "whatsappOtp"
        : m === "username_password"
          ? "passwordLogin"
          : m === "voucher"
            ? "voucherCode"
            : "mobileOtp";

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        {/* Same §1.1 L1 problem, same bounded fix, pill-shaped because this
         * one is a single short line: this back link was `text-slate-500`
         * set directly on the photo with nothing behind it. `w-fit` was
         * already on it, so the plate hugs the label with no layout
         * change; the colour moves to `--pg-ink-muted` for the same
         * reason the subtitles below do. */}
        <Link
          to="/portal/auth"
          from="/portal/auth/$method"
          search={(prev) => prev}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--pg-ink-muted)] hover:text-indigo-600",
            hasPhoto && cn(GUEST_LEGIBILITY_CARD_CLASS, "rounded-full px-3.5 py-1.5"),
          )}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back
        </Link>

        {/* captive-portal-v7-design-spec.md §1.1 (L1): this heading block
         * used to render straight onto the venue's photo, inside the
         * page scrim's deliberately fully-transparent 24-78% band, so
         * `--pg-ink` had no guaranteed contrast ratio against it at all.
         * It now carries the same bounded `GUEST_LEGIBILITY_CARD_CLASS`
         * plate `BrandPanel` and the shell footer already use, sized to
         * its own text (`w-fit` only reaches full column width when the
         * text genuinely fills it) -- deliberately NOT a wash over the
         * whole content column, which is §0.1 item 1's twice-shipped
         * mistake. Photo-only: on the flat `--pg-canvas` there is no
         * contrast problem to solve and no plate is drawn. */}
        <div
          className={cn(
            "mx-auto flex w-fit max-w-full flex-col items-center text-center",
            hasPhoto && cn("p-5", GUEST_LEGIBILITY_CARD_CLASS),
          )}
        >
          {config?.logoUrl ? (
            <img
              src={config.logoUrl}
              alt=""
              className="h-16 w-16 object-contain drop-shadow sm:h-20 sm:w-20 md:h-24 md:w-24"
            />
          ) : (
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl shadow-lg shadow-indigo-500/25 sm:h-16 sm:w-16 md:h-20 md:w-20"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
            >
              <Wifi className="h-7 w-7 text-white sm:h-8 sm:w-8 md:h-10 md:w-10" />
            </div>
          )}
          <h1 className="pg-title mt-4 text-[var(--pg-ink)]">{t(titleKey)}</h1>
          {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
           * §1.5 retuned that token #64748B -> #475569, and a slate class does
           * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
           * composite (`--pg-surface` at 85% over a near-black photo region);
           * full derivation in styles.css's own `--pg-ink-muted` note. Backing
           * the block and leaving its subtitle at 3.36:1 would only have half-
           * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
          <p className="mt-1.5 text-sm text-[var(--pg-ink-muted)]">
            Complete the form below to get online.
          </p>
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
          {m === "otp_whatsapp" && (
            <WhatsAppForm
              organizationId={organizationId}
              locationId={locationId}
              onSent={(target) => onSent(target, "otp_whatsapp")}
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
          {!m && <p className="text-sm text-slate-500">Unknown sign-in method.</p>}
          {m && <OtherMethodsLinks config={config} current={m} />}
        </PortalCard>
      </div>
    </PortalShell>
  );
}
