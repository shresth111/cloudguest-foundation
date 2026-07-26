import { useState } from "react";
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
  Ticket,
  KeyRound,
  Share2,
  Wifi,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import { portalService } from "@/services/portal.service";
import { usePortalPreview, type PortalPreviewConfigSource } from "@/hooks/usePortalPreview";
import { businessTypeIcon } from "@/lib/business-type-icons";
import type { PortalLoginMethod } from "@/types/portal";
import type { RuntimeAuthMethod, RuntimePortalConfig } from "@/types/portal-runtime";

/**
 * Shareable, internal Portal Preview -- see how a location's guest-facing
 * captive portal actually looks (real branding + real captive_portal_configs
 * data), without a physical device connecting through a real MikroTik
 * hotspot. Reachable via a clean, direct, bookmarkable URL from both a
 * customer's own Portal page (src/components/features/PortalPage.tsx) and
 * the Master console's Locations directory (src/routes/master.locations.tsx).
 *
 * Access model: gated by `_authenticated`'s own guard (any signed-in
 * platform session, the same bar every other page under this route tree
 * uses) -- not a public unauthenticated URL. "Shareable" here means
 * shareable among people who already have platform access (an org owner
 * sharing a link with a colleague, or a Master operator sharing one with
 * another operator) -- a fully public link would leak a customer's real
 * branding/config to anyone with a guessable URL, which the task this page
 * was built for explicitly does not want. `organizationId` is a required
 * search param (mirrors /portal's own real search-param identity, see
 * that route's own comment) rather than resolved from `locationId` alone,
 * since resolving org membership implicitly only works for a caller who
 * *has* an org of their own -- a Master console operator previewing an
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
  status: string;
}

async function fetchLocationSummary(
  locationId: string,
  organizationId: string,
): Promise<LocationSummary> {
  const { data } = await api.get<{
    name: string;
    property_type: string | null;
    status: string;
  }>(`/locations/${locationId}`, { headers: { "X-Organization-Id": organizationId } });
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
  return {
    name: data.name,
    propertyType: data.property_type,
    status: data.status,
    organizationName,
  };
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
};

// Mirrors src/routes/portal.auth.index.tsx's own `enabledMethods` exactly --
// these are the methods a real guest currently sees on /portal/auth, in the
// same order.
function liveEnabledMethods(config: RuntimePortalConfig): RuntimeAuthMethod[] {
  const methods: RuntimeAuthMethod[] = [];
  if (config.otpSmsEnabled) methods.push("otp_sms");
  if (config.otpEmailEnabled) methods.push("otp_email");
  if (config.usernamePasswordEnabled) methods.push("username_password");
  return methods;
}

const EXTRA_METHOD_META: Record<
  Exclude<PortalLoginMethod, "mobile_otp" | "email_otp" | "pms" | "click_through">,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  voucher: { icon: Ticket, label: "Voucher code" },
  social: { icon: Share2, label: "Social login" },
};

const BANNER_COPY: Record<
  PortalPreviewConfigSource,
  { tone: "ok" | "info" | "warn"; title: string; body: string }
> = {
  location: {
    tone: "ok",
    title: "This location has its own captive portal configuration",
    body: "Everything below is that configuration exactly as a guest's device would receive it from the resolve endpoint.",
  },
  "organization-default": {
    tone: "info",
    title: "Showing the organization's default captive portal",
    body: "This location has no override of its own, so it falls back to its organization's active default config -- the same config used across every other location that also has no override.",
  },
  "branding-only": {
    tone: "warn",
    title: "No captive portal has been configured yet",
    body: "This organization hasn't created a captive portal config for this location or as an org-wide default. A real guest would currently see “this venue's guest WiFi isn't set up yet.” The mockup below shows organization branding (logo, background image, colors) only.",
  },
};

function PortalPreviewPage() {
  const { locationId } = Route.useParams();
  const { organizationId } = Route.useSearch();
  const [step, setStep] = useState<"welcome" | "auth">("welcome");

  const preview = usePortalPreview(organizationId, locationId);

  const locationQuery = useQuery({
    queryKey: ["portal-preview-location", organizationId, locationId],
    queryFn: () => fetchLocationSummary(locationId, organizationId),
    retry: false,
  });

  // Full admin-facing record for the resolved config, purely to show the
  // voucher/username-password/social toggles -- fields the real live guest
  // flow (src/routes/portal.auth.index.tsx) doesn't render yet at all (it
  // only supports OTP), but which are real, persisted, configured data an
  // internal reviewer doing UI/UX testing should still be able to see.
  const fullConfigQuery = useQuery({
    queryKey: ["portal-preview-full-config", preview.config?.id, organizationId],
    queryFn: () => portalService.get(preview.config!.id, organizationId),
    enabled: !!preview.config?.id,
    retry: false,
  });

  const liveMethods: RuntimeAuthMethod[] = preview.config
    ? liveEnabledMethods(preview.config)
    : [];
  const extraMethods = (fullConfigQuery.data?.loginMethods ?? []).filter(
    (m): m is "voucher" | "social" => m === "voucher" || m === "social",
  );

  const gradient = `linear-gradient(135deg, ${preview.primaryColor}, ${preview.secondaryColor})`;
  const banner = BANNER_COPY[preview.configSource];
  const TypeIcon = businessTypeIcon(locationQuery.data?.propertyType);

  const liveFlowUrl = `/portal?organizationId=${organizationId}&locationId=${locationId}&routerId=preview`;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Preview link copied");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" asChild>
            <Link to="/locations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Portal Preview</h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              {locationQuery.isLoading ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                <>
                  <TypeIcon className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">
                    {locationQuery.data?.name ?? "This location"}
                  </span>
                  {locationQuery.data?.organizationName && (
                    <>
                      <span>&middot;</span>
                      <span>{locationQuery.data.organizationName}</span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" /> Copy preview link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={liveFlowUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Open live guest flow
            </a>
          </Button>
        </div>
      </div>

      {preview.isLoading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (
        <div
          className={
            "flex items-start gap-3 rounded-xl border p-4 text-sm " +
            (banner.tone === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : banner.tone === "info"
                ? "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300")
          }
        >
          {banner.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : banner.tone === "info" ? (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p className="font-medium">{banner.title}</p>
            <p className="mt-0.5 text-muted-foreground">{banner.body}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Device frame -- real merged branding/config data, no placeholder content */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm">Guest device preview</CardTitle>
            {preview.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="mx-auto w-full max-w-[280px] rounded-[2rem] border-8 border-foreground/90 bg-foreground/90 p-1.5 shadow-xl">
              <div
                className="relative min-h-[480px] overflow-hidden rounded-[1.4rem] text-white"
                style={{ background: gradient }}
              >
                {preview.backgroundImageUrl && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
                    style={{ backgroundImage: `url(${preview.backgroundImageUrl})` }}
                  />
                )}
                <div className="relative z-10 flex min-h-[480px] flex-col px-5 pb-6 pt-6">
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

                  {step === "welcome" ? (
                    <div className="flex flex-1 flex-col justify-center gap-5">
                      <div>
                        <h2 className="text-2xl font-bold leading-tight">
                          {preview.config?.splashHeadline ?? "Welcome"}
                        </h2>
                        <p className="mt-2 text-xs text-white/70">
                          {preview.config?.splashWelcomeMessage ??
                            "Connect to enjoy free guest WiFi."}
                        </p>
                      </div>
                      <Button
                        className="h-11 w-full text-sm font-semibold text-white shadow-lg"
                        style={{ background: gradient }}
                        onClick={() => setStep("auth")}
                      >
                        Connect <ChevronRight className="ms-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
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
                            <div
                              key={m}
                              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3"
                            >
                              <div
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
                                style={{ background: gradient }}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold">{meta.label}</p>
                                <p className="truncate text-[10px] text-white/55">{meta.desc}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  <p className="mt-6 text-center text-[9px] text-white/40">
                    Powered by CloudGuest
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real configured-data summary panel */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Live guest sign-in methods</CardTitle>
            </CardHeader>
            <CardContent>
              {preview.isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : liveMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground">None enabled.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {liveMethods.map((m) => (
                    <Badge key={m} variant="secondary" className="gap-1.5">
                      {(() => {
                        const Icon = METHOD_META[m].icon;
                        return <Icon className="h-3 w-3" />;
                      })()}
                      {METHOD_META[m].label}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                These are what a real guest currently sees on /portal/auth.
              </p>
            </CardContent>
          </Card>

          {extraMethods.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Also configured, not yet in the guest flow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {extraMethods.map((m) => {
                    const meta = EXTRA_METHOD_META[m];
                    const Icon = meta.icon;
                    return (
                      <Badge key={m} variant="outline" className="gap-1.5">
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enabled in this captive portal config, but the live guest sign-in flow only
                  implements OTP today -- these toggles have no guest-facing screen yet.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Branding &amp; legal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Primary color</span>
                <span className="flex items-center gap-1.5 font-mono text-xs">
                  <span
                    className="h-3.5 w-3.5 rounded-full border"
                    style={{ background: preview.primaryColor }}
                  />
                  {preview.primaryColor}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Secondary color</span>
                <span className="flex items-center gap-1.5 font-mono text-xs">
                  <span
                    className="h-3.5 w-3.5 rounded-full border"
                    style={{ background: preview.secondaryColor }}
                  />
                  {preview.secondaryColor}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Background image</span>
                <span>{preview.backgroundImageUrl ? "Set" : "Not set"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Terms &amp; conditions</span>
                <span>
                  {preview.config?.termsAndConditionsText || preview.config?.termsAndConditionsUrl
                    ? "Configured"
                    : "Not set"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
