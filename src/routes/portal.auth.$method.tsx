import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalShell,
  PortalCard,
  GUEST_LEGIBILITY_CARD_CLASS,
  PortalTextPlate,
} from "@/components/portal-runtime/PortalShell";
import { PortalDefaultBrandBadge } from "@/components/portal-runtime/PortalDefaultBrandBadge";
import { VenueLogo } from "@/components/portal-runtime/VenueLogo";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { scriptClassOf } from "@/lib/portal-script";
import { otherAuthMethods } from "@/lib/portal-auth-methods";
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
  errorComponent: PortalErrorScreen,
  component: AuthMethodPage,
});

const METHODS: RuntimeAuthMethod[] = [
  "otp_sms",
  "otp_email",
  "otp_whatsapp",
  "username_password",
  "voucher",
];

/** The "use X instead" link per other enabled method -- translated (the
 * English-only AUTH_METHOD_FALLBACK_COPY constant loses its UI role; four
 * of five keys pre-existed, `usePasswordInstead` is new), and on the
 * tertiary-link recipe with a >=24px target (SC 2.5.8 -- same fix
 * AuthMoreOptions already carries; the old bare text-xs rows were ~18px). */
const OTHER_METHOD_LABEL_KEY: Record<RuntimeAuthMethod, string> = {
  otp_sms: "useMobileInstead",
  otp_email: "useEmailInstead",
  otp_whatsapp: "useWhatsappInstead",
  username_password: "usePasswordInstead",
  voucher: "haveVoucherUseInstead",
};

function OtherMethodsLinks({
  config,
  current,
}: {
  config: RuntimePortalConfig | undefined;
  current: RuntimeAuthMethod;
}) {
  const { t, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/auth/$method" });
  const others = config ? otherAuthMethods(config, current) : [];
  if (others.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 pt-1">
      {others.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => {
            setSelectedMethod(m);
            navigate({ to: "/portal/auth/$method", params: { method: m }, search: (prev) => prev });
          }}
          className="inline-flex min-h-6 items-center gap-1.5 px-2 py-1 pg-meta font-medium text-[var(--pg-ink-muted)] underline-offset-2 hover:text-[var(--pr-primary,#6366f1)] hover:underline"
        >
          {t(OTHER_METHOD_LABEL_KEY[m])}
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
          from="/portal/auth/$method"
          search={(prev) => prev}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 pg-meta font-medium text-[var(--pg-ink-muted)] hover:text-[var(--pr-primary,#6366f1)]",
            hasPhoto && cn(GUEST_LEGIBILITY_CARD_CLASS, "rounded-full px-3.5 py-1.5"),
          )}
        >
          <ArrowLeft className="h-4 w-4" /> {t("backLabel")}
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
        <div className="mx-auto flex w-fit max-w-full flex-col items-center text-center">
          <PortalTextPlate className="flex flex-col items-center">
            {config?.logoUrl ? (
              <VenueLogo logoUrl={config.logoUrl} size="md" />
            ) : (
              // The real Wyfy Guest mark, not the retired lucide-Wifi
              // gradient badge -- same default-brand treatment #108 gave
              // the welcome surface (PortalDefaultBrandBadge).
              <PortalDefaultBrandBadge
                size={64}
                className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20"
              />
            )}
            <h1
              className="pg-title mt-4 text-[var(--pg-ink)]"
              data-pg-script={scriptClassOf(t(titleKey))}
            >
              {t(titleKey)}
            </h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1.5 pg-meta text-[var(--pg-ink-muted)]">{t("authMethodSubtitle")}</p>
          </PortalTextPlate>
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
          {!m && <p className="pg-meta text-[var(--pg-ink-muted)]">{t("unknownMethodLabel")}</p>}
          {m && <OtherMethodsLinks config={config} current={m} />}
        </PortalCard>
      </div>
    </PortalShell>
  );
}
