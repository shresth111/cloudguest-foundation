/**
 * Captive-portal v7 Part 1 (Legibility) -- the backdrop decision layer.
 *
 * Everything about *how the venue photo is treated* lives here rather than
 * inline in `PortalShell.tsx`, for one reason: the safety argument in v7
 * §1.3 is a proof, and a proof needs to sit next to the constants it
 * produced, in a file that can be read and re-derived without reading JSX.
 * `PortalShell` consumes a finished `BackdropPlan` and renders it; it makes
 * no contrast judgements of its own.
 *
 * ---------------------------------------------------------------------------
 * THE PROOF (v7 §1.3) -- reproduced, not taken on trust.
 * ---------------------------------------------------------------------------
 * CSS composites a translucent scrim over the photo in *gamma* (sRGB) space,
 * so a scrim of colour S at alpha a over an underlying pixel P renders as
 * the per-channel value `P*(1-a) + S*a`. Feed that through the WCAG 2.x
 * sRGB relative-luminance formula and solve for the alpha at which the
 * result still clears a given ratio against the text colour, taking the
 * *worst possible* underlying pixel -- which makes the answer independent
 * of the image entirely.
 *
 * Black scrim, `#FFFFFF` text, worst pixel = pure white:
 *
 *   | target                          | minimum alpha |
 *   |---------------------------------|---------------|
 *   | 4.5:1  body text        (AA)    | 0.5347        |
 *   | 3:1    large text       (AA)    | 0.4162        |
 *   | 7:1    body text        (AAA)   | 0.6508        |
 *
 * White scrim, `--pg-ink` `#0F172A` text, worst pixel = pure black:
 *
 *   | 4.5:1  body text        (AA)    | 0.5007        |
 *   | 3:1    large text       (AA)    | 0.3907        |
 *
 * "Large text" is WCAG's own definition: >= 24px, or >= 18.67px at weight
 * 700. At the body floor, a pure-white pixel composites to `rgb(119,119,119)`
 * and white text on it measures 4.505:1; at the large floor it composites to
 * `rgb(149,149,149)` and measures 3.008:1. Over a black pixel both are 21:1.
 * The derivation reproduces the only published version of it (CSS-Tricks,
 * "Nailing the Perfect Contrast Between Light Text and a Background Image",
 * which binary-searches per image and reports the optimum "never exceeds
 * 0.54").
 *
 * **The consequence that shapes this whole file: image analysis is not
 * required for compliance.** A scrim at the floor is unconditionally AA over
 * literally any image, measured or not. The `background_luminance` /
 * `background_top_luminance` / `background_entropy` measurements exist only
 * so that a photo we happen to know is friendly is not needlessly muddied,
 * and so the scrim's *polarity* is right. They are never load-bearing for
 * contrast, which is why every one of them being `null` is a fully supported
 * state rather than a degraded one.
 *
 * ---------------------------------------------------------------------------
 * A CONTRADICTION IN THE SPEC, AND HOW IT IS RESOLVED HERE.
 * ---------------------------------------------------------------------------
 * §1.3 consequence 2 says luminance is used "to use *less* scrim than the
 * floor when the photo is already dark". The same document, and the brief
 * for this change, also say "never go below the floor". Both cannot hold.
 *
 * They are reconciled in favour of the floor, because going below it is not
 * defensible: `background_luminance` is a *mean*, and a mean does not bound
 * the brightest pixel. A photo that measures dark overall can still carry a
 * specular highlight, a lamp, a patch of blown-out sky -- and it is exactly
 * that pixel the floor is derived against. A mean-based reduction below the
 * floor would trade a guarantee for an average.
 *
 * So the floor is absolute, and the beauty knob works from *above* it: the
 * admin's `background_overlay_strength` (default 55 -> alpha 0.55, already
 * above the 0.535 body floor) is the starting point, a measurably dark photo
 * lets the render walk that value back *down toward* the floor, and the
 * floor itself is where it stops. See `resolveBackdropPlan`.
 *
 * ---------------------------------------------------------------------------
 * THE MEASUREMENTS ARE ALLOWED TO BE STALE, BY UP TO 60 SECONDS.
 * ---------------------------------------------------------------------------
 * They arrive through `GET /captive-portal/resolve`, which is served from a
 * Redis cache with a 60 s TTL. That cache is invalidated on captive-portal
 * *config* mutations but not on `brandings` writes, and the backfill script
 * writes `brandings` directly through the ORM, bypassing the service layer.
 * So for up to a minute after a re-upload or a backfill, this module can be
 * reasoning about the previous image.
 *
 * Nothing here is designed to assume otherwise, and the blast radius is
 * bounded by the same argument as everything else in this file: a stale
 * measurement can only mis-optimise, never under-protect. The floor is not
 * derived from any measurement, so it holds regardless; the worst a stale
 * value can do is leave the scrim prettier or heavier than ideal for a
 * minute, or delay or spuriously trigger C5's move of the headline onto a
 * plate. Both are cosmetic and both self-heal on the next cache expiry.
 * There is no state in which staleness produces a contrast failure. The
 * proper fix is backend-side cache invalidation on branding writes and is
 * out of scope here.
 */

