import { useMemo, useState } from "react";
import { Laptop, Users2, ChevronRight } from "lucide-react";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { GuestProfileNudge } from "@/components/portal-runtime/GuestProfileNudge";
import { GoogleReviewNudge } from "@/components/portal-runtime/GoogleReviewNudge";
import { GuestFeedbackNudge } from "@/components/portal-runtime/GuestFeedbackNudge";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { DEFAULT_FEEDBACK_DWELL_MINUTES, resolvePostConnectAsk } from "@/lib/portal-post-connect";
import type { NextCampaign } from "@/types/campaign";
import type { RuntimeSession } from "@/types/portal-runtime";

/**
 * The `Connected` tab of the dashboard's Live Preview -- what a guest sees
 * on `/portal/session` under the venue's current, unsaved settings.
 *
 * ═══ WHY THIS EXISTS AT ALL ═══
 *
 * The Live Preview rendered `GuestSignInCard`, the sign-in screen, and
 * nothing else. Every setting on the "After they connect" card affects
 * `/portal/session`, which the preview never rendered. A venue owner could
 * flip five switches, watch a phone mockup show a sign-in card that did not
 * change once, and press Save with no idea what they had done to their
 * guests. That is the difference between an editor and a settings list.
 *
 * ═══ THE MUTUAL-EXCLUSION RULES ARE NOT SIMULATED AWAY ═══
 *
 * This runs the REAL `resolvePostConnectAsk`, so the preview shows what a
 * guest actually sees: **one ask per screen**, never all of them stacked. A
 * preview showing four cards at once would teach the venue a picture of
 * their portal that no guest will ever see, and would make the ask-budget
 * meter next to it look like scaremongering. To see the others, the
 * operator switches which guest they are looking at -- honestly, one at a
 * time, exactly as the guest-side rules would produce them.
 *
 * ⚠ Coverage caveat, deliberately visible: a guest on iOS is handed off to
 * `captive.apple.com` on success so the Captive Network Assistant
 * dismisses, which means they never load `/portal/session` and never see
 * ANY of this. Nothing here pretends otherwise -- the surrounding card says
 * so in the operator's own language.
 */

/** Which guest the operator is looking at. Not a simulation knob -- each
 * one is a real state a real guest is in, and the card that renders is the
 * one the shared resolver picks for that state. */
export type ConnectedPreviewScenario = "first_visit" | "returning" | "dwell";

/** A believable but obviously synthetic session. Every id is a literal
 * placeholder, and both `GuestProfileNudge` and `GoogleReviewNudge` refuse
 * to write anything or persist a session while `previewMode` is set -- see
 * their `isSimulated` guards. */
function buildPreviewSession(scenario: ConnectedPreviewScenario): RuntimeSession {
  const startedAt = new Date(
    // "30 minutes in" is expressed as a real timestamp rather than a flag,
    // so the preview clears the same dwell gate by the same comparison a
    // guest's phone does.
    Date.now() - (scenario === "dwell" ? (DEFAULT_FEEDBACK_DWELL_MINUTES + 5) * 60_000 : 90_000),
  ).toISOString();
  return {
    guestId: "preview-guest",
    identifier: "+91 90000 00000",
    sessionId: "preview",
    deviceId: "preview-device",
    routerId: "preview",
    locationId: "preview",
    organizationId: "preview",
    authMethod: "otp_sms",
    status: "active",
    startedAt,
    endedAt: null,
    lastActivityAt: startedAt,
    ipAddress: "192.0.2.10",
    bytesUploaded: 0,
    bytesDownloaded: 0,
    dataLimitMb: null,
    sessionTimeoutMinutes: null,
    isNewGuest: scenario === "first_visit",
    deviceMacAddress: null,
    deviceName: "This device",
    hasPassword: false,
    // A returning guest has already answered the profile ask -- which is
    // exactly why the Google card is what they see instead, and why the
    // operator can watch the priority order work rather than being told
    // about it.
    hasProfile: scenario !== "first_visit",
    hasOpenedReviewLink: false,
  };
}

