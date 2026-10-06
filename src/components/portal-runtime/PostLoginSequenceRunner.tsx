import { useEffect, useMemo, useState } from "react";
import { CampaignOverlay } from "@/components/portal-runtime/CampaignOverlay";
import { PostLoginHtmlFrame } from "@/components/portal-runtime/PostLoginHtmlFrame";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { SequenceItem } from "@/lib/portal-post-login-sequence-items";

/**
 * THE POST-LOGIN SEQUENCE EXECUTOR. Shows the venue's steps one screen at a
 * time, in order, and calls `onDone` once the last one is finished (or at
 * once, when nothing in the sequence applies to this guest).
 *
 * Deliberately route-agnostic: everything it needs arrives as props (the
 * steps, the campaign queue, the page, the session id the campaign writes
 * are keyed on), so it can run on `/portal/session` after the gate opens
 * -- where it runs today -- or from a pre-gate phase, without change.
 *
 * Every step is the guest's to finish or skip (campaigns keep their own
 * skip rules; the page has a Continue button). Nothing here can affect
 * whether the guest is online. Campaign impressions are recorded by
 * `CampaignOverlay` itself, server-side, so a reload does not replay a
 * campaign this session has already seen (the backend's queue excludes
 * it) -- no Web Storage, which throws inside Apple's CNA.
 */
export function PostLoginSequenceRunner({
  items,
  sessionId,
  onDone,
}: {
  items: SequenceItem[];
  sessionId: string;
  onDone: () => void;
}) {
  const { t } = usePortalRuntime();
  const [index, setIndex] = useState(0);
  const current = items[index];
  const finished = index >= items.length;

  useEffect(() => {
    if (finished) onDone();
    // `onDone` identity is the caller's; firing once per finish is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const next = useMemo(() => () => setIndex((i) => i + 1), []);

  if (finished || !current) return null;

  if (current.kind === "campaign") {
    return (
      <CampaignOverlay
        // A fresh overlay per campaign: its internal answer/skip state must
        // never carry over from the previous step.
        key={current.campaign.campaignId}
        campaign={current.campaign}
        sessionId={sessionId}
        onDone={next}
      />
    );
  }

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-4" data-testid="sequence-page-step">
        <PostLoginHtmlFrame
          html={current.html}
          title={t("postLoginPageLabel")}
          className="h-[68vh] min-h-[320px]"
        />
        <button type="button" onClick={next} className={PG_PRIMARY_BTN}>
          {t("continueCta")}
        </button>
      </div>
    </PortalShell>
  );
}