/** Minimum scrim alpha for `#FFFFFF` body text over a **black** scrim,
 * safe against every possible underlying pixel. Exact solve 0.5347;
 * rounded **up**, because rounding down is the only direction that can
 * fail. See this module's header for the derivation. */
export const SCRIM_ALPHA_FLOOR_DARK_BODY = 0.535;

/** Minimum scrim alpha for `#FFFFFF` **large** text (>= 24px, or >= 18.67px
 * at weight 700) over a black scrim. Exact solve 0.4162, rounded up. */
export const SCRIM_ALPHA_FLOOR_DARK_LARGE = 0.417;

/** The mirror of `SCRIM_ALPHA_FLOOR_DARK_BODY` for the light polarity:
 * minimum alpha of a **white** scrim for `--pg-ink` `#0F172A` body text,
 * worst pixel pure black. Exact solve 0.5007, rounded up.
 *
 * This is the floor that governs today's shipped render, and the reason the
 * shipped default is already compliant: `background_overlay_strength` 55 ->
 * alpha 0.55 > 0.501. That is not luck, it is why 55 was chosen in v6 §4. */
export const SCRIM_ALPHA_FLOOR_LIGHT_BODY = 0.501;

/** Minimum white-scrim alpha for `--pg-ink` large text. Exact solve 0.3907,
 * rounded up. */
export const SCRIM_ALPHA_FLOOR_LIGHT_LARGE = 0.391;

/** The [15, 85] render-time guardrail v6 §4.3 put on the admin's stored
 * strength, kept verbatim. Below 15 a bright photo reproduces PR #80's
 * illegible header; above 85 the scrim approaches PR #81's near-total wash.
 * An admin can travel most of the way in either direction but never all the
 * way back to either shipped incident. Note the *floor* constants above now
 * bound the low end far more tightly than 0.15 ever did -- 15 survives as
 * the outer guardrail on the admin's stored value, not as a contrast claim. */
const STRENGTH_MIN = 15;
const STRENGTH_MAX = 85;

/**
 * Which way the scrim pushes, and therefore what colour text on it must be.
 *
 * - `light`: white scrim, dark `--pg-ink` text. **The default, and today's
 *   shipped behaviour byte-for-byte.** Correct over a dark photo (it lifts
 *   the backdrop until dark ink reads) and correct when nothing has been
 *   measured, which matters because "nothing measured" is every venue that
 *   uploaded before the v7 pipeline existed.
 * - `dark`: black scrim, pure `#FFFFFF` text. Correct over a *bright* photo
 *   -- the case v7 §1.1 L3 identifies as the one where the current white-only
 *   scrim is a literal no-op, and (per L2) the same case where the white card
 *   dissolves into the photo. This is the founder's actual complaint.
 *
 * Polarity and text colour are a single decision, never two: a black scrim
 * under dark text is worse than no scrim at all. `PortalShell` enforces the
 * pairing structurally by re-declaring the ink tokens per polarity, so the
 * ten routes that render a bare `<h1>` on the photo follow the flip without
 * being edited.
 */
