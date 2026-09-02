import { useEffect, useRef, useState } from "react";
import { ExternalLink, Laptop, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import {
  DemoNotice,
  PG_PRIMARY_BTN,
  PG_SECONDARY_BTN,
} from "@/components/portal-runtime/PortalGuestUi";
import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
import {
  CampaignOverlay,
  campaignHasRenderableContent,
} from "@/components/portal-runtime/CampaignOverlay";
import { PostLoginHtmlFrame } from "@/components/portal-runtime/PostLoginHtmlFrame";
import { hasPostLoginHtml } from "@/lib/post-login-html";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { NextCampaign } from "@/types/campaign";

/**
 * THE ONE walkthrough engine for every simulated guest journey in this app,
 * gated on `PortalRuntimeState.demoMode`. Two surfaces render it, and there
 * is deliberately no second copy of this state machine anywhere:
 *
 *   - `/preview/portal/demo` (src/routes/preview.portal.demo.tsx) -- the
 *     prospect-facing demo, fed a localStorage snapshot of an unsaved config.
 *     Passes no campaign/post-login props: a demo session has no real
 *     campaigns or post-login page to light up.
 *   - `/preview/portal/$locationId` (src/routes/preview.portal.$locationId.tsx)
 *     -- a REAL customer's own preview, when the operator opts into "Run guest
 *     walkthrough". Passes that location's real active campaign and its real
 *     `config.postLoginHtml`/`redirectUrl`, so the walkthrough shows what
 *     *this venue's* guests get, not a generic demo seed.
 *
 * It reads the runtime's `session` and steps through the same arc a real
 * guest takes, keeping everything inside the caller's OWN provider -- it
 * never touches a real `/portal/*` route and never writes a row anywhere:
 *
 *   1. SIGN IN -- the real `GuestSignInCard`, which already owns the
 *      content/intro two-step (`contentMode` image/text/redirect ->
 *      Continue -> sign-in) and, in `demoMode`, runs the DUMMY OTP/password
 *      flow (see `useGuestSignIn`): no `requestOtp`, no `loginWithOtp`, no
 *      `recordConsent`, no navigation. VOUCHER is in that step too, and is
 *      the reason a voucher-only venue has a walkthrough at all: its form
 *      is the real `VoucherForm`, opened INLINE inside this same provider
 *      rather than by following the `/portal/auth/voucher` link a real
 *      guest follows (see `AuthTabSwitcher`'s `VoucherAffordance` and
 *      `useGuestSignIn`'s voucher-step block). No `loginWithVoucher`, so
 *      no voucher is checked, redeemed or marked used.
 *   2. CAMPAIGN -- the real `CampaignOverlay`, if the caller handed one over.
 *      Placed AFTER sign-in, not before it, because that is where a real
 *      guest meets it (`portal.session.tsx` resolves it post-login from a
 *      real session id). `CampaignOverlay` suppresses its impression and
 *      survey-response writes under `demoMode` -- see its `isSimulated`.
 *   3. CONNECTED -- the self-contained `DemoConnectedCard` below, from the
 *      fake in-memory session. No query, no NAS POST, no navigation.
 *   4. POST-LOGIN -- the venue's own `postLoginHtml` in the real
 *      `PostLoginHtmlFrame`, plus its `redirectUrl` as an explicit link.
 *      Deliberately NOT `/portal/redirect` itself: that route auto-navigates
 *      `window.location.href` to the venue's URL on a five-second timer,
 *      which would yank the operator's dashboard tab away mid-demo. The
 *      frame and the affordance are the real components; only the timer is
 *      dropped.
 *
 * Every step is restartable from the connected/post-login card ("Start
 * over"), and each carries an on-screen note that this is a demonstration.
 */
export function DemoPortalFlow({
  campaign = null,
  postLoginHtml = null,
  redirectUrl = null,
  constrained = false,
}: {
  /** This location's real currently-active campaign, as
   * `campaignService.resolveActivePreviewCampaign` resolves it. `null` (the
   * default) simply skips step 2. */
  campaign?: NextCampaign | null;
  /** The venue's real `config.postLoginHtml`. `null`/blank skips the frame. */
  postLoginHtml?: string | null;
  /** The venue's real `config.redirectUrl` (or a `dst`). `null` skips the
   * "Continue" affordance. With neither this nor `postLoginHtml`, step 4
   * does not exist and the walkthrough rests on the connected card. */
  redirectUrl?: string | null;
  /** Threaded to `PortalShell`/`CampaignOverlay` so their backdrops stay
   * `absolute` inside a preview bezel instead of escaping to the viewport.
   * This component owns the shell for its own steps because `CampaignOverlay`
   * brings its own -- a caller must NOT wrap this in a second `PortalShell`. */
  constrained?: boolean;
} = {}) {
  const { session, setSession, setGuestIdentifier } = usePortalRuntime();
  const [campaignDone, setCampaignDone] = useState(false);
  const [atPostLogin, setAtPostLogin] = useState(false);

  // Always begin a walkthrough at the sign-in step. `setSession` persists to
  // sessionStorage, so a fake session left by a previous run in this browser
  // would otherwise open straight onto the connected screen.
  // One-shot on mount only -- a session the prospect sets during THIS run
  // (after mount) is untouched, so this never fights the live flow.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (session) {
      setSession(undefined);
      setGuestIdentifier(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ...and leave nothing behind on the way out. The fake session is written
  // to the SAME `cloudguest_portal_session` key the real guest portal reads
  // (`/portal/*` is the same origin as this dashboard), so a walkthrough that
  // exits without clearing it leaves a "demo-session" sitting in this tab for
  // `/portal/session` to pick up. Storage-only side effect -- nothing here
  // ever reached a backend to begin with.
  useEffect(() => {
    return () => {
      setSession(undefined);
      setGuestIdentifier(undefined);
    };
  }, [setSession, setGuestIdentifier]);

  const restart = () => {
    setSession(undefined);
    setGuestIdentifier(undefined);
    setCampaignDone(false);
    setAtPostLogin(false);
  };

  // Same "an admin created a SURVEY with zero questions / a BANNER with no
  // asset" guard `portal.session.tsx` applies before mounting the overlay.
  const showCampaign = !!campaign && campaignHasRenderableContent(campaign) && !campaignDone;
  const venueHtml = hasPostLoginHtml(postLoginHtml) ? postLoginHtml : null;
  const safeRedirectUrl =
    redirectUrl && /^https?:\/\//i.test(redirectUrl.trim()) ? redirectUrl.trim() : null;
  const hasPostLoginStep = !!venueHtml || !!safeRedirectUrl;

  if (!session) {
    return (
      <PortalShell constrained={constrained}>
        <GuestSignInCard />
      </PortalShell>
    );
  }

  if (showCampaign && campaign) {
    // `CampaignOverlay` brings its own `PortalShell`.
    return (
      <CampaignOverlay
        campaign={campaign}
        // Never a real `GuestSession.id` -- and never sent anywhere either,
        // since `demoMode` suppresses both campaign writes. See its
        // `isSimulated`.
        sessionId="demo-session"
        constrained={constrained}
        onDone={() => setCampaignDone(true)}
      />
    );
  }

  if (atPostLogin && hasPostLoginStep) {
    return (
      <PortalShell constrained={constrained}>
        <DemoPostLoginCard html={venueHtml} url={safeRedirectUrl} onRestart={restart} />
      </PortalShell>
    );
  }

  return (
    <PortalShell constrained={constrained}>
      <DemoConnectedCard
        onContinue={hasPostLoginStep ? () => setAtPostLogin(true) : undefined}
        onRestart={restart}
      />
    </PortalShell>
  );
}

/** A demo-only "you're connected" illustration -- a lightweight sibling of
 * `portal.session.tsx`'s `ConnectedIllustration` (which is not exported), in
 * the same filled-flat-shape / venue-agnostic palette: a device, a signal
 * fan, and a green verified badge. Static (no motion dependency) -- it is
 * seen once, on a demo. */
function DemoConnectedIllustration({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 130" className={className} fill="none">
      <ellipse cx="100" cy="112" rx="66" ry="6" fill="#4338ca" opacity="0.06" />
      {/* Signal fan */}
      {[16, 28, 40].map((r, i) => (
        <path
          key={r}
          d={`M52 ${72 - r} A${r} ${r} 0 0 1 ${52 + r} 72`}
          stroke={["#a5b4fc", "#818cf8", "#6366f1"][i]}
          strokeOpacity={0.8 - i * 0.15}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      {/* Access point */}
      <rect x="26" y="82" width="52" height="26" rx="8" fill="#4338ca" />
      <rect x="26" y="82" width="52" height="26" rx="8" fill="#7c3aed" opacity="0.15" />
      <circle cx="52" cy="95" r="2.6" fill="#22d3ee" />
      {/* Guest device */}
      <rect
        x="120"
        y="20"
        width="40"
        height="60"
        rx="10"
        fill="white"
        stroke="#a78bfa"
        strokeWidth="1.8"
      />
      <rect x="126" y="28" width="28" height="44" rx="4" fill="#eef2ff" />
      {/* Verified badge */}
      <g>
        <circle cx="156" cy="72" r="13" fill="#10b981" stroke="white" strokeWidth="3" />
        <path
          d="M150 72l4 4l8-9"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

function StartOverButton({ onRestart }: { onRestart: () => void }) {
  return (
    <button
      type="button"
      onClick={onRestart}
      className={cn(PG_SECONDARY_BTN, "flex items-center justify-center gap-2")}
    >
      <RotateCcw className="h-4 w-4" /> Start over
    </button>
  );
}

/**
 * The walkthrough's self-contained "You're connected" screen. Deliberately
 * reuses the visual language of `portal.session.tsx` (the real resting page)
 * -- `PortalTextPlate` hero, `PortalCard` rows -- but renders entirely from
 * the fake in-memory session, with no `useQuery`, no navigation, and no
 * hotspot/NAS POST.
 *
 * `onContinue` mirrors that real page's own `continueUrl` button (which
 * navigates a guest to `/portal/redirect`): present only when the venue
 * actually has a post-login page and/or a redirect target configured.
 */
function DemoConnectedCard({
  onContinue,
  onRestart,
}: {
  onContinue?: () => void;
  onRestart: () => void;
}) {
  const { t, session } = usePortalRuntime();

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="mx-auto w-fit max-w-full text-center">
        <PortalTextPlate>
          <DemoConnectedIllustration className="mx-auto h-28 w-auto sm:h-32" />
          <h1 className="pg-title mt-3 text-[var(--pg-ink)]">{t("connectedTitle")}</h1>
          <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">{t("connectedSubtitle")}</p>
        </PortalTextPlate>
      </div>

      <PortalCard className="p-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="pg-body font-semibold text-[var(--pg-ink)]">
              {session?.deviceName ?? t("device")}
            </p>
            <p className="truncate pg-meta font-normal text-[var(--pg-ink-muted)]">
              {session?.identifier}
            </p>
          </div>
        </div>
      </PortalCard>

      {/* An honest "this was a demo" note -- a prospect should never think a
       * real connection was made.
       *
       * It names the method that actually got here, because the generic
       * line was written when only OTP and password could: "no code was
       * actually sent" is true of a voucher redemption in the narrow sense
       * that nothing was sent anywhere, but it answers a question a
       * voucher guest never asked and leaves the one they DID ask -- was a
       * real voucher just consumed? -- unanswered on the one screen that
       * appears immediately after they typed one in. */}
      <DemoNotice>
        {session?.authMethod === "voucher"
          ? "This is a demonstration of the guest sign-in flow. The code entered was not checked against any real voucher, nothing was redeemed or marked as used, no session was created, and no device was connected to any network."
          : "This is a demonstration of the guest sign-in flow. No code was actually sent, no session was created, and no device was connected to any network."}
      </DemoNotice>

      {onContinue && (
        <button type="button" onClick={onContinue} className={PG_PRIMARY_BTN}>
          {t("continue")}
        </button>
      )}

      <StartOverButton onRestart={onRestart} />
    </div>
  );
}

/**
 * Step 4 -- what the venue itself has configured to appear once a guest is
 * through: their own authored page (`config.postLoginHtml`) and/or their
 * configured post-login destination (`config.redirectUrl`).
 *
 * `PostLoginHtmlFrame` is the REAL component `/portal/redirect` uses, with
 * the same script-less opaque-origin sandbox -- the venue's HTML never
 * touches this document, which matters just as much on a dashboard-side
 * preview as it does on the guest surface.
 *
 * The destination is an ordinary `target="_blank"` anchor, exactly as
 * `/portal/redirect` renders it when a post-login page is present. What is
 * NOT reproduced is that route's five-second `window.location.href` timer:
 * on the guest surface it moves a captive-portal sheet along, but here it
 * would navigate the operator's own dashboard tab away to the venue's
 * website in the middle of a demo. The caption says so rather than pretending
 * the timer does not exist.
 */
function DemoPostLoginCard({
  html,
  url,
  onRestart,
}: {
  html: string | null;
  url: string | null;
  onRestart: () => void;
}) {
  const { t } = usePortalRuntime();

  let host = url ?? "";
  if (url) {
    try {
      host = new URL(url).hostname;
    } catch {
      /* keep the raw value -- `url` already passed the http(s) scheme test */
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {html && (
        <PostLoginHtmlFrame
          html={html}
          title={t("postLoginPageLabel")}
          className={url ? "h-[52vh] min-h-[240px]" : "h-[62vh] min-h-[300px]"}
        />
      )}

      {url && (
        <a
          href={url}
          title={url}
          target="_blank"
          rel="noreferrer"
          className={`${PG_PRIMARY_BTN} flex items-center justify-center gap-2`}
        >
          {t("continueNowLabel")} <ExternalLink className="h-4 w-4" />
        </a>
      )}

      <DemoNotice>
        {html
          ? "This is the page you published for guests to see after they sign in."
          : "After signing in, guests are sent on to your configured destination."}
        {url ? ` In a real session they continue to ${host}.` : ""} Still a demonstration -- no
        session was created and nothing was recorded.
      </DemoNotice>

      <StartOverButton onRestart={onRestart} />
    </div>
  );
}
