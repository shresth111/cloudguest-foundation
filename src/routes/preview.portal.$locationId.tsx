import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 px-2" asChild>
            <Link to={backTo}>
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

        {/* The real thing, not a hand-copied recreation -- the exact same
            PortalRuntimeProvider/PortalShell/GuestSignInCard a guest's
            device renders under /portal/welcome, fed this location's real
            resolved config (or org-branding fallback, see mergedConfig
            above). `previewMode` makes GuestSignInCard show a "connect a
            real device" notice on submit instead of calling a real login
            endpoint; `constrained` makes PortalShell size to this phone
            bezel instead of the full viewport. Any future visual change
            to the real guest flow now shows up here automatically --
            this can never drift out of sync with it again. */}
        <div className="mx-auto w-full max-w-[300px] rounded-[2.2rem] border-8 border-foreground/90 bg-foreground/90 p-1.5 shadow-xl">
          <div className="relative h-[600px] overflow-hidden rounded-[1.6rem]">
            {preview.isLoading ? (
              <div
                className="grid h-full place-items-center"
                style={{ background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)" }}
              >
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
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
      </div>
    </div>
  );
}
