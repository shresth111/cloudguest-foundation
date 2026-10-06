/**
 * The venue's ordered post-login SEQUENCE -- what a guest is shown, in what
 * order, after the gate has opened, and where they end up.
 *
 * Backend: `captive_portal_configs.post_login_sequence`
 * (`{ steps: ("survey" | "offer" | "page")[], finish: "connected" | "redirect" }`,
 * migration 0148). Owner QA, 2026-10-06: "after survey get discount/image,
 * after that redirect" -- the old editor offered ONE of three exclusive
 * destinations (connected page / website / custom page) and showed at most
 * one Login Page Offers campaign, so "survey, then offer, then website" was
 * not expressible.
 *
 * Steps:
 *   - `survey` -- the venue's eligible Login Page Offers SURVEY campaigns
 *                 (the one-question star prompt is excluded: it stays the
 *                 dwell-gated inline card on the connected page)
 *   - `offer`  -- its eligible banner / discount campaigns
 *   - `page`   -- the venue's own post-login HTML page
 * A campaign step with nothing eligible for this guest right now is
 * skipped; it is not an error.
 *
 * NULL / absent sequence = "never configured": derived from the old single
 * choice so no existing venue's guests see a different flow (see
 * `deriveLegacySequence`).
 *
 * This module only decides WHAT runs and in what order. Rendering is
 * `PostLoginSequenceRunner`, which takes the resolved steps as props and is
 * deliberately not tied to `/portal/session`, so the same executor can run
 * from a pre-gate phase as well.
 */

import { hasPostLoginHtml } from "@/lib/post-login-html";
import {
  isCaptiveProbeUrl,
  isSafeRedirectTarget,
  type PostLoginDestination,
} from "@/lib/portal-post-login";

export const POST_LOGIN_STEP_TYPES = ["survey", "offer", "page"] as const;
export type PostLoginStep = (typeof POST_LOGIN_STEP_TYPES)[number];
export type PostLoginFinish = "connected" | "redirect";

export interface PostLoginSequence {
  steps: PostLoginStep[];
  finish: PostLoginFinish;
}

/** Wire -> typed, dropping anything unknown or duplicated. Returns null for
 * an absent / malformed value, which means "derive the old single choice". */
export function toPostLoginSequence(raw: unknown): PostLoginSequence | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as { steps?: unknown; finish?: unknown };
  const steps: PostLoginStep[] = [];
  if (Array.isArray(src.steps)) {
    for (const s of src.steps) {
      if ((POST_LOGIN_STEP_TYPES as readonly string[]).includes(s as string)) {
        if (!steps.includes(s as PostLoginStep)) steps.push(s as PostLoginStep);
      }
    }
  }
  const finish: PostLoginFinish = src.finish === "redirect" ? "redirect" : "connected";
  return { steps, finish };
}

interface SequenceConfigInput {
  postLoginHtml: string | null;
  redirectUrl: string | null;
  postLoginSequence?: PostLoginSequence | null;
}

/**
 * The sequence a venue that never saved one is on -- exactly the single
 * choice it had before:
 *   - a post-login page set     -> [page], finish connected (the page is
 *                                  the resting page, as it always was)
 *   - a redirect URL set        -> [], finish redirect (straight there)
 *   - neither                   -> [survey, offer], finish connected (the
 *                                  connected page with its campaigns --
 *                                  now ALL eligible ones, survey first,
 *                                  rather than one picked by a tie-break)
 */
export function deriveLegacySequence(config: SequenceConfigInput): PostLoginSequence {
  if (hasPostLoginHtml(config.postLoginHtml)) return { steps: ["page"], finish: "connected" };
  if ((config.redirectUrl ?? "").trim()) return { steps: [], finish: "redirect" };
  return { steps: ["survey", "offer"], finish: "connected" };
}

