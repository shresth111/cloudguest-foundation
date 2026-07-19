import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Smartphone,
  Mail,
  Ticket,
  BedDouble,
  Globe,
  QrCode,
  Zap,
  ChevronRight,
} from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { RuntimeAuthMethod } from "@/types/portal-runtime";

export const Route = createFileRoute("/portal/auth")({
  component: AuthMethodPicker,
});

const METHOD_META: Record<
  RuntimeAuthMethod,
  { icon: React.ComponentType<{ className?: string }>; labelKey: string; desc: string }
> = {
  mobile_otp: { icon: Smartphone, labelKey: "mobileOtp", desc: "Receive a code by SMS" },
  email_otp: { icon: Mail, labelKey: "emailOtp", desc: "Receive a code by email" },
  voucher: { icon: Ticket, labelKey: "voucher", desc: "Redeem a printed voucher code" },
  pms: { icon: BedDouble, labelKey: "pms", desc: "Sign in with room number" },
  social: { icon: Globe, labelKey: "social", desc: "Continue with Google, Apple…" },
  qr: { icon: QrCode, labelKey: "qr", desc: "Scan a QR code to connect" },
  click_through: { icon: Zap, labelKey: "clickThrough", desc: "Accept terms and go online" },
};

function AuthMethodPicker() {
  const { config, isLoading, t, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate();

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
        ) : !config || config.enabledMethods.length === 0 ? (
          <PortalCard className="text-center text-sm text-white/70">
            No sign-in methods are available. Please contact reception.
          </PortalCard>
        ) : (
          <div className="space-y-2">
            {config.enabledMethods.map((m) => {
              const meta = METHOD_META[m];
              const Icon = meta.icon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(m);
                    navigate({ to: "/portal/auth/$method", params: { method: m } });
                  }}
                  className="group flex w-full items-center gap-3 rounded-[var(--pr-radius,18px)] border border-white/10 bg-white/[0.06] p-4 text-start backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-md"
                    style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
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
