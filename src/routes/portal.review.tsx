import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GoogleReviewPage } from "@/components/portal-runtime/GoogleReviewPage";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { buildSessionUrl } from "@/lib/portal-session-url";
import { isCaptiveNetworkAssistant } from "@/lib/portal-cna";
import {
  probeGoogleReachable,
  reviewContinueTarget,
  reviewPageDecision,
  withTimeout,
  type ReviewPageDecision,
} from "@/lib/portal-review-page";

export const Route = createFileRoute("/portal/review")({
  errorComponent: PortalErrorScreen,
  component: ReviewRoute,
});

/** How long the tap waits for `POST /guest/review-link-opened` before
 * following the link anyway. The record is worth a moment; it is never
 * worth the guest's tap. */
const RECORD_TAP_TIMEOUT_MS = 1_500;

/**
 * `/portal/review` -- the "Rate us on Google" page (SPEC google-review §5.1).
 *
 * Reached ONLY as the post-login destination `portal.success.tsx` picks
 * when `reviewPageEligible` holds (MikroTik `dst`, Omada assign, Aruba
 * `url`, already-authorized). It lands as a brand-new document after the
 * NAS / controller / AP opened the gate, so -- exactly like
 * `/portal/session` -- it re-finds the session with `checkActiveSession`
 * when storage gave it nothing (iOS's captive sheet throws on storage).
 *
 * The decision is made ONCE, when config and session are both known, and
 * then latched: recording "shown" flips `reviewPromptDue` to false, and
 * that must not bounce the guest off the page they are reading.
 *
 * Anything off -- the switch, the link, a non-due session, a `sid` that is
 * not this guest's live session -- continues immediately with
 * `location.replace`, rendering no CTA. A stale link can never strand a
 * guest.
 */
function ReviewRoute() {
  const {
    config,
    isLoading,
    session,
    setSession,
    setGuestIdentifier,
    organizationId,
    locationId,
    routerId,
    language,
    deviceMac,
    previewMode,
    demoMode,
  } = usePortalRuntime();
  const isSimulated = previewMode || demoMode;
  const sid =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sid") : null;

  const { data: liveSession, isFetched: liveChecked } = useQuery({
    queryKey: ["portal-active-session", routerId, deviceMac],
    queryFn: () => portalRuntimeService.checkActiveSession({ routerId, deviceMac: deviceMac! }),
    enabled: !session && !!deviceMac,
    staleTime: 0,
    retry: 3,
  });
  useEffect(() => {
    if (!liveSession) return;
    setSession(liveSession);
    setGuestIdentifier(liveSession.identifier);
  }, [liveSession, setSession, setGuestIdentifier]);

  const effectiveSession = session ?? liveSession ?? undefined;
  const sessionKnown = !!effectiveSession || !deviceMac || liveChecked;
  const ready = !isLoading && sessionKnown;

  const [decision, setDecision] = useState<ReviewPageDecision | null>(null);
  useEffect(() => {
    if (decision || !ready) return;
    setDecision(reviewPageDecision({ config, session: effectiveSession, sid }));
  }, [decision, ready, config, effectiveSession, sid]);

  const continueTarget = () =>
    reviewContinueTarget({
      config,
      inCaptiveSheet: isCaptiveNetworkAssistant(),
      sessionUrl: buildSessionUrl(organizationId, locationId, routerId, language, deviceMac),
      sessionId: effectiveSession?.sessionId,
    });

  // Not due: continue straight on, replacing this history entry so Back
  // does not return to a page with nothing on it.
  const continued = useRef(false);
  useEffect(() => {
    if (decision !== "continue" || continued.current) return;
    continued.current = true;
    window.location.replace(continueTarget());
  });

  // Shown: start the server's per-location cooldown. Fire-and-forget; and
  // never from the operator preview or the guest walkthrough.
  const recordedShown = useRef(false);
  useEffect(() => {
    if (decision !== "show" || recordedShown.current || !effectiveSession) return;
    recordedShown.current = true;
    if (isSimulated) return;
    portalRuntimeService
      .recordReviewPromptShown({
        guestId: effectiveSession.guestId,
        sessionId: effectiveSession.sessionId,
      })
      .catch(() => undefined);
    setSession({ ...effectiveSession, reviewPromptDue: false, reviewShownThisSession: true });
  }, [decision, effectiveSession, isSimulated, setSession]);

  if (decision !== "show" || !config?.reviewUrl || !effectiveSession) return null;
  const reviewUrl = config.reviewUrl;
  const guestId = effectiveSession.guestId;
  const sessionId = effectiveSession.sessionId;

  const onOpenReview = async (): Promise<boolean> => {
    if (isSimulated) return true;
    const reachable = await probeGoogleReachable(() => new Image());
    if (!reachable) return false;
    await withTimeout(
      portalRuntimeService.recordReviewLinkOpened({ guestId, sessionId }),
      RECORD_TAP_TIMEOUT_MS,
      undefined,
    );
    window.location.assign(reviewUrl);
    return true;
  };

  return (
    <GoogleReviewPage
      reviewUrl={reviewUrl}
      onOpenReview={onOpenReview}
      onContinue={() => {
        if (isSimulated) return;
        window.location.assign(continueTarget());
      }}
    />
  );
}