export type ScrimPolarity = "light" | "dark";

/** The three `brandings` measurements, exactly as `GET /captive-portal/
 * resolve` returns them: integers 0-100, or `null`.
 *
 * **`null` means "never measured", and must never be read as "measured 0".**
 * The backend migration (0089) is explicit that this distinction is why
 * these three columns are nullable while every other column v7 adds is NOT
 * NULL with a server default: 0 is a legitimate reading (a genuinely black
 * photo), so a NOT NULL DEFAULT 0 would have made "we have not looked at
 * this image" indistinguishable from "we looked, and it is black". Every
 * branch below therefore tests `=== null` before it tests a threshold. */
export interface BackgroundMeasurements {
  /** Mean luma of the whole image, 0-100. */
  luminance: number | null;
  /** Mean luma of the top band -- the zone a headline sits over, 0-100. */
  topLuminance: number | null;
  /** Normalized histogram entropy, 0-100: how *busy* the image is. */
  entropy: number | null;
}

/** At or above this entropy the image is "busy" and C5's refusal rule fires.
 *
 * The threshold answers the honest limit §1.3 states and does not pretend to
 * solve: a mathematically compliant contrast ratio can still read badly over
 * a busy image, because glyph edges compete with image edges. No alpha value
 * fixes that -- only moving the text off the photo does. 70/100 is a
 * deliberately cautious line: the cost of firing when we did not need to is
 * a headline on a card (which is where §1.2 wants all text anyway), and the
 * cost of not firing when we should have is the defect this whole part
 * exists to remove. Asymmetric costs, asymmetric threshold. */
const HOSTILE_ENTROPY = 70;

/** The mid-luminance band, in which *neither* polarity is comfortable: a
 * white scrim has to work too hard to lift it for dark ink, a black scrim
 * has to work too hard to sink it for white text, and the honest answer is
 * that the photo is simply not a good backing for text. Bounded either side
 * of 50 rather than centred on a single value so the choice does not
 * oscillate for images that measure a point apart. */
const AMBIGUOUS_LUMINANCE_MIN = 40;
const AMBIGUOUS_LUMINANCE_MAX = 60;

/** At or above this mean luminance the photo is bright enough that (a) a
 * white scrim is the no-op §1.1 L3 describes, and (b) §1.1 L2's white card
 * boundary against it measures ~1.14:1 and visually dissolves. Both switch
 * on together because they are the same observation about the same photo. */
const BRIGHT_LUMINANCE = 62;

/** Below this mean luminance the photo is dark enough that the *stored*
 * admin strength is more scrim than the picture needs -- the "beauty, not
 * compliance" case of §1.3 consequence 2. The reduction it authorises is
 * bounded by the floor, never below it. */
const DARK_LUMINANCE = 32;

/** Everything `PortalShell` needs in order to render the backdrop, resolved
 * in one place from the config so no rendering code makes a contrast
 * judgement of its own. */
export interface BackdropPlan {
  polarity: ScrimPolarity;
  /** The finished CSS `background` value for the scrim layer. */
  scrim: string;
  /** The peak alpha actually rendered, after the floor and the [15, 85]
   * guardrail. Exposed for tests and for the report's contrast table. */
  peakAlpha: number;
  /** `background-position` for the photo layer, already formatted. Only
   * meaningful once the photo layer is cropped against the viewport (C1) --
   * see `resolveFocalPosition`. */
  focalPosition: string;
  /** v7 §1.4 C5 -- the refusal rule. `true` when the image is hostile enough
   * that a headline must not sit on it at any alpha, and belongs on the
   * opaque card instead. */
  headlineOnCard: boolean;
  /** v7 §1.1 L2 / §1.4 C3 -- `true` when the photo is bright enough that the
   * white card's `--pg-border` edge (1.23:1 on white, and ~1.14:1 against a
   * bright photo) stops reading as a boundary and the card needs a real ring. */
  strongCardEdge: boolean;
}

