/**
 * The decision layer behind everything `/portal/session` asks a guest for
 * AFTER the RADIUS session is already authorised: the profile card, the
 * Google review card, and the private star-feedback card.
 *
 * It lives in its own dependency-free module for three reasons.
 *
 * 1. **It is the part that has to be right.** The rules here are not
 *    styling; they are the compliance surface. "The Google ask comes
 *    before any sentiment is collected" and "a rating prompt never renders
 *    on the same screen as a review link" are claims a regulator or a
 *    customer's lawyer would read the source to check. A reviewer can read
 *    `resolvePostConnectAsk` end to end and see that its inputs contain no
 *    rating, response or feedback value at all -- there is no variable to
 *    select on, so selective solicitation is impossible here rather than
 *    merely absent.
 * 2. **It is testable without a browser.** This repo has no test runner
 *    (see `scripts/ci-gated-test.sh`); zero imports means
 *    `scripts/test-portal-post-connect-asks.mjs` can bundle this file with
 *    esbuild and assert against the real rules rather than a
 *    reimplementation of them.
 * 3. **It touches no storage.** Every rule below is a function of the
 *    resolved venue config, the server-owned session, and the clock.
 *    Nothing reads `localStorage`. Inside Apple's Captive Network
 *    Assistant Web Storage *throws* rather than returning null
 *    (docs/captive-portal-v7-design-spec.md §0.2), and a storage read on
 *    this surface has already taken hydration down once -- see
 *    `scripts/test-portal-cna-storage-safety.mjs`.
 *
 * ⚠ A LIMIT OF THIS WHOLE SURFACE, stated here because it is easy to
 * forget: iOS guests are handed off to `captive.apple.com` on success so
 * the CNA dismisses itself, which means a large share of guests never load
 * `/portal/session` at all and never see any of these cards. Nothing here
 * assumes otherwise -- every rule is "if this page renders", never "each
 * guest will be asked once". Any counter built on these cards measures
 * guests who reached the page, not guests who connected.
 */

/** The one email rule, deliberately permissive.
 *
 * Every stricter regex rejects real addresses, and the value is confirmed
 * by a later delivery attempt, not by a pattern. This exists to catch
 * "priya@gmail" and a fat-fingered space -- not to adjudicate RFC 5322. */
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function isValidGuestEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** The "taking longer than expected" threshold, shared with
 * `portal.success.tsx`'s own slow/stuck notice rather than re-picked per
 * surface: a guest watching a spinner on a captive portal assumes the WiFi
 * failed, and the two screens that can show them one should agree about
 * when to say otherwise. */
export const PORTAL_SLOW_NOTICE_DELAY_MS = 4_000;

/** How many times a failed profile save retries itself before the card
 * gives up and shows the guest a banner. Deliberately small: the venue
 * would rather have no record than one written four minutes later against
 * a session the guest has already left. */
export const PROFILE_SAVE_MAX_RETRIES = 2;

/** Backoff between those retries. */
export const PROFILE_SAVE_RETRY_DELAY_MS = [800, 2_400];

/** Default dwell before the private star-feedback card may render.
 *
 * 25 minutes is a coffee. The number matters less than the direction: the
 * prompt used to fire on arrival and ask "how was your visit?" about a
 * visit ninety seconds old, which measures a moment that has not happened
 * yet. */
export const DEFAULT_FEEDBACK_DWELL_MINUTES = 25;

/** A floor, never zero -- a venue that could set this to 0 would be back
 * to asking on arrival, which is the defect this gate exists to remove. */
export const MIN_FEEDBACK_DWELL_MINUTES = 5;

export function clampFeedbackDwellMinutes(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return DEFAULT_FEEDBACK_DWELL_MINUTES;
  return Math.max(MIN_FEEDBACK_DWELL_MINUTES, Math.round(v));
}

/** Minutes the guest has been connected, from the server-issued
 * `RuntimeSession.startedAt`. Returns 0 -- never a negative number and
 * never `NaN` -- for an unparseable or future timestamp, so a clock skew
 * can only ever delay the card, never bring it forward. */
export function dwellMinutes(startedAt: string | null | undefined, now: number): number {
  if (!startedAt) return 0;
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, (now - started) / 60_000);
}

/**
 * A venue pastes its own review link (Business Profile → Read reviews →
 * Get more reviews), and it is stored and used verbatim -- never
 * synthesised from a place id, because neither `g.page/r/…` nor
 * `search.google.com/local/writereview?placeid=` is a documented stable
 * contract.
 *
 * This check is a safety guard on a value that reaches a navigation sink,
 * exactly like `CampaignOverlay.openBanner`'s scheme check on an
 * operator-authored `clickUrl`: `https` only (so a `javascript:` or
 * `data:` value can never execute), and a Google-owned host (so a
 * mis-pasted link cannot quietly turn the venue's review card into a
 * redirect to somewhere else). It is not a validity check -- the backend
 * validates on write; this is the last line before `href`.
 */
