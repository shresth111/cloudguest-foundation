import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Copy, AlertTriangle, Info, CheckCircle2, Loader2, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { usePortalPreview, type PortalPreviewConfigSource } from "@/hooks/usePortalPreview";
import { businessTypeIcon } from "@/lib/business-type-icons";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
import type { RuntimePortalConfig } from "@/types/portal-runtime";

/**
 * Shareable, internal Portal Preview -- see how a location's guest-facing
 * captive portal actually looks (real branding + real captive_portal_configs
 * data), without a physical device connecting through a real MikroTik
 * hotspot. Reachable via a clean, direct, bookmarkable URL from both a
 * customer's own Portal page (src/components/features/PortalPage.tsx) and
 * the Master console's Locations directory (src/routes/master.locations.tsx).
 *
 * Deliberately just the device mockup + a one-line status banner + a
 * copy-link action -- an earlier version also carried a whole second column of
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

/**
 * Small header-accent illustration: a laptop screen broadcasting a signal
 * out to a small phone -- "this is what your guests see," rendered on the
 * bigger canvas this preview now actually uses. Same filled-flat-shape
 * character language as the other illustrations shipped this session.
 * Purely decorative -- aria-hidden.
 */
function PreviewBroadcastIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 96 56" className="hidden h-14 w-auto shrink-0 sm:block" fill="none">
      <rect x="8" y="8" width="46" height="30" rx="3" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.5" />
      <rect x="12" y="12" width="38" height="22" rx="1.5" fill="#1e1b4b" />
      <path d="M4 40h58l-4 4H8z" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.2" strokeLinejoin="round" />
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M56 ${16 + i * 4} q${10 + i * 4} ${2 - i} ${18 + i * 6} ${8 + i * 3}`}
          stroke={["#22d3ee", "#f0abfc", "#a78bfa"][i]}
          strokeOpacity="0.65" strokeWidth="1.6" strokeLinecap="round" fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
      <motion.g
        animate={shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="80" y="30" width="14" height="22" rx="3" fill="#1e1b4b" stroke="#22d3ee" strokeWidth="1.5" />
        <rect x="83" y="34" width="8" height="12" rx="1" fill="#2e2a5c" />
      </motion.g>
    </svg>
  );
}

function PortalPreviewPage() {
  const { locationId } = Route.useParams();
  const { organizationId } = Route.useSearch();
  // "Back to Portal Settings" used to hardcode `to="/locations"` -- a route
  // that isn't either caller's actual settings page (it's
  // `_authenticated/locations.index.tsx`, an unrelated org-wide "Location
  // Master" list gated behind its own permissions). For a customer that's a
  // 403-riddled, unfamiliar admin page; for a Master operator it's still the
  // wrong "Locations" screen (their real one is `/master/locations`, a
  // different route/component entirely). Either way, clicking it landed
  // somewhere that felt like a random unrelated page -- exactly the
  // reported "back button jumps to some old/wrong page" symptom, just
  // triggered by this in-page link rather than the browser's own Back.
  // Compute the *real* settings page for whichever surface actually sent
  // this visitor here, instead of guessing with one hardcoded string.
  const { roles } = useAuth();
  const isOperator = roles.some((r) => r.scopeType === "global");
  const backTo = isOperator ? "/master/locations" : `/customer/${locationId}/portal`;

  const preview = usePortalPreview(organizationId, locationId);

  const locationQuery = useQuery({
    queryKey: ["portal-preview-location", organizationId, locationId],
    queryFn: () => fetchLocationSummary(locationId, organizationId),
    retry: false,
  });

  const banner = BANNER_COPY[preview.configSource];
  const TypeIcon = businessTypeIcon(locationQuery.data?.propertyType);

  // A real, resolved captive_portal_configs row wins as-is (its own
  // fields are already correct); a location with none yet ("branding-only",
  // see usePortalPreview's own docstring) gets a synthetic config built
  // from the organization's branding fallbacks instead, with every
  // sign-in method left disabled -- true to what a guest would actually
  // see today: nothing configured yet, so GuestSignInCard's own "No
  // sign-in methods are available" message, not a fabricated login form.
  const mergedConfig: RuntimePortalConfig | null =
    preview.config ??
    (preview.branding
      ? {
          id: "preview",
          name: preview.name,
          theme: "light",
          logoUrl: preview.logoUrl,
          backgroundImageUrl: preview.backgroundImageUrl,
          primaryColor: preview.primaryColor,
          secondaryColor: preview.secondaryColor,
          defaultLanguage: "en",
          supportedLanguages: ["en"],
          advertisementBannerUrl: null,
          advertisementBannerLink: null,
          termsAndConditionsText: null,
          termsAndConditionsUrl: null,
          privacyPolicyText: null,
          privacyPolicyUrl: null,
          splashHeadline: null,
          splashWelcomeMessage: null,
          redirectUrl: null,
          otpSmsEnabled: false,
          otpEmailEnabled: false,
          otpWhatsappEnabled: false,
          usernamePasswordEnabled: false,
          voucherEnabled: false,
          resolvedViaLocationOverride: false,
          isOpenNow: true,
          businessHoursClosedMessage: null,
        }
      : null);

  // There used to be an "Open live guest flow" button here, opening
  // `/portal?...&routerId=preview` in a new tab -- a real, externally
  // reachable guest-portal URL built with the literal string "preview" as
  // its routerId. That's not a real router: every actual login call
  // downstream (OTP verify, password, voucher -- see
  // src/services/portal-runtime.service.ts) sends routerId straight to
  // the backend as the session's real router_id, so that link could never
  // complete a real sign-in anyway. The mockup below now renders the
  // real GuestSignInCard directly, in preview mode (PortalRuntimeProvider's
  // own previewMode -- submitting shows a "connect a real device" notice
  // instead of calling a real login endpoint), so there is no separate
  // link needed at all.

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Preview link copied");
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f9fc]">
      {/* Same dark indigo/violet/fuchsia identity as the rest of the
       * redesigned product this session -- this preview used to be a
       * plain narrow white column with a small phone bezel, out of step
       * with everything else. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] text-white">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 px-2 text-white/80 hover:bg-white/10 hover:text-white" asChild>
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4" />
              Back to Portal Settings
            </Link>
          </Button>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <MonitorSmartphone className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">Guest sign-in preview</p>
                <p className="flex items-center gap-1.5 truncate text-base font-semibold">
                  {locationQuery.isLoading ? (
                    <Skeleton className="h-4 w-32 bg-white/10" />
                  ) : (
                    <>
                      <TypeIcon className="h-4 w-4 shrink-0 text-white/70" />
                      <span className="truncate">{locationQuery.data?.name ?? "Portal preview"}</span>
                      {locationQuery.data?.organizationName && (
                        <span className="shrink-0 text-white/60">&middot; {locationQuery.data.organizationName}</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <PreviewBroadcastIllustration />
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Copy className="h-3.5 w-3.5" />
                Copy link
              </Button>
            </div>
          </div>

          {!preview.isLoading && (
            <div
              className={
                "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-sm " +
                (banner.tone === "ok"
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                  : banner.tone === "info"
                    ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                    : "border-amber-400/30 bg-amber-500/15 text-amber-100")
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
        </div>
      </div>

      <div className="mx-auto -mt-2 max-w-5xl px-4 pb-12 sm:px-6">
        {/* The real thing, not a hand-copied recreation -- the exact same
            PortalRuntimeProvider/PortalShell/GuestSignInCard a guest's
            device renders under /portal/welcome, fed this location's real
            resolved config (or org-branding fallback, see mergedConfig
            above). `previewMode` makes GuestSignInCard show a "connect a
            real device" notice on submit instead of calling a real login
            endpoint; `constrained` makes PortalShell fill whatever bezel
            it's given (no hardcoded phone sizing) instead of the full
            viewport -- widened here to a laptop-style frame so the guest
            experience reads at real, legible size instead of a small
            phone mockup floating in a mostly-empty page. Any future
            visual change to the real guest flow now shows up here
            automatically -- this can never drift out of sync with it
            again. */}
        <div className="mx-auto w-full max-w-3xl">
          {/* Laptop bezel -- a dark screen frame + a thin hinge/base bar
              below it, enough to read as "laptop" without an overly
              literal illustration competing with the real portal content
              inside. */}
          <div className="rounded-t-2xl border-8 border-b-0 border-[#1e1b4b] bg-[#1e1b4b] p-2 shadow-2xl">
            {/* A minimum height, not a fixed/capped one -- a strict 16:10
                ratio (and later a fixed 600px) at this width could still
                come out shorter than some guest-flow states need (the
                post-OTP "tell us about yourself" step, a wrapped terms
                checkbox, an error banner), clipping them or forcing an
                internal scrollbar guests couldn't use properly: "ye
                complete page nahi dikha sakte ho... sahi se full page
                scroll nahi kr paunga". min-h instead of h, and no
                overflow-y-auto, means this box (paired with PortalShell's
                own min-h-full, not h-full) grows to fit whatever the real
                content actually needs -- nothing to scroll, ever. */}
            <div className="relative min-h-[600px] w-full rounded-lg bg-white">
              {preview.isLoading ? (
                <div
                  className="grid min-h-[600px] place-items-center"
                  style={{ background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)" }}
                >
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : (
                <PortalRuntimeProvider
                  organizationId={organizationId}
                  locationId={locationId}
                  routerId="preview"
                  previewMode
                  presetConfig={mergedConfig}
                  presetConfigLoading={false}
                >
                  <PortalShell variant="light" showHeader={false} constrained>
                    <GuestSignInCard />
                  </PortalShell>
                </PortalRuntimeProvider>
              )}
            </div>
          </div>
          <div className="mx-auto h-3 w-full rounded-b-2xl bg-gradient-to-b from-[#312e81] to-[#1e1b4b] shadow-lg" />
          <div className="mx-auto h-1.5 w-24 rounded-b-xl bg-[#1e1b4b]/80" />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          A live look at your real guest sign-in screen -- what's shown here is the exact same experience a guest's own device renders.
        </p>
      </div>
    </div>
  );
}
