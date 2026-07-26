import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Smartphone,
  Mail,
  KeyRound,
  Ticket,
  Wifi,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import { usePortalPreview, type PortalPreviewConfigSource } from "@/hooks/usePortalPreview";
import { businessTypeIcon } from "@/lib/business-type-icons";
import { useSidebar } from "@/components/ui/sidebar";
import {
  enabledAuthMethods,
  primaryAuthMethod,
  otherAuthMethods,
  AUTH_METHOD_FALLBACK_COPY,
} from "@/lib/portal-auth-methods";
import type { RuntimeAuthMethod } from "@/types/portal-runtime";

/**
 * Shareable, internal Portal Preview -- see how a location's guest-facing
 * captive portal actually looks (real branding + real captive_portal_configs
 * data), without a physical device connecting through a real MikroTik
 * hotspot. Reachable via a clean, direct, bookmarkable URL from both a
 * customer's own Portal page (src/components/features/PortalPage.tsx) and
 * the Master console's Locations directory (src/routes/master.locations.tsx).
 *
 * Deliberately just the device mockup + a one-line status banner + two
 * links -- an earlier version also carried a whole second column of
 * summary cards (login-method badges, an industry-reference writeup,
 * branding/legal fields), which was more "admin dashboard panel" than
 * "preview": (see git history if that data is wanted again elsewhere,
 * e.g. on the real Portal Configuration page instead of here).
 *
 * Access model: gated by `_authenticated`'s own guard (any signed-in
 * platform session, the same bar every other page under this route tree
 * uses) -- not a public unauthenticated URL. "Shareable" here means
 * shareable among people who already have platform access (an org owner
 * sharing a link with a colleague, or a Master operator sharing one with
 * another operator) -- a fully public link would leak a customer's real
 * branding/config to anyone with a guessable URL. `organizationId` is a
 * required search param (mirrors /portal's own real search-param
 * identity) rather than resolved from `locationId` alone, since
 * resolving org membership implicitly only works for a caller who *has*
 * an org of their own -- a Master console operator previewing an
 * arbitrary customer's location has none.
 */

const searchSchema = z.object({ organizationId: z.string().min(1) });

export const Route = createFileRoute("/_authenticated/preview/portal/$locationId")({
  validateSearch: searchSchema,
  component: PortalPreviewPage,
});

interface LocationSummary {
  name: string;
  organizationName: string | null;
  propertyType: string | null;
}

async function fetchLocationSummary(
  locationId: string,
  organizationId: string,
): Promise<LocationSummary> {
  const { data } = await api.get<{ name: string; property_type: string | null }>(
    `/locations/${locationId}`,
    { headers: { "X-Organization-Id": organizationId } },
  );
  let organizationName: string | null = null;
  try {
    const { data: org } = await api.get<{ name: string }>(`/organizations/${organizationId}`, {
      headers: { "X-Organization-Id": organizationId },
    });
    organizationName = org.name;
  } catch {
    // Non-fatal -- the preview still renders fine without the org's display
    // name (falls back to showing the raw id in the header).
  }
  return { name: data.name, propertyType: data.property_type, organizationName };
}

const METHOD_META: Record<
  RuntimeAuthMethod,
  { icon: React.ComponentType<{ className?: string }>; label: string; desc: string }
> = {
  otp_sms: { icon: Smartphone, label: "Mobile OTP", desc: "Receive a code by SMS" },
  otp_email: { icon: Mail, label: "Email OTP", desc: "Receive a code by email" },
  username_password: {
    icon: KeyRound,
    label: "Password login",
    desc: "Sign in with a saved password",
  },
  voucher: { icon: Ticket, label: "Voucher code", desc: "Redeem a voucher code" },
};

const BANNER_COPY: Record<
  PortalPreviewConfigSource,
  { tone: "ok" | "info" | "warn"; text: string }
> = {
  location: { tone: "ok", text: "Showing this location's own captive portal configuration." },
  "organization-default": {
    tone: "info",
    text: "No location-specific config -- showing the organization's default.",
  },
  "branding-only": {
    tone: "warn",
    text: "No captive portal configured yet -- showing organization branding only.",
  },
};

