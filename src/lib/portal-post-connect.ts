/**
 * The decision layer behind everything `/portal/session` asks a guest for
 * AFTER the RADIUS session is already authorised: the profile card and the
 * private star-feedback card. The Google review ask is no longer a card
 * here -- it is its own page, `/portal/review`, shown BEFORE this one (see
 * `src/routes/portal.review.tsx`). What this module still owns about it is
 * the link guard (`isSafeGoogleReviewUrl`) and the rule that a visit which
 * showed the review page never shows the star card (`reviewShownThisVisit`).
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
 * forget: guests who sign in inside iOS's Captive Network Assistant DO load
 * `/portal/session` (the portal no longer hands anyone to
 * `captive.apple.com`), but iOS closes the sheet on its own once its
 * captive re-probe passes through the open gate -- often before a guest can
 * interact -- so these cards are at their strongest for guests in a real
 * browser (Android, desktop, iOS Safari). Nothing here
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
 * The hosts a review link may live on -- an EXACT copy of the backend's
 * `REVIEW_URL_ALLOWED_HOST_SUFFIXES` (captive_portal/constants.py). Matched
 * as the host itself or a suffix after a dot, so `maps.google.co.in`
 * passes via `google.co.in` and `google.evil.com` / `notgoogle.com` do not.
 * It used to be a regex (`google\.[a-z.]{2,}$`) that accepted
 * `google.evil.com`; the backend refused to store that, but the last guard
 * before an `href` must not be weaker than the one before the database.
 */
export const REVIEW_URL_ALLOWED_HOST_SUFFIXES = [
  "google.com",
  "g.page",
  "goo.gl",
  "maps.app.goo.gl",
  "google.co.in",
  "google.co.uk",
] as const;

/** A bare Google Place ID -- the backend's `REVIEW_PLACE_ID_PATTERN`: no
 * scheme, no dot, no slash. */
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{20,255}$/;

export function isGooglePlaceId(raw: string | null | undefined): boolean {
  return !!raw && PLACE_ID_PATTERN.test(raw.trim());
}

/**
 * What the backend will store for what an operator typed: a bare Place ID
 * becomes a `writereview?placeid=` link, anything else is kept verbatim.
 * Used by the dashboard's "Test link" button so it opens what guests will
 * open. The server does the same conversion on save; this is a preview of
 * it, never a substitute.
 */
export function normalizeReviewInput(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (PLACE_ID_PATTERN.test(trimmed)) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}

/**
 * A venue pastes its own review link (Business Profile → Ask for reviews),
 * and it is stored and used verbatim -- never synthesised from a venue
 * name or a Maps search.
 *
 * This check is a safety guard on a value that reaches a navigation sink,
 * exactly like `CampaignOverlay.openBanner`'s scheme check on an
 * operator-authored `clickUrl`: `https` only (so a `javascript:` or
 * `data:` value can never execute), no userinfo, no backslash (WHATWG and
 * other parsers disagree on it), no non-default port, and a host on
 * `REVIEW_URL_ALLOWED_HOST_SUFFIXES`. The backend validates on write; this
 * is the last line before `href`.
 */
export function isSafeGoogleReviewUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const candidate = raw.trim();
  if (!candidate || candidate.includes("\\")) return false;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;
  return REVIEW_URL_ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

/** The subset of the resolved venue config these rules read. Narrow on
 * purpose: it is what makes the module testable, and it documents that
 * nothing here consults branding, auth methods or campaign content. */
export interface PostConnectConfigInput {
  collectGuestName: boolean;
  collectGuestEmail: boolean;
  /** Name required at sign-in. When on, an OTP guest already gave their
   * name before they got online, so the post-connect card never asks for
   * it again. Optional: absent reads as off. */
  requireGuestName?: boolean;
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
  /** How this session signed in -- only read to know whether the name was
   * already required at sign-in (OTP methods only). Optional. */
  authMethod?: string;
  /** The server's marketing opt-in offer for this guest (marketing spec
   * §5.8), or null/absent when there is none. Its presence is itself the
   * server's answer to "should this guest be asked": it is only non-null
   * when the venue enabled the checkbox, the org is entitled, and the guest
   * has no consent row yet. Structural, so this module keeps zero imports. */
  marketingConsentOffer?: { text: string; textVersion: string } | null;
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
  return profileFieldsEligible(config, session) || marketingConsentEligible(session);
}