function clampPct(v: number | null | undefined, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : fallback;
}

/**
 * v7 §1.4 C4. Formats the stored per-venue focal point as a
 * `background-position`.
 *
 * The defaults 50/25 are chosen by migration 0089 to reproduce the previous
 * hardcoded `center 25%` exactly, so every existing venue renders unchanged.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE SPEC IS WRONG ABOUT THIS, measured rather than argued.
 * ---------------------------------------------------------------------------
 * §1.4 C1 claims that cropping against the viewport "restores L7" -- i.e.
 * that it makes the vertical focal point start working on phones. It does
 * not, and the code should not carry that claim.
 *
 * The premise is right: a *percentage* `background-position` only acts along
 * the axis on which the image actually overflows its box. The conclusion
 * does not follow, because C1 does not change *which* axis overflows. Under
 * `cover`, the overflowing axis is decided purely by comparing the image's
 * aspect ratio to the box's, and a phone's box is portrait either way.
 * Measured across every plausible combination:
 *
 *   image 1920x1080 on 390x844  -> overflows HORIZONTALLY (74.0% cropped)
 *   image 1080x1920 on 390x844  -> overflows HORIZONTALLY (17.9% cropped)
 *   image 1200x1200 on 390x844  -> overflows HORIZONTALLY (53.8% cropped)
 *   ...same on 412x915 and 820x1180.
 *
 * Vertical overflow needs the *box* to be proportionally wider than the
 * image (e.g. 1440x500), which no phone is. So on mobile `focalY` is inert
 * before C1 and inert after it, and **`focalX` is the axis that does the
 * work there** -- which is worth knowing before anyone builds the admin
 * picker, because a UI that emphasises the vertical control would be
 * emphasising the half that never fires for 80%+ of guest traffic. `focalY`
 * is real on wide/short viewports and on desktop for portrait uploads, which
 * is exactly the case v5 §3.4 originally introduced `center 25%` for.
 *
 * What C1 *actually* buys, also measured, is worth more than what it was
 * claimed to buy: on a 390x844 phone with a 1200px-tall document it takes
 * the crop from 81.7% to 74.0% for a landscape photo and from 42.2% to 17.9%
 * for a portrait one, it pins the crop to the viewport so it stops drifting
 * as the OTP flow grows the page, and it makes the framing deterministic
 * instead of a function of how much content happens to be on screen. Both
 * changes still ship together; C4 simply is not *dependent* on C1 the way
 * the spec says.
 */
export function resolveFocalPosition(
  focalX: number | null | undefined,
  focalY: number | null | undefined,
): string {
  return `${clampPct(focalX, 50)}% ${clampPct(focalY, 25)}%`;
}