/** A stand-in for the venue's own `rating_5` campaign, used only to show
 * where the star card lands in the stack. It is never submitted: the card's
 * own `isSimulated` guard blocks every write. */
function buildPreviewStarCampaign(): NextCampaign {
  return {
    campaignId: "preview-campaign",
    campaignType: "survey",
    isSkippable: true,
    asset: null,
    questions: [
      {
        id: "preview-rating",
        orderIndex: 0,
        questionText: "How was your visit?",
        answerType: "rating_5",
        options: [],
        isRequired: false,
      },
      {
        id: "preview-comment",
        orderIndex: 1,
        questionText: "Anything to add?",
        answerType: "free_text",
        options: [],
        isRequired: false,
      },
    ],
  };
}

export function ConnectedPreview({ scenario }: { scenario: ConnectedPreviewScenario }) {
  const { t, config } = usePortalRuntime();
  const session = useMemo(() => buildPreviewSession(scenario), [scenario]);
  const starCampaign = useMemo(buildPreviewStarCampaign, []);
  const [settled, setSettled] = useState<{ arrival: boolean; feedback: boolean }>({
    arrival: false,
    feedback: false,
  });

  // Reset the dismissed state when the operator switches guest, otherwise
  // dismissing a card once would leave the preview permanently empty and
  // read as "my settings did nothing".
  const [lastScenario, setLastScenario] = useState(scenario);
  if (lastScenario !== scenario) {
    setLastScenario(scenario);
    setSettled({ arrival: false, feedback: false });
  }

  const ask = config
    ? resolvePostConnectAsk({
        config,
        session,
        now: Date.now(),
        reviewCardShownThisSession: false,
        // Only the "30 minutes in" guest has a campaign to answer, which is
        // the whole point of that scenario: the star prompt is not an
        // arrival card any more.
        starCampaignAvailable: config.guestFeedbackEnabled && scenario === "dwell",
        arrivalAskSettled: settled.arrival,
        feedbackSettled: settled.feedback,
      })
    : null;

  return (
    <PortalShell constrained>
      <div className="flex flex-1 flex-col gap-5">
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            <h1 className="pg-title text-[var(--pg-ink)]">{t("connectedTitle")}</h1>
            <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">{t("connectedSubtitle")}</p>
          </PortalTextPlate>
        </div>

        {ask === "profile" && (
          <GuestProfileNudge
            session={session}
            onResolved={() => setSettled((s) => ({ ...s, arrival: true }))}
          />
        )}
        {ask === "review" && (
          <GoogleReviewNudge
            session={session}
            onResolved={() => setSettled((s) => ({ ...s, arrival: true }))}
          />
        )}
        {ask === "feedback" && (
          <GuestFeedbackNudge
            campaign={starCampaign}
            sessionId={session.sessionId}
            onResolved={() => setSettled((s) => ({ ...s, feedback: true }))}
          />
        )}

        {/* The rest of the stack, in the order a guest meets it. These are
            utilities, not asks, and they always render. */}
        <PortalCard className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="pg-micro uppercase tracking-[0.08em] text-[var(--pg-ink-faint)]">
              {t("sessionRemaining")}
            </span>
            <span className="text-[length:calc(1.75rem*var(--pg-type-scale,1))] font-bold tabular-nums text-[var(--pg-ink)]">
              {t("noExpiryLabel")}
            </span>
          </div>
        </PortalCard>

        <PortalCard className="p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
              <Laptop className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="pg-body font-semibold text-[var(--pg-ink)]">{session.deviceName}</p>
              <p className="truncate pg-meta font-normal text-[var(--pg-ink-muted)]">
                {session.ipAddress}
              </p>
            </div>
          </div>
        </PortalCard>

        <PortalCard className="p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
              <Users2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="pg-body font-semibold text-[var(--pg-ink)]">{t("nudgeTeamTitle")}</p>
              <p className="truncate pg-meta font-normal text-[var(--pg-ink-muted)]">
                {t("nudgeTeamSubtitle")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--pg-ink-faint)]" />
          </div>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
