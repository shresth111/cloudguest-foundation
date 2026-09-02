import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2,
  MonitorSmartphone,
  PlayCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { usePortalPreview, type PortalPreviewConfigSource } from "@/hooks/usePortalPreview";
import { businessTypeIcon } from "@/lib/business-type-icons";
import { customerFeatureHref } from "@/lib/customerNav";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
import { DemoPortalFlow } from "@/components/portal-runtime/DemoPortalFlow";
import {
  CampaignOverlay,
  campaignHasRenderableContent,
} from "@/components/portal-runtime/CampaignOverlay";
import { campaignService } from "@/services/campaign.service";
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
 * e.g. on the real Portal Configuration page instead of here). That decision
 * still stands in shape, though the walkthrough below is now the DEFAULT
 * rather than opt-in (see `searchSchema.walkthrough`), and the whole of
 * what it adds to this page's chrome is one header button (two while it is
 * running) plus a "this is a demonstration" strip on the bezel. The landing
 * state is the same minimal preview it has always been -- no second column
 * came back.
 *
 * THE GUEST WALKTHROUGH (on by default; `?walkthrough=false` or the "Static
 * preview""
 * button). The static preview stops at the sign-in screen, which is only the
 * first of four things a venue actually bought: it never shows the campaign
 * they built, or the post-login page they authored, actually firing. For a
 * sales/onboarding demo ("this is what your guests experience, and this is
 * what turns on once they are in") that is half the story. Turning the
 * walkthrough on swaps this provider from `previewMode` to `demoMode` and
 * hands the screen to `DemoPortalFlow` -- THE one simulated-journey engine,
 * shared with `/preview/portal/demo`, not a second copy -- which runs
 * sign-in (incl. the content/intro step) -> dummy OTP -> connected ->
 * campaign -> the venue's post-login page, all from THIS location's own
 * resolved config and its own real active campaign.
 *
 * NOTHING IT DOES REACHES A BACKEND. `demoMode` short-circuits every login
 * call in `useGuestSignIn` before the network (no `requestOtp`, so no SMS/
 * email is sent; no `loginWithOtp`/`loginWithPassword`, so no `GuestSession`
 * row; no `recordConsent`); the fake session never navigates to
 * `/portal/success`, which is the only place the NAS hotspot POST is fired;
 * and `CampaignOverlay` suppresses its impression and survey-response writes
 * under `demoMode` exactly as it already did under `previewMode` (see its own
 * `isSimulated`), so running this demo five times for five prospects cannot
 * move a single number on the venue's Campaigns page. The only side effect
 * anywhere is this browser tab's own `sessionStorage`, which `DemoPortalFlow`
 * clears on both mount and unmount.
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

const searchSchema = z.object({
  organizationId: z.string().min(1),
  /** The guest walkthrough. **Absent means ON** -- only an explicit
   * `?walkthrough=false` gives the plain static preview.
   *
   * This was shipped opt-in and that was wrong. The page exists to answer
   * "what will my guests see", and the static state answered it by showing
   * a sign-in card that, when touched, toasted "Preview mode -- connect a
   * real device to test sign-in." An operator demoing to a customer read
   * that as the product not working, and the thing that does work sat
   * behind a button nobody had a reason to press. Reported from a real
   * demo.
   *
   * Defaulting it on costs nothing visually: step 1 of the walkthrough IS
   * the same sign-in card the static preview rendered. The only difference
   * is that touching it now goes somewhere.
   *
   * Still a search param rather than component state so an operator can
   * bookmark or share a demo link. `.catch(undefined)` because this is the
   * one param a human might hand-edit: a `?walkthrough=yes` must fall back
   * to the default rather than throw this route's search validation and
   * blank the page mid-demo. */
  walkthrough: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/preview/portal/$locationId")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: ({ context, location }) => {
    if (context.auth?.status === "anonymous") {
      // See authGuards.ts's requireCustomerSession's identical guard --
      // never carry a redirect target that's already /login itself
      // forward as the ?redirect= value.
      const isAlreadyOnLogin =
        location.href === "/login" ||
        location.href.startsWith("/login?") ||
        location.href.startsWith("/login#");
      throw redirect({
        to: "/login",
        search: isAlreadyOnLogin ? undefined : { redirect: location.href },
      });
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
    <svg
      aria-hidden="true"
      viewBox="0 0 96 56"
      className="hidden h-14 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="8"
        y="8"
        width="46"
        height="30"
        rx="3"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.5"
      />
      <rect x="12" y="12" width="38" height="22" rx="1.5" fill="#1e1b4b" />
      <path
        d="M4 40h58l-4 4H8z"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M56 ${16 + i * 4} q${10 + i * 4} ${2 - i} ${18 + i * 6} ${8 + i * 3}`}
          stroke={["#22d3ee", "#f0abfc", "#a78bfa"][i]}
          strokeOpacity="0.65"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}
      <motion.g
        animate={
          shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
        }
        transition={
          shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <rect
          x="80"
          y="30"
          width="14"
          height="22"
          rx="3"
          fill="#1e1b4b"
          stroke="#22d3ee"
          strokeWidth="1.5"
        />
        <rect x="83" y="34" width="8" height="12" rx="1" fill="#2e2a5c" />
      </motion.g>
    </svg>
  );
}

function PortalPreviewPage() {
  const { locationId } = Route.useParams();
  const { organizationId, walkthrough: walkthroughParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Absent = on. Only an explicit `?walkthrough=false` opts out -- see the
  // search schema's own note for why this default was inverted.
  const walkthrough = walkthroughParam !== false;
  // Bumped by "Restart" -- keyed into the PortalRuntimeProvider below so a
  // restart genuinely rebuilds the whole runtime (language, selected method,
  // OTP phase, the fake session) rather than only resetting whichever pieces
  // this file happens to remember to clear.
  const [runId, setRunId] = useState(0);
  const setWalkthrough = (on: boolean) => {
    setRunId((n) => n + 1);
    // `replace` so toggling the demo on and off a few times in front of a
    // prospect does not bury the page they came from under history entries.
    navigate({
      search: (prev) => ({ ...prev, walkthrough: on ? undefined : false }),
      replace: true,
    });
  };
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
  const backTo = isOperator ? "/master/locations" : customerFeatureHref("portal");

  const preview = usePortalPreview(organizationId, locationId);

  const locationQuery = useQuery({
    queryKey: ["portal-preview-location", organizationId, locationId],
    queryFn: () => fetchLocationSummary(locationId, organizationId),
    retry: false,
  });

  // Campaigns are the single source of what a guest sees beyond the sign-in
  // card. One query, two consumers: the WALKTHROUGH hands this resolved
  // campaign to `DemoPortalFlow`, which shows it where a real guest actually
  // meets it -- AFTER sign-in, the way `portal.session.tsx` does. The STATIC
  // preview's own ordering below is deliberately left exactly as it was
  // (campaign first, then the sign-in card): it is a content preview of
  // "what else is configured", never a claim about sequence, and the
  // walkthrough is now the surface that answers the sequence question.
  //
  // So: the static preview leads with this location's currently-active campaign
  // (a Survey & Feedback campaign as the two-step feedback -> continue ->
  // sign-in flow, a Banner & Discounts campaign as its coupon/banner) exactly
  // as `CampaignOverlay` renders it for a real guest, then falls through to
  // the sign-in card. `resolveActivePreviewCampaign` is a content preview,
  // not a per-guest simulation -- see its own docstring for why the real
  // guest resolution (session-keyed, post-login) can't run here. Any failure
  // (no active campaign, a 403, an empty content set) degrades silently to
  // the plain sign-in card below.
  const campaignQuery = useQuery({
    queryKey: ["portal-preview-campaign", organizationId, locationId],
    queryFn: () => campaignService.resolveActivePreviewCampaign(organizationId, locationId),
    retry: false,
  });
  const [campaignDone, setCampaignDone] = useState(false);
  const activeCampaign = campaignQuery.data ?? null;
  const showCampaign =
    !!activeCampaign && campaignHasRenderableContent(activeCampaign) && !campaignDone;

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
          // "branding-only" -- no captive_portal_configs row, so no venue
          // has authored a post-login page. A location that DOES have a real
          // config keeps whatever it stored, and the walkthrough's step 4
          // renders it in the real `PostLoginHtmlFrame` (see
          // `DemoPortalFlow`); PortalPage.tsx's post-login editor previews
          // the same HTML inline while it is being written.
          postLoginHtml: null,
          // "branding-only" -- no captive_portal_configs row, so no content
          // mode is configured; "login" is the sign-in-only default.
          contentMode: "login",
          contentHeading: null,
          contentBody: null,
          contentImageUrl: null,
          survey: null,
          otpSmsEnabled: false,
          otpEmailEnabled: false,
          otpWhatsappEnabled: false,
          usernamePasswordEnabled: false,
          voucherEnabled: false,
          resolvedViaLocationOverride: false,
          isOpenNow: true,
          businessHoursClosedMessage: null,
          // captive-portal-v6-design-spec.md §7 -- "branding-only" (no
          // captive_portal_configs row at all yet) has no admin-set value
          // for either; same zero-visual-diff defaults every unconfigured
          // venue gets.
          guestFontChoice: "system",
          backgroundOverlayStrength: 55,
          // captive-portal-v7-design-spec.md §1.4 C3/C4/C5 -- 50/25 reproduce the
          // previous hardcoded `background-position: center 25%` exactly. The three
          // measurements are `null` because nothing has measured this preview's
          // image, and `null` is the correct value rather than a placeholder: it is
          // the same "not measured" state every real venue is in today (production
          // has zero backfilled branding rows), so the preview shows the
          // unconditional §1.3 scrim floor -- which is exactly what that venue will
          // see. See `toBackgroundMetric` for why 0 would have been wrong.
          backgroundFocalX: 50,
          backgroundFocalY: 25,
          backgroundLuminance: null,
          backgroundTopLuminance: null,
          backgroundEntropy: null,
          pinLoginEnabled: false,
          // v7 Part 3 P4: same reasoning as the focal defaults above -- the
          // preview shows what an unconfigured venue actually gets, and the
          // backend default is `true`.
          poweredByEnabled: true,
          locationCountry: null,
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
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 px-2 text-white/80 hover:bg-white/10 hover:text-white"
            asChild
          >
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
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
                  Guest sign-in preview
                </p>
                <p className="flex items-center gap-1.5 truncate text-base font-semibold">
                  {locationQuery.isLoading ? (
                    <Skeleton className="h-4 w-32 bg-white/10" />
                  ) : (
                    <>
                      <TypeIcon className="h-4 w-4 shrink-0 text-white/70" />
                      <span className="truncate">
                        {locationQuery.data?.name ?? "Portal preview"}
                      </span>
                      {locationQuery.data?.organizationName && (
                        <span className="shrink-0 text-white/60">
                          &middot; {locationQuery.data.organizationName}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <PreviewBroadcastIllustration />
              {/* The whole opt-in. Two buttons while a walkthrough is
                  running (restart it for the next prospect / drop back to the
                  plain preview), one when it is not -- deliberately the only
                  thing this feature adds to the page's chrome, see the
                  module docstring on why this route stays minimal. */}
              {walkthrough ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRunId((n) => n + 1)}
                    className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restart walkthrough
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWalkthrough(false)}
                    className="gap-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                    Static preview
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setWalkthrough(true)}
                  className="gap-1.5 bg-white text-[#312e81] hover:bg-white/90"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Run guest walkthrough
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
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
            {/* "It should be obvious on screen that this is a demonstration
                rather than a live guest session." Deliberately INSIDE the
                bezel, above the screen, rather than overlaid on the portal
                content: it stays visible in every step (including the
                campaign overlay and the venue's own post-login page, which
                each take the whole screen area) without covering any of the
                thing the operator is trying to show. */}
            {walkthrough && (
              <div className="mb-2 flex items-center justify-center gap-1.5 rounded-md bg-amber-400/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                <Sparkles className="h-3 w-3 shrink-0" />
                Demonstration &middot; not a live guest session
              </div>
            )}
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
                  style={{
                    background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)",
                  }}
                >
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : (
                <PortalRuntimeProvider
                  // A restart (and each toggle of the walkthrough) rebuilds
                  // the entire runtime rather than trying to reset it in
                  // place -- the state that has to go back to zero is spread
                  // across this provider AND `useGuestSignIn`'s own local
                  // phase/field state, and only a remount reliably clears
                  // both. The static preview's key never changes, so its
                  // behaviour is untouched.
                  key={walkthrough ? `walkthrough-${runId}` : "static"}
                  organizationId={organizationId}
                  locationId={locationId}
                  routerId="preview"
                  // Exactly one of these is ever set (they are documented as
                  // never being set together). `previewMode` = the static
                  // preview: every sign-in action short-circuits with a
                  // "connect a real device" toast. `demoMode` = the
                  // walkthrough: the same actions run a believable DUMMY
                  // client-side flow instead, with no network behind any of
                  // them. Either way no real login endpoint is ever called.
                  previewMode={!walkthrough}
                  demoMode={walkthrough}
                  presetConfig={mergedConfig}
                  presetConfigLoading={false}
                >
                  {walkthrough ? (
                    // The shared simulated-journey engine, fed THIS venue's
                    // own real material: its resolved config (already in the
                    // provider above, so branding/login methods/content step
                    // all come from it), its own currently-active campaign,
                    // and its own post-login page and redirect target.
                    // `DemoPortalFlow` owns the `PortalShell` for its steps.
                    <DemoPortalFlow
                      constrained
                      campaign={activeCampaign}
                      postLoginHtml={mergedConfig?.postLoginHtml ?? null}
                      redirectUrl={mergedConfig?.redirectUrl ?? null}
                    />
                  ) : showCampaign ? (
                    // `CampaignOverlay` brings its own `PortalShell` (passed
                    // `constrained` so its backdrop stays inside this bezel
                    // rather than escaping to the viewport); on done it hands
                    // the screen to the sign-in card below.
                    <CampaignOverlay
                      campaign={activeCampaign}
                      sessionId="preview"
                      constrained
                      onDone={() => setCampaignDone(true)}
                    />
                  ) : (
                    <PortalShell constrained>
                      <GuestSignInCard />
                    </PortalShell>
                  )}
                </PortalRuntimeProvider>
              )}
            </div>
          </div>
          <div className="mx-auto h-3 w-full rounded-b-2xl bg-gradient-to-b from-[#312e81] to-[#1e1b4b] shadow-lg" />
          <div className="mx-auto h-1.5 w-24 rounded-b-xl bg-[#1e1b4b]/80" />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {walkthrough
            ? "A walkthrough of the whole guest journey, driven by this location's own configuration. Nothing here is real: no code is sent, no session is created, and nothing is recorded against this venue."
            : "A live look at your real guest sign-in screen -- what's shown here is the exact same experience a guest's own device renders."}
        </p>
      </div>
    </div>
  );
}