/**
 * The scrim gradient. Extends v6's `buildGuestBackdropScrim(strengthPct)`
 * with the polarity argument v7 §1.4 C3 asks for; the geometry is untouched.
 *
 * **The 24% / 78% stops are not parameters and must never become
 * parameters.** They are the one thing in this file that is deliberately
 * immune to configuration, because *coverage area* -- not opacity value --
 * was the actual mistake in both shipped regressions (v5 §2, §0.1 item 1):
 * PR #80 fixed legibility per element, PR #81 replaced that with a single
 * 92%-opaque wash over the whole content column and reduced a real venue's
 * photo to a barely-visible ghost in production, PR #82 reverted it. Peak
 * opacity is a real per-venue admin input; how much of the photo the scrim
 * is allowed to touch is not, so that no admin control can reintroduce PR
 * #81's mistake under a different name.
 *
 * The corollary is that this gradient protects the top and bottom bands and
 * nothing else, and that the fully transparent 24-78% middle band is load-
 * bearing: it is what keeps the photo a photo. Text that lands in that band
 * is not the scrim's problem to solve and cannot be solved by making the
 * scrim bigger -- it is solved by giving that text its own bounded surface
 * sized to its own content box, which is what `PortalBackdropText` (and C5)
 * do. See `resolveBackdropPlan`'s note on the "size the scrim from the
 * content box" instruction for why that is the only reading of it that does
 * not walk straight back into PR #81.
 *
 * @param strengthPct Admin-chosen 0-100 (`RuntimePortalConfig.
 * backgroundOverlayStrength`, default 55). Clamped to [15, 85] here at
 * render time, never at the stored-value/admin-slider side.
 * @param polarity Which way the scrim pushes; picks the scrim's own colour.
 * @param minAlpha The §1.3 body-text floor for this polarity. The clamped strength is
 * raised to meet it if it falls short -- the floor always wins.
 */
export function buildGuestBackdropScrim(
  strengthPct: number,
  polarity: ScrimPolarity = "light",
  minAlpha = polarity === "dark" ? SCRIM_ALPHA_FLOOR_DARK_LARGE : SCRIM_ALPHA_FLOOR_LIGHT_LARGE,
): string {
  const rgb = polarity === "dark" ? "0,0,0" : "255,255,255";
  const clamped = Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, strengthPct)) / 100;
  // The floor is a hard minimum, applied after the admin guardrail: a
  // venue that dragged the slider to 15 gets a prettier photo than one at
  // 85, but never an illegible headline.
  const peakTop = Math.max(minAlpha, clamped);
  const midTop = peakTop * 0.51; // the ratio v5's shipped 0.28/0.55 encoded
  const peakBottom = Math.min(STRENGTH_MAX / 100, peakTop + 0.1); // v5's +0.10 offset

  return (
    `linear-gradient(to bottom, rgba(${rgb},${peakTop}) 0%, rgba(${rgb},${midTop}) 14%, ` +
    `rgba(${rgb},0) 24%, rgba(${rgb},0) 78%, rgba(${rgb},${peakBottom}) 100%)`
  );
}

/**
 * Turns the resolved config's five v7 fields into one finished plan.
 *
 * On "size the scrim from the content box, not a fixed vignette height":
 * taken literally -- growing the vignette until it reaches whatever the
 * tallest text happens to be -- that instruction is §0.1 item 1's forbidden
 * move wearing a different hat, because "the vignette now extends to cover
 * the content" and "one translucent panel over the content column" converge
 * on the same render as soon as text scales up under the relative units the
 * accessibility pass shipped. The instruction is honoured the other way
 * round instead, which achieves what it is actually after: the vignette
 * keeps its fixed, non-negotiable geometry, and every text zone that can
 * land outside it gets a **bounded surface sized to its own content box** --
 * `PortalBackdropText` for the loose lines, `PortalCard` for the rest, and
 * C5 below for the headline. Nothing grows to cover the photo; the text
 * comes to the surface instead. This is flagged rather than silently
 * decided, because it is the one place this implementation reads the brief
 * against its own letter.
 */