function PortalPreviewPage() {
  const { locationId } = Route.useParams();
  const { organizationId } = Route.useSearch();
  const [step, setStep] = useState<"welcome" | "auth" | "form">("welcome");
  const [activeMethod, setActiveMethod] = useState<RuntimeAuthMethod | null>(null);

  // This page's whole point is a focused, distraction-free look at the
  // guest-facing portal (see this file's own module docstring) -- force
  // the mobile nav drawer closed on arrival so a still-open drawer carried
  // over from wherever the admin was browsing before never covers the
  // preview itself. The drawer's own trigger (TopNavbar) is still there
  // and still opens normally; this only clears a stale *already-open*
  // state on mount.
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = usePortalPreview(organizationId, locationId);

  const locationQuery = useQuery({
    queryKey: ["portal-preview-location", organizationId, locationId],
    queryFn: () => fetchLocationSummary(locationId, organizationId),
    retry: false,
  });

  // The exact same priority-ordered enabled-methods logic the real guest
  // flow uses (src/lib/portal-auth-methods.ts) -- reused as-is, not
  // reimplemented, so this preview can never show a method set (or a
  // default landing method) that the real /portal/* flow wouldn't.
  const liveMethods: RuntimeAuthMethod[] = preview.config ? enabledAuthMethods(preview.config) : [];
  const primary = preview.config ? primaryAuthMethod(preview.config) : null;

  const gradient = `linear-gradient(135deg, ${preview.primaryColor}, ${preview.secondaryColor})`;
  const banner = BANNER_COPY[preview.configSource];
  const TypeIcon = businessTypeIcon(locationQuery.data?.propertyType);

  const liveFlowUrl = `/portal?organizationId=${organizationId}&locationId=${locationId}&routerId=preview`;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Preview link copied");
  };

  // "Connect" lands directly on the highest-priority enabled method's own
  // form -- mirrors src/routes/portal.welcome.tsx's real handleConnect
  // exactly. The full "auth" picker step (below) stays reachable via that
  // form's own "see other options" link, never as the default landing.
  const handleConnect = () => {
    if (primary) {
      setActiveMethod(primary);
      setStep("form");
      return;
    }
    setStep("auth");
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link to="/locations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {locationQuery.isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>
                <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{locationQuery.data?.name ?? "Portal preview"}</span>
                {locationQuery.data?.organizationName && (
                  <span className="shrink-0 text-muted-foreground">
                    &middot; {locationQuery.data.organizationName}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={copyLink} title="Copy preview link">
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" asChild title="Open live guest flow">
          <a href={liveFlowUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>

      {!preview.isLoading && (
        <div
          className={
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs " +
            (banner.tone === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : banner.tone === "info"
                ? "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300")
          }
        >
          {banner.tone === "ok" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : banner.tone === "info" ? (
            <Info className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          {banner.text}
        </div>
      )}

      {/* The preview itself -- real merged branding/config data, no
          placeholder content. This is the whole page; everything above
          is just enough chrome to know what you're looking at. */}
      <div className="mx-auto w-full max-w-[300px] rounded-[2.2rem] border-8 border-foreground/90 bg-foreground/90 p-1.5 shadow-xl">
        <div
          className="relative min-h-[560px] overflow-hidden rounded-[1.6rem] text-white"
          style={{ background: gradient }}
        >
          {preview.isLoading && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-black/20">
              <Loader2 className="h-5 w-5 animate-spin text-white/80" />
            </div>
          )}
          {preview.backgroundImageUrl && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: `url(${preview.backgroundImageUrl})` }}
            />
          )}
          <div className="relative z-10 flex min-h-[560px] flex-col px-5 pb-6 pt-6">
            <div className="mb-6 flex items-center gap-2.5">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-lg"
                style={{ background: gradient }}
              >
                {preview.logoUrl ? (
                  <img src={preview.logoUrl} alt="" className="h-5 w-5 object-contain" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{preview.name}</p>
                <p className="truncate text-[10px] text-white/60">Guest WiFi</p>
              </div>
            </div>

            {step === "welcome" && (
              <div className="flex flex-1 flex-col justify-center gap-5">
                <div>
                  <h2 className="text-2xl font-bold leading-tight">
                    {preview.config?.splashHeadline ?? "Welcome"}
                  </h2>
                  <p className="mt-2 text-xs text-white/70">
                    {preview.config?.splashWelcomeMessage ?? "Connect to enjoy free guest WiFi."}
                  </p>
                </div>
                <Button
                  className="h-11 w-full text-sm font-semibold text-white shadow-lg"
                  style={{ background: gradient }}
                  onClick={handleConnect}
                >
                  Connect <ChevronRight className="ms-1.5 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Only reachable via the "See other sign-in options" link
                below the primary method's own form -- never the default
                landing for "Connect" itself (see handleConnect above),
                mirroring the real guest flow's own picker
                (src/routes/portal.auth.index.tsx). */}
            {step === "auth" && (
              <div className="flex flex-1 flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setStep("welcome")}
                  className="mb-1 flex items-center gap-1 text-[11px] text-white/60 hover:text-white"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <h3 className="text-base font-semibold">Choose sign-in method</h3>
                {liveMethods.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 text-center text-xs text-white/70">
                    No sign-in methods are enabled. A real guest would see &ldquo;contact
                    reception.&rdquo;
                  </div>
                ) : (
                  liveMethods.map((m) => {
                    const meta = METHOD_META[m];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setActiveMethod(m);
                          setStep("form");
                        }}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-start transition hover:border-white/25 hover:bg-white/[0.1]"
                      >
                        <div
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
                          style={{ background: gradient }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{meta.label}</p>
                          <p className="truncate text-[10px] text-white/55">{meta.desc}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Field-accurate mockup of the real form the guest lands on
                for whichever method they tapped -- mirrors
                src/routes/portal.auth.$method.tsx's MobileForm/EmailForm/
                PasswordForm field-for-field. */}
            {step === "form" && activeMethod && (
              <div className="flex flex-1 flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setStep(liveMethods.length > 1 ? "auth" : "welcome")}
                  className="mb-1 flex items-center gap-1 text-[11px] text-white/60 hover:text-white"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <h3 className="text-base font-semibold">{METHOD_META[activeMethod].label}</h3>

                {activeMethod === "otp_sms" && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium text-white/70">Mobile number</p>
                    <div className="grid grid-cols-[64px_1fr] gap-2">
                      <div className="rounded-lg border border-white/10 bg-white/10 px-2 py-2 text-xs">+1</div>
                      <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/40">555 010 2200</div>
                    </div>
                    <div className="mt-1 rounded-lg py-2.5 text-center text-xs font-semibold" style={{ background: gradient }}>Send code</div>
                  </div>
                )}

                {activeMethod === "otp_email" && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium text-white/70">Email address</p>
                    <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/40">you@example.com</div>
                    <div className="mt-1 rounded-lg py-2.5 text-center text-xs font-semibold" style={{ background: gradient }}>Send code</div>
                  </div>
                )}

                {activeMethod === "username_password" && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium text-white/70">Mobile number</p>
                    <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/40">
                      you@example.com or +1 555 010 2200
                    </div>
                    <p className="text-[11px] font-medium text-white/70">Password</p>
                    <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/40">••••••••••••</div>
                    <div className="mt-1 rounded-lg py-2.5 text-center text-xs font-semibold" style={{ background: gradient }}>Sign in</div>
                  </div>
                )}

                {activeMethod === "voucher" && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium text-white/70">Mobile number</p>
                    <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/40">
                      you@example.com or +1 555 010 2200
                    </div>
                    <p className="text-[11px] font-medium text-white/70">Voucher code</p>
                    <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/40">ABCD-1234</div>
                    <div className="mt-1 rounded-lg py-2.5 text-center text-xs font-semibold" style={{ background: gradient }}>Submit</div>
                  </div>
                )}

                {/* Every *other* enabled method, as a compact fallback link
                    -- mirrors src/routes/portal.auth.$method.tsx's own
                    OtherMethodsLinks field-for-field (same shared copy),
                    never a second full menu by default. */}
                {preview.config &&
                  otherAuthMethods(preview.config, activeMethod).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setActiveMethod(m)}
                      className="pt-1 text-center text-[10px] text-white/50 hover:text-white hover:underline"
                    >
                      {AUTH_METHOD_FALLBACK_COPY[m]}
                    </button>
                  ))}
              </div>
            )}

            <p className="mt-6 text-center text-[9px] text-white/40">Powered by CloudGuest</p>
          </div>
        </div>
      </div>
    </div>
  );
}