/** The name/email half of the card: the venue collects something and the
 * guest has not already answered. */
export function profileFieldsEligible(
  config: PostConnectConfigInput,
  session: PostConnectSessionInput,
): boolean {
  const collectsSomething = postConnectAsksName(config, session) || config.collectGuestEmail;
  return collectsSomething && !session.hasProfile;
}

const NAME_REQUIRED_AUTH_METHODS = new Set(["otp_sms", "otp_email", "otp_whatsapp"]);

/** Whether the post-connect card may ask this guest for their NAME. Never
 * when the venue required the name at sign-in and this was an OTP sign-in
 * -- the guest already gave it on the "Your name" screen before the
 * network opened, and asking twice is the nag this module exists to stop.
 * A voucher/password guest at the same venue was not asked at sign-in, so
 * the venue's ordinary `collectGuestName` still applies to them. */
export function postConnectAsksName(
  config: PostConnectConfigInput,
  session: PostConnectSessionInput,
): boolean {
  if (!config.collectGuestName) return false;
  const askedAtSignIn =
    !!config.requireGuestName && NAME_REQUIRED_AUTH_METHODS.has(session.authMethod ?? "");
  return !askedAtSignIn;
}

/**
 * The marketing opt-in half of the same card. It rides the profile card
 * rather than getting a card of its own so the one-ask-per-screen rule
 * holds: a guest is asked for their details and whether they want offers
 * in ONE place, once, after they are already online.
 *
 * Eligible on the server's offer alone -- even at a venue that collects
 * neither a name nor an email, and even for a guest who already gave a
 * profile. The checkbox is unticked, never required, and never gates
 * access (spec §5.8).
 */
export function marketingConsentEligible(session: PostConnectSessionInput): boolean {
  const offer = session.marketingConsentOffer;
  return !!offer && typeof offer.text === "string" && offer.text.trim().length > 0;
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

export type PostConnectAsk = "profile" | "feedback" | null;

export interface PostConnectAskInput {
  config: PostConnectConfigInput;
  session: PostConnectSessionInput;
  /** `Date.now()`, passed in so the rule is a pure function of its
   * arguments and the dwell gate can be tested without faking a clock. */
  now: number;
  /** The Google review page (`/portal/review`) was shown in this visit --
   * from the server (`RuntimeSession.reviewShownThisSession`) or from the
   * `review=<sid>` marker the review page puts on its Continue link. When
   * true, the star-feedback card must not render this visit: a review ask
   * and a rating prompt never share a visit. Never persisted in storage. */
  reviewShownThisVisit: boolean;
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
 *   2. nothing
 *
 * Later (dwell past the threshold):
 *   1. feedback -- but never in a visit where the review page was shown
 *   2. nothing
 *
 * The mutual exclusion between the Google review ask and the star card is
 * the load-bearing invariant: **they must never share a screen, and never
 * share a visit.** The review ask is a separate page that runs BEFORE this
 * one, before any sentiment exists; this function's only part in it is to
 * keep the star card out of that visit.
 */
export function resolvePostConnectAsk(input: PostConnectAskInput): PostConnectAsk {
  const { config, session, now } = input;
  const dwell = dwellMinutes(session.startedAt, now);
  const threshold = clampFeedbackDwellMinutes(config.feedbackDwellMinutes);

  if (dwell >= threshold) {
    // The profile ask outranks the star card here for the same reason it
    // wins the arrival slot: it is asked ONCE EVER, so it
    // must not be crowded out. It also stops a card being swapped out from
    // under a guest who is still typing their name when the dwell
    // threshold happens to pass.
    if (!input.arrivalAskSettled && profileCardEligible(config, session)) return "profile";
    const feedbackOk =
      config.guestFeedbackEnabled &&
      input.starCampaignAvailable &&
      !input.reviewShownThisVisit &&
      !input.feedbackSettled;
    return feedbackOk ? "feedback" : null;
  }

  if (input.arrivalAskSettled) return null;
  if (profileCardEligible(config, session)) return "profile";
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
