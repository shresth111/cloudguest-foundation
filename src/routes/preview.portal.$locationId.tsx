import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Wifi,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import { usePortalPreview, type PortalPreviewConfigSource } from "@/hooks/usePortalPreview";
import { businessTypeIcon } from "@/lib/business-type-icons";
import {
  enabledAuthMethods,
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
 * Deliberately a TOP-LEVEL route, not nested under `_authenticated` --
 * that layout wraps every child in the full customer/master dashboard
 * shell (AppSidebar + TopNavbar + QuickActionsFab, see
 * src/routes/_authenticated.tsx), which is exactly the "opens in a new
 * page but drags along a whole second dashboard" chrome this preview must
 * NOT have: it's meant to be a focused look at the guest-facing portal
 * itself, not another admin surface. This file carries its own copy of
 * `_authenticated`'s auth guard below instead (same bar, no shell),
 * mirroring how src/routes/master.tsx's tree and the guest-facing
 * src/routes/portal.tsx tree each own their own guard/providers rather
 * than nesting under `_authenticated`.
 *
 * Access model: any signed-in platform session (the same bar every other
 * page under `_authenticated` uses) -- not a public unauthenticated URL.
 * "Shareable" here means shareable among people who already have platform
 * access (an org owner sharing a link with a colleague, or a Master
 * operator sharing one with another operator) -- a fully public link
 * would leak a customer's real branding/config to anyone with a
 * guessable URL. `organizationId` is a required search param (mirrors
 * /portal's own real search-param identity) rather than resolved from
 * `locationId` alone, since resolving org membership implicitly only
 * works for a caller who *has* an org of their own -- a Master console
 * operator previewing an arbitrary customer's location has none.
 */

const searchSchema = z.object({ organizationId: z.string().min(1) });

export const Route = createFileRoute("/preview/portal/$locationId")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: ({ context, location }) => {
    if (context.auth?.status === "anonymous") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
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
  // Mirrors GuestSignInCard's own "otp" | "password" tab state -- the
  // real guest card these two are all this preview shows now (voucher/the
  // non-default OTP channel still show as the same small fallback links
  // the real card uses).
  const [tab, setTab] = useState<"otp" | "password">("otp");

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
  const hasOtpTab = liveMethods.includes("otp_sms") || liveMethods.includes("otp_email");
  const hasPasswordTab = liveMethods.includes("username_password");
  // Which OTP channel the mockup's "New user" tab shows -- SMS first if
  // enabled (same AUTH_METHOD_PRIORITY the real card follows), else email.
  const otpChannel: RuntimeAuthMethod = liveMethods.includes("otp_sms") ? "otp_sms" : "otp_email";
  // Default landing tab mirrors the real card's own primaryAuthMethod
  // fallback (see src/lib/portal-auth-methods.ts): OTP if enabled at all,
  // else password -- re-evaluated once the real config actually loads
  // (liveMethods is empty, and this location-specific config unknown,
  // until then).
  useEffect(() => {
    if (!hasOtpTab && hasPasswordTab) setTab("password");
  }, [hasOtpTab, hasPasswordTab]);

  const gradient = `linear-gradient(135deg, ${preview.primaryColor}, ${preview.secondaryColor})`;
  const banner = BANNER_COPY[preview.configSource];
  const TypeIcon = businessTypeIcon(locationQuery.data?.propertyType);

  const liveFlowUrl = `/portal?organizationId=${organizationId}&locationId=${locationId}&routerId=preview`;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Preview link copied");
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 px-2" asChild>
            <Link to="/locations">
              <ArrowLeft className="h-4 w-4" />
              Back to Portal Settings
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
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
            className="relative min-h-[560px] overflow-hidden rounded-[1.6rem]"
            style={{ background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)" }}
          >
            {preview.isLoading && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-white/60">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            )}
            <div
              aria-hidden
              className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full opacity-50 blur-2xl"
              style={{
                background: `radial-gradient(circle, ${preview.primaryColor} 0%, transparent 70%)`,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-14 -right-10 h-36 w-36 rounded-full opacity-40 blur-2xl"
              style={{
                background: `radial-gradient(circle, ${preview.secondaryColor} 0%, transparent 70%)`,
              }}
            />
            <div className="relative z-10 flex min-h-[560px] flex-col px-5 pb-5 pt-6 text-slate-900">
              <div className="mb-5 flex flex-col items-center text-center">
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-lg"
                  style={{ background: gradient }}
                >
                  {preview.logoUrl ? (
                    <img src={preview.logoUrl} alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    <Wifi className="h-5 w-5" />
                  )}
                </div>
                <h2
                  className="mt-3 text-lg font-bold leading-tight"
                  style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
                >
                  {preview.config?.splashHeadline?.trim() || `Welcome to ${preview.name}`}
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  {preview.config?.splashWelcomeMessage?.trim() ||
                    "Sign in for complimentary WiFi access on this network."}
                </p>
              </div>

              {/* A field-accurate, single-screen mockup of the real
                  redesigned guest sign-in card (src/components/portal-runtime/
                  GuestSignInCard.tsx) -- no more "tap Connect, then pick a
                  method, then see its form" 3-hop mockup: the real guest
                  flow was collapsed to one page a while back, and this
                  preview now mirrors that shape exactly instead of showing
                  an already-retired multi-step design. */}
              <div
                className="flex flex-1 flex-col rounded-2xl border border-indigo-100/80 bg-white p-4 text-slate-900"
                style={{ boxShadow: "0 16px 40px -18px rgba(79,70,229,0.3)" }}
              >
                {hasOtpTab && hasPasswordTab && (
                  <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-indigo-50 p-1">
                    <button
                      type="button"
                      onClick={() => setTab("otp")}
                      className={
                        "rounded-full px-1.5 py-1.5 text-[10px] font-semibold transition " +
                        (tab === "otp" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500")
                      }
                    >
                      New user &middot; Mobile OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("password")}
                      className={
                        "rounded-full px-1.5 py-1.5 text-[10px] font-semibold transition " +
                        (tab === "password"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-500")
                      }
                    >
                      Registered user
                    </button>
                  </div>
                )}

                {liveMethods.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-slate-500">
                    No sign-in methods are enabled. A real guest would see &ldquo;contact
                    reception.&rdquo;
                  </p>
                ) : tab === "otp" && hasOtpTab ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-500">
                      {otpChannel === "otp_sms" ? "Mobile number" : "Email address"}
                    </p>
                    {otpChannel === "otp_sms" ? (
                      <div className="grid grid-cols-[46px_1fr] gap-1.5">
                        <div className="rounded-lg border border-slate-200 px-2 py-2 text-[11px]">
                          +1
                        </div>
                        <div className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-400">
                          555 010 2200
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-400">
                        you@example.com
                      </div>
                    )}
                    <div
                      className="mt-1 rounded-lg py-2 text-center text-[11px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                    >
                      Send OTP
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-500">
                      Mobile number or email
                    </p>
                    <div className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-400">
                      you@example.com or +1 555 010 2200
                    </div>
                    <p className="text-[10px] font-semibold text-slate-500">Password</p>
                    <div className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-400">
                      ••••••••••••
                    </div>
                    <label className="mt-1 flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
                      <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-slate-300" />
                      I agree to the{" "}
                      <span className="font-medium text-slate-800">
                        Terms &amp; Acceptable Use Policy
                      </span>
                    </label>
                    <div
                      className="mt-1 rounded-lg py-2 text-center text-[11px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                    >
                      Sign in &amp; connect
                    </div>
                  </div>
                )}

                {/* Every *other* enabled method, as a compact fallback link
                    -- same real fallback copy the live card and
                    src/routes/portal.auth.$method.tsx use, never a second
                    full menu by default. */}
                {preview.config &&
                  liveMethods.length > 0 &&
                  otherAuthMethods(preview.config, tab === "otp" ? otpChannel : "username_password")
                    .filter((m) => !(tab === "otp" && (m === "otp_sms" || m === "otp_email")))
                    .map((m) => (
                      <p key={m} className="mt-2 text-center text-[9px] text-slate-500">
                        {AUTH_METHOD_FALLBACK_COPY[m]}
                      </p>
                    ))}
              </div>

              {/* Mirrors the real guest flow's own footer convention (see
               * PortalShell's light-variant footer) -- this used to show
               * "Powered by CloudGuest", the internal engineering name,
               * which this preview should never show since it's meant to
               * be an honest mockup of what a guest actually sees. */}
              <p className="mt-4 text-center text-[9px] text-slate-400">
                Terms · Privacy · Support: ask venue staff
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