export function resolveBackdropPlan(input: {
  overlayStrength: number;
  focalX: number | null | undefined;
  focalY: number | null | undefined;
  measurements: BackgroundMeasurements;
}): BackdropPlan {
  const { luminance, topLuminance, entropy } = input.measurements;

  // Polarity. Unmeasured resolves to `light` -- identical to what ships
  // today, which is the only safe default when the fleet is full of images
  // uploaded before anything measured them. `topLuminance` leads because it
  // describes the band the headline actually sits over; whole-image
  // luminance is the fallback.
  const headlineZoneLuma = topLuminance ?? luminance;
  const polarity: ScrimPolarity =
    headlineZoneLuma !== null && headlineZoneLuma >= BRIGHT_LUMINANCE ? "dark" : "light";

  // **The floor is always the BODY floor, measured or not.**
  //
  // An earlier revision of this function relaxed to the large-text floor
  // once an image had been measured, on the reasoning that §1.2 puts only
  // the headline on the scrim. That was wrong twice over, and both are worth
  // recording because the argument is subtle enough to be re-made later:
  //
  //  1. It is not true today. The ten `portal.*.tsx` routes of §1.1 L1 put a
  //     body-sized *subtitle* on the photo alongside the headline. The large
  //     floor is only sound where large text is the only text, and this
  //     codebase cannot currently guarantee that anywhere.
  //  2. It contradicted this module's own header. The reason the floor is
  //     never lowered by measurement is that `background_luminance` is a
  //     mean and a mean does not bound the brightest pixel. Relaxing 0.501
  //     to 0.391 *because the image measured dark* is that exact unsound
  //     move in a smaller dose -- and at 0.391 the worst pixel composites to
  //     rgb(100), where `--pg-ink` measures 3.003:1: fine for a headline,
  //     a failure for the subtitle underneath it.
  //
  // The large-text constants remain exported with their derivation, because
  // they are the correct value for a surface that has genuinely guaranteed
  // large-text-only content. Nothing here is such a surface yet.
  //
  // This matters more than it looks: a read of the live database found every
  // branding row's metrics NULL -- 2 branding rows across 11 organizations,
  // exactly 1 with a background image, nothing backfilled. The unmeasured
  // path is not a defensive edge case, it is the only path executing in
  // production today, and it now carries a body-text AA guarantee at every
  // position of the admin's slider.
  const floor = polarity === "dark" ? SCRIM_ALPHA_FLOOR_DARK_BODY : SCRIM_ALPHA_FLOOR_LIGHT_BODY;

  // The beauty knob, and the only thing measurement is allowed to move.
  // A measurably dark photo does not need the admin's full stored strength,
  // so the render walks it back -- and stops dead at the floor. Never below.
  let strength = input.overlayStrength;
  if (polarity === "light" && luminance !== null && luminance <= DARK_LUMINANCE) {
    // Scale linearly from "no reduction at the dark threshold" down to
    // roughly the floor at pure black, then let the floor clamp it anyway.
    const reduction = 1 - (DARK_LUMINANCE - luminance) / DARK_LUMINANCE / 2;
    strength = input.overlayStrength * reduction;
  }

  const peakAlpha = Math.max(floor, Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, strength)) / 100);

  // C5, the refusal rule. Meta's patent on this exact problem computes a
  // readability score for the image and, below threshold, renders the text
  // *adjacent to* the image rather than on it. Same rule here, with the
  // thresholds this codebase can actually measure. Two independent triggers:
  //
  //  - busy: glyph edges compete with image edges, and no alpha fixes that.
  //  - ambiguous luminance: mid-tone, where neither polarity is comfortable.
  //
  // Both are skipped when the measurement is absent, because an unmeasured
  // image is not evidence of a hostile one -- and it does not need to be:
  // the floor already makes the unmeasured case AA-compliant. Refusal buys
  // *quality* over and above compliance, exactly like the measurements do.
  const busy = entropy !== null && entropy >= HOSTILE_ENTROPY;
  const ambiguous =
    headlineZoneLuma !== null &&
    headlineZoneLuma >= AMBIGUOUS_LUMINANCE_MIN &&
    headlineZoneLuma <= AMBIGUOUS_LUMINANCE_MAX;

  return {
    polarity,
    peakAlpha,
    scrim: buildGuestBackdropScrim(
      Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, strength)),
      polarity,
      floor,
    ),
    focalPosition: resolveFocalPosition(input.focalX, input.focalY),
    headlineOnCard: busy || ambiguous,
    // L2. Keyed on whole-image luminance rather than the top band, because
    // the card sits in the vertical middle of the photo, not its top.
    strongCardEdge: luminance !== null && luminance >= BRIGHT_LUMINANCE,
  };
}