export function isSafeGoogleReviewUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return (
    host === "g.page" ||
    host === "goo.gl" ||
    host === "maps.app.goo.gl" ||
    host === "google.com" ||
    host.endsWith(".google.com") ||
    /(^|\.)google\.[a-z.]{2,}$/.test(host)
  );
}

/** The subset of the resolved venue config these rules read. Narrow on
 * purpose: it is what makes the module testable, and it documents that
 * nothing here consults branding, auth methods or campaign content. */
export interface PostConnectConfigInput {
  collectGuestName: boolean;
  collectGuestEmail: boolean;
  reviewUrl: string | null;
  reviewCardEnabled: boolean;
  guestFeedbackEnabled: boolean;
  feedbackDwellMinutes: number;
}

/** The subset of the server-owned session these rules read. Note what is
 * NOT here: no rating, no response, no sentiment of any kind. */
export interface PostConnectSessionInput {
  startedAt: string;
  hasProfile: boolean;
  hasOpenedReviewLink: boolean;
}

/** Does the venue collect anything, and has this guest not already
 * answered?
 *
 * `hasProfile` is the server bit -- true once the guest has given a name
 * or an email, OR explicitly declined. It replaces two things that were
 * both wrong:
 *
 *   - `isNewGuest`, which meant a venue enabling the feature in October
 *     could never ask its existing thousands, and
 *   - a `localStorage` flag, which throws inside the CNA and so returned
 *     "not asked yet" every single time on the platform where the
 *     environment is worst. An iPhone guest who typed their name and was
 *     bounced back here by the NAS was asked for it again.
 */
export function profileCardEligible(
  config: PostConnectConfigInput,
  session: PostConnectSessionInput,
): boolean {
  const collectsSomething = config.collectGuestName || config.collectGuestEmail;
  return collectsSomething && !session.hasProfile;
}

/**
 * The Google review card renders for a venue that has BOTH switched the
 * card on and pasted a usable link, to a guest who has not already opened
 * it.
 *
 * **Both, not either.** This used to read the URL alone and treat its
 * presence as the on switch, which quietly made "pause the ask" and
 * "delete the link" the same gesture -- a venue pausing for a
 * refurbishment had to throw away a link they would then have to find
 * again in Business Profile, and a venue that cleared the switch would
 * have kept being asked about anyway. `review_card_enabled` is the
 * venue's intent; `review_url` is the material. Neither implies the
 * other, and the editor shows them together for that reason.
 *
 * There is deliberately no condition beyond those two and the tap. It is
 * identical for every guest, it is never a precondition for anything, and
 * -- the point of the ordering -- it is decided before the product holds
 * any sentiment signal about this guest whatsoever.
 *
 * ⚠ The 90-day / three-times-ever frequency rule is NOT implemented here,
 * and must not be faked client-side. It needs a per-guest impression
 * ledger (`shown_count`, `last_shown_at`, `tapped_at` -- the shape
 * `CampaignImpression` already models) which is server-side work. Until
 * that lands the honest client-side rule is the one below: show it, and
 * stop permanently once tapped. Frequency is a product constant, never a
 * venue setting -- a venue that could set it to "every login" would be
 * building the unusual-volume fingerprint that gets its own Business
 * Profile actioned.
 */
export function reviewCardEligible(
  config: PostConnectConfigInput,
  session: PostConnectSessionInput,
): boolean {
  return (
    config.reviewCardEnabled &&
    isSafeGoogleReviewUrl(config.reviewUrl) &&
    !session.hasOpenedReviewLink
  );
}

/** Minimal campaign shape -- matches `NextCampaign` structurally without
 * importing it, so this module keeps its zero-import property. */
export interface StarFeedbackCampaignInput {
  campaignType: string;
  questions: { answerType: string }[];
}

/**
 * Is this campaign the "how was your visit?" star prompt, as opposed to a
 * real multi-question survey?
 *
 * Only the star-prompt shape moves to the inline card: exactly one
 * `rating_5` question, with at most an optional free-text box beside it.
 * Anything else -- a genuine survey with choices, a banner, a redirect --
 * keeps today's full-screen takeover on arrival, which is the right
 * surface for content a venue authored to be read.
 */
export function isStarFeedbackCampaign(campaign: StarFeedbackCampaignInput): boolean {
  if (campaign.campaignType !== "survey") return false;
  const ratings = campaign.questions.filter((q) => q.answerType === "rating_5");
  if (ratings.length !== 1) return false;
  return campaign.questions.every(
    (q) => q.answerType === "rating_5" || q.answerType === "free_text",
  );
}