export interface ResolvedPostLoginSequence {
  /** Steps that can run (a `page` step with no stored page is dropped). */
  steps: PostLoginStep[];
  finish: PostLoginFinish;
  /** The venue page, when a `page` step is present. */
  html: string | null;
  /** Safe http(s) destination for a `redirect` finish (a redirect finish
   * with no usable URL ends on the connected page). On a never-configured
   * page venue it is the old page's optional "Continue" link. */
  url: string | undefined;
  /** True when the venue's page is the LAST step and the finish is the
   * connected page: the page IS the resting page (with its session strip),
   * exactly as the old "custom HTML page" choice behaved. */
  pageIsResting: boolean;
  /** True when the sequence came from the stored value rather than being
   * derived from the old single choice. */
  configured: boolean;
}

export function resolvePostLoginSequence(
  config: SequenceConfigInput | null | undefined,
  destinationUrl?: string | null,
): ResolvedPostLoginSequence {
  const stored = config?.postLoginSequence ?? null;
  const base = config
    ? (stored ?? deriveLegacySequence(config))
    : { steps: [] as PostLoginStep[], finish: "connected" as PostLoginFinish };
  const html = hasPostLoginHtml(config?.postLoginHtml) ? config!.postLoginHtml : null;
  const steps = base.steps.filter((s) => s !== "page" || !!html);

  // Same precedence as the single-choice resolver for a redirect finish:
  // the guest's own pre-hotspot destination, unless it is an OS captive
  // probe, else the venue URL. A CONFIGURED sequence that finishes on the
  // connected page means the connected page -- the editor promises "no
  // redirect" for it. A never-configured venue keeps the old rule, where a
  // real pre-hotspot destination still won (unchanged behaviour).
  const guestUrl = destinationUrl && !isCaptiveProbeUrl(destinationUrl) ? destinationUrl : null;
  let finish = base.finish;
  let raw: string | null = null;
  if (finish === "redirect") raw = guestUrl || config?.redirectUrl || null;
  else if (!stored && !html && guestUrl) {
    raw = guestUrl;
    finish = "redirect";
  } else if (!stored && html) {
    // Legacy page venue: the page offered a "Continue" link to a URL when
    // one was known. Kept, as a link only -- the finish stays connected.
    raw = guestUrl || config?.redirectUrl || null;
  }
  const url = raw && isSafeRedirectTarget(raw) ? raw : undefined;
  if (finish === "redirect" && !url) finish = "connected";
  // Legacy rule kept: with no stored sequence, a real pre-hotspot URL
  // replaced the campaigns (they were only fetched in "default" mode).
  const legacyRedirect = !stored && finish === "redirect";

  const effectiveSteps = legacyRedirect ? [] : steps;
  return {
    steps: effectiveSteps,
    finish,
    html,
    url,
    pageIsResting:
      finish === "connected" &&
      effectiveSteps.length > 0 &&
      effectiveSteps[effectiveSteps.length - 1] === "page",
    configured: !!stored,
  };
}

/**
 * What the GATE handoff (`/portal/success`: RouterOS `dst`, the Omada /
 * Aruba direct target) should aim at -- in the vocabulary
 * `resolvePostLoginDestination` already speaks, so the gate code does not
 * change shape. A redirect finish may only be the gate's direct target when
 * NO step runs first; otherwise the guest must land on `/portal/session`,
 * which runs the steps and then redirects.
 */
export function gateDestinationForSequence(
  config: SequenceConfigInput | null | undefined,
  destinationUrl?: string | null,
): PostLoginDestination {
  const seq = resolvePostLoginSequence(config, destinationUrl);
  if (seq.finish === "redirect" && seq.url && seq.steps.length === 0) {
    return { mode: "redirect", html: null, url: seq.url };
  }
  return { mode: seq.pageIsResting ? "html" : "default", html: seq.html, url: undefined };
}

/** Campaign shapes the runner partitions -- structural, so this module does
 * not import the campaign service. */
export interface SequenceCampaignInput {
  campaignType: string;
}

/** Which step a served campaign belongs to: surveys -> `survey`, everything
 * else (banner, discount, redirect banner) -> `offer`. */
export function campaignStepOf(campaign: SequenceCampaignInput): "survey" | "offer" {
  return campaign.campaignType === "survey" ? "survey" : "offer";
}

/** Human labels for the editor; guest-facing copy lives in portal-i18n. */
export const POST_LOGIN_STEP_LABEL: Record<PostLoginStep, string> = {
  survey: "Survey",
  offer: "Offer / discount",
  page: "My custom page",
};
