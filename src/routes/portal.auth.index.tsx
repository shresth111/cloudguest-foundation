import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Smartphone, Mail, KeyRound, Ticket, ChevronRight, MessageCircle } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { enabledAuthMethods } from "@/lib/portal-auth-methods";
import type { RuntimeAuthMethod } from "@/types/portal-runtime";

/**
 * Bare `/portal/auth` (this method-picker menu, no `$method` segment) is
 * not a real guest entry point anymore -- the redesigned
 * `/portal/welcome` (GuestSignInCard) folded this same choice into its
 * own "New user / Registered user" tab toggle (a client-side state
 * change, not a URL navigation), and is the one real landing page a
 * guest's device/QR code/NAS redirect ever points at. The only remaining
 * legitimate callers of this exact bare route are internal
 * fallback-flow "go back and try again" links (portal.verify,
 * portal.failure, portal.set-password) -- for those, redirecting on to
 * `/portal/welcome` instead of rendering this standalone menu is a
 * strict improvement (same real sign-in options, the one entry point
 * users actually recognize).
 *
 * A *direct* hit on this URL shape -- hand-typed, bookmarked, or leaked
 * from somewhere that built one it shouldn't have (see
 * src/routes/preview.portal.$locationId.tsx's own history: it used to
 * generate exactly this, with a fake `routerId=preview`) -- must never
 * render this raw, out-of-context menu to a real end-user either. One
 * `beforeLoad` redirect covers both cases identically, since there is no
 * reliable way (or reason) to tell an internal "try again" click apart
 * from a direct hit for this particular route.
 */
export const Route = createFileRoute("/portal/auth/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/portal/welcome", search });
  },
  component: AuthMethodPicker,
});

const METHOD_META: Record<
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

function AuthMethodPicker() {
  const { config, isLoading, t, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/auth" });
  const methods = config ? enabledAuthMethods(config) : [];

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">{t("chooseMethod")}</h1>
          <p className="mt-1 text-sm text-white/60">
            Pick the sign-in option that works best for you.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : methods.length === 0 ? (
          <PortalCard className="text-center text-sm text-white/70">
            No sign-in methods are available. Please contact reception.
          </PortalCard>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => {
              const meta = METHOD_META[m];
              const Icon = meta.icon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(m);
                    navigate({
                      to: "/portal/auth/$method",
                      params: { method: m },
                      search: (prev) => prev,
                    });
                  }}
                  className="group flex w-full items-center gap-3 rounded-[var(--pr-radius,18px)] border border-white/10 bg-white/[0.06] p-4 text-start backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-md"
                    style={{
                      background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))`,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t(meta.labelKey)}</p>
                    <p className="truncate text-xs text-white/55">{meta.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/80 rtl:rotate-180" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