export type PostConnectAsk = "profile" | "review" | "feedback" | null;

export interface PostConnectAskInput {
  config: PostConnectConfigInput;
  session: PostConnectSessionInput;
  /** `Date.now()`, passed in so the rule is a pure function of its
   * arguments and the dwell gate can be tested without faking a clock. */
  now: number;
  /** Component state on the session page -- never persisted. If it is lost
   * to a reload, the dwell gate and the arrival-only rule still keep the
   * two apart on their own. Belt and braces, no storage. */
  reviewCardShownThisSession: boolean;
  /** Whether a `rating_5` campaign is eligible *server-side* right now.
   * The venue's own `display_rule` still decides frequency; this gate only
   * decides the moment within a session. */
  starCampaignAvailable: boolean;
  /** True once the guest has answered or dismissed whichever card won the
   * arrival slot. The slot then stays CLOSED -- it does not promote the
   * runner-up. A guest who declines the profile card must see a session
   * page identical to a guest whose venue never turned any of this on;
   * swapping in the Google card the instant they say "not now" is a wall
   * of requests, which is the impression this whole design exists to
   * avoid. Component state, never persisted. */
  arrivalAskSettled?: boolean;
  /** Same, for the later slot. */
  feedbackSettled?: boolean;
}

/**
 * Which single ask -- if any -- `/portal/session` may render right now.
 *
 * **At most one.** Each card costs a guest a decision; two stacked asks do
 * not double the yield, they read as a wall of requests on a network the
 * guest was told was free.
 *
 * Arrival (dwell below the threshold):
 *   1. profile  -- asked once ever, so it must not be crowded out
 *   2. review   -- asked rarely, and before any sentiment exists
 *   3. nothing
 *
 * Later (dwell past the threshold):
 *   1. feedback -- but never in a session where the review card has shown
 *   2. nothing
 *
 * The mutual exclusion between the review card and the star card is the
 * load-bearing invariant: **they must never share a screen, and never
 * share a visit.** The reverse suppression is unnecessary -- the dwell
 * gate means the feedback card cannot appear on an arrival view, and the
 * review card only ever appears on an arrival view.
 */
export function resolvePostConnectAsk(input: PostConnectAskInput): PostConnectAsk {
  const { config, session, now } = input;
  const dwell = dwellMinutes(session.startedAt, now);
  const threshold = clampFeedbackDwellMinutes(config.feedbackDwellMinutes);

  if (dwell >= threshold) {
    // The profile ask outranks the star card here for the same reason it
    // outranks the review card on arrival: it is asked ONCE EVER, so it
    // must not be crowded out. It also stops a card being swapped out from
    // under a guest who is still typing their name when the dwell
    // threshold happens to pass.
    if (!input.arrivalAskSettled && profileCardEligible(config, session)) return "profile";
    const feedbackOk =
      config.guestFeedbackEnabled &&
      input.starCampaignAvailable &&
      !input.reviewCardShownThisSession &&
      !input.feedbackSettled;
    return feedbackOk ? "feedback" : null;
  }

  if (input.arrivalAskSettled) return null;
  if (profileCardEligible(config, session)) return "profile";
  // NOTE the asymmetry, and that it is deliberate: the review card is
  // reachable ONLY from this arrival branch. That is what makes "the Google
  // card only ever appears on an arrival view" true by construction, which
  // in turn is why the reverse suppression (star card suppressing the
  // Google card) is unnecessary rather than merely omitted.
  if (reviewCardEligible(config, session)) return "review";
  return null;
}

/** How many separate things a venue's current settings ask a guest for
 * after they connect. Name and email count as ONE -- they share a card.
 *
 * This is the honest cost display for the dashboard: it is a count of the
 * venue's own settings, not an estimate of anything, so it is present at
 * the moment of the decision and it cannot be wrong. */
export function countPostConnectAsks(flags: {
  collectGuestName: boolean;
  collectGuestEmail: boolean;
  /** The review card as the GUEST would meet it: the switch on AND a
   * usable link behind it. Counting the switch alone would tell a venue
   * they are making three asks when the third one cannot render, which is
   * the opposite of what this meter is for. */
  reviewCardEnabled: boolean;
  guestFeedbackEnabled: boolean;
  dishRatingsEnabled: boolean;
}): number {
  return (
    (flags.collectGuestName || flags.collectGuestEmail ? 1 : 0) +
    (flags.reviewCardEnabled ? 1 : 0) +
    (flags.guestFeedbackEnabled ? 1 : 0) +
    (flags.dishRatingsEnabled ? 1 : 0)
  );
}

export const MAX_POST_CONNECT_ASKS = 4;
