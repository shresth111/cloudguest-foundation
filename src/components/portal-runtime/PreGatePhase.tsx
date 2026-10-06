import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalShell, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PortalConnectingState } from "@/components/portal-runtime/PortalGuestUi";
import {
  CampaignOverlay,
  campaignHasRenderableContent,
} from "@/components/portal-runtime/CampaignOverlay";
import { GuestProfileNudge } from "@/components/portal-runtime/GuestProfileNudge";
import { campaignPortalService } from "@/services/campaign-portal.service";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { isStarFeedbackCampaign, profileCardEligible } from "@/lib/portal-post-connect";
import {
  PRE_GATE_FETCH_TIMEOUT_MS,
  PRE_GATE_MAX_MS,
  resolvePreGateSteps,
  withTimeout,
  type PreGateStep,
} from "@/lib/portal-pre-gate";
import type { RuntimeSession } from "@/types/portal-runtime";
import type { NextCampaign } from "@/types/campaign";

/**
 * The runtime half of @/lib/portal-pre-gate: what `/portal/success` shows
 * between a verified sign-in and the NAS gate opening. Read that module's
 * docstring for WHY (Android's and iOS's sign-in sheets close themselves
 * the moment the gate opens, so arrival content after it is never seen).
 */

export interface PreGateResult {
  /** At least one step was rendered to the guest. `/portal/session` is
   * told so (the `pregate` URL marker) and does not ask again. */
  shown: boolean;
  /** A banner link the guest tapped before they were online. Opened once
   * the gate is open, in a real browser only. */
  clickUrl?: string;
}

export interface PreGatePlan {
  /** False while the next-offer lookup is in flight (bounded by
   * `PRE_GATE_FETCH_TIMEOUT_MS`). The gate waits for this, never longer. */
  ready: boolean;
  steps: PreGateStep[];
  campaign: NextCampaign | null;
}

/**
 * Decide what (if anything) runs before the gate. `skip` is the answer of
 * `preGateSkipReason` -- when set, nothing is fetched and the plan is
 * empty and ready immediately, so the gate opens exactly as it always did.
 */
export function usePreGatePlan(session: RuntimeSession | undefined, skip: boolean): PreGatePlan {
  const { config } = usePortalRuntime();
  const sessionId = session?.sessionId;
  const query = useQuery({
    // Its own key, not `/portal/session`'s `next-campaign`: the answer here
    // is "what to show before the gate", read once per sign-in.
    queryKey: ["pre-gate-campaign", sessionId],
    queryFn: () =>
      withTimeout(
        campaignPortalService.getNextCampaign(sessionId!),
        PRE_GATE_FETCH_TIMEOUT_MS,
        null as NextCampaign | null,
      ),
    enabled: !skip && !!sessionId,
    staleTime: Infinity,
    retry: false,
  });

  if (skip || !session) return { ready: true, steps: [], campaign: null };
  if (!query.isFetched) return { ready: false, steps: [], campaign: null };

  const fetched = query.data ?? null;
  // The one-question star prompt is dwell-gated ("how was your visit?"
  // after 25 minutes) and stays on the session page; every other
  // renderable offer/survey is arrival content and moves ahead of the gate.
  const campaign =
    fetched && !isStarFeedbackCampaign(fetched) && campaignHasRenderableContent(fetched)
      ? fetched
      : null;
  const steps = resolvePreGateSteps({
    campaignRenderable: !!campaign,
    profileEligible: !!config && profileCardEligible(config, session),
  });
  return { ready: true, steps, campaign };
}

export function PreGatePhase({
  steps,
  campaign,
  session,
  onFinished,
}: {
  steps: PreGateStep[];
  campaign: NextCampaign | null;
  session: RuntimeSession;
  onFinished: (result: PreGateResult) => void;
}) {
  const { t } = usePortalRuntime();
  // Frozen at mount: answering the profile card flips `hasProfile`, which
  // would otherwise remove the step from under the guest mid-sequence.
  const [plan] = useState(steps);
  const [index, setIndex] = useState(0);
  const clickUrl = useRef<string | undefined>(undefined);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinished({ shown: plan.length > 0, clickUrl: clickUrl.current });
  };

  // The hard ceiling (rule 2 in @/lib/portal-pre-gate): a guest who walks
  // away mid-survey still gets online.
  useEffect(() => {
    const id = window.setTimeout(finish, PRE_GATE_MAX_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (index >= plan.length) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, plan.length]);

  const next = () => setIndex((i) => i + 1);
  const step = plan[index];

  if (step === "campaign" && campaign) {
    return (
      <CampaignOverlay
        preGate
        campaign={campaign}
        sessionId={session.sessionId}
        onDone={(result) => {
          if (result?.clickUrl) clickUrl.current = result.clickUrl;
          next();
        }}
      />
    );
  }

  if (step === "profile") {
    return (
      <PortalShell showBrandPanel={false}>
        <div className="flex flex-1 flex-col justify-center gap-5">
          <div className="mx-auto w-fit max-w-full text-center">
            <PortalTextPlate>
              <p className="pg-meta text-[var(--pg-ink-muted)]">{t("preGateAlmostOnline")}</p>
            </PortalTextPlate>
          </div>
          <GuestProfileNudge session={session} onResolved={next} />
        </div>
      </PortalShell>
    );
  }

  // Between steps, and for the instant after the last one while the gate
  // starts opening: the same connecting visual the gate itself shows.
  return (
    <PortalShell showBrandPanel={false}>
      <PortalConnectingState />
    </PortalShell>
  );
}
