import { campaignHasRenderableContent } from "@/lib/campaign-renderable";
import { isStarFeedbackCampaign } from "@/lib/portal-post-connect";
import { campaignStepOf, type PostLoginStep } from "@/lib/portal-post-login-sequence";
import type { NextCampaign } from "@/types/campaign";

/** One screen the runner will show, already expanded from the venue's
 * steps: a step can expand to several campaigns, or to nothing. */
export type SequenceItem =
  | { kind: "campaign"; step: "survey" | "offer"; campaign: NextCampaign }
  | { kind: "page"; html: string };

/**
 * Expand the venue's ordered steps into the concrete screens THIS guest
 * gets, in order. Pure -- exported for the regression suite.
 *
 *   - `survey` -> every renderable survey campaign in the queue, EXCEPT the
 *     one-question star prompt (that stays the dwell-gated inline card on
 *     the connected page: asking "how was your visit?" ninety seconds in
 *     measures nothing -- see `isStarFeedbackCampaign`)
 *   - `offer`  -> every renderable banner / discount / redirect-banner
 *   - `page`   -> the venue's page (dropped when there is none)
 *
 * The queue is in the backend's order; within a step that order is kept.
 * A step with nothing behind it yields nothing -- skipped, not an error.
 */
export function expandSequenceItems(
  steps: readonly PostLoginStep[],
  queue: readonly NextCampaign[],
  html: string | null,
): SequenceItem[] {
  const items: SequenceItem[] = [];
  for (const step of steps) {
    if (step === "page") {
      if (html) items.push({ kind: "page", html });
      continue;
    }
    for (const campaign of queue) {
      if (campaignStepOf(campaign) !== step) continue;
      if (isStarFeedbackCampaign(campaign)) continue;
      if (!campaignHasRenderableContent(campaign)) continue;
      items.push({ kind: "campaign", step, campaign });
    }
  }
  return items;
}
