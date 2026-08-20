import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { PG_FONT_STACK } from "@/lib/portal-font-stack";
import { usePortalRuntime, usePortalRuntimeOptional } from "@/context/PortalRuntimeContext";
import { usePortalBackdropPlan } from "@/hooks/usePortalBackdropPlan";
import type { BackdropPlan } from "@/lib/portal-backdrop";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { A11yMenu } from "./A11yMenu";
import { DEFAULT_PORTAL_LOGO_SRC } from "./PortalGuestUi";
import { PortalFootnoteMark } from "./PortalDefaultBrandBadge";
import { PortalNoPhotoPattern } from "./PortalNoPhotoPattern";

/** The product name, deliberately NOT translated and deliberately not a
 * per-language string: it is a proper noun, and the whole point of §3 P5 is
 * that a guest recognises the *same* operator across every venue they visit.
 * The `{brand}` token is what `poweredByTemplate` splits on, in EN and HI
 * alike -- see that key's own comment in portal-i18n.ts for why the phrase
 * is a template rather than two keys (the word order flips: Hindi puts the
 * brand first). */
const WYFY_GUEST_BRAND = "Wyfy Guest";
const WYFY_GUEST_TOKEN = "{brand}";

// The guest-portal font stack now has exactly one definition, in
// `@/lib/portal-font-stack` -- a leaf module with no imports of its own,
// which is the only shape that can be the single source of truth here
// (this file imports PortalRuntimeContext, which imports
// portal-guest-fonts, so hanging the constant off any of the three and
// importing it from the others is a cycle). Its doc comment carries the
// full per-entry rationale: why zero font bytes is a hard requirement on
// this surface, why `ui-sans-serif` was dropped, why `"Segoe UI Variable
// Text"` had to be named for Windows 11, and the measured proof that the
// Indic families belong behind `system-ui` rather than ahead of it.
//
// Re-exported here (not just imported) so every existing
// `import { PG_FONT_STACK } from ".../PortalShell"` call site -- e.g.
// portal.tsx's IncompletePortalLinkError, which renders standalone,// before/without a PortalRuntimeProvider mounting this shell at all --
// keeps resolving unchanged.
export { PG_FONT_STACK } from "@/lib/portal-font-stack";

// Bounded, opaque-enough legibility backing for a single text/logo zone
// sitting directly on a venue's uploaded photo -- white/80-90 +
// backdrop-blur-md, the exact pattern BrandPanel's Aug 5 fix (ab5226f)
// and GuestSignInCard header's PR #80 fix independently arrived at.
// Shared here (not three copies) so the *styling* stays structural
// without making the *coverage area* structural -- see GuestBackdrop's
// own comment for why those are two different things and conflating them
// was the actual v4 regression.
// captive-portal-v5-design-spec.md §3.1/§3.3: `rounded-3xl` (this card)
// and `rounded-2xl` (PortalCard, the form) used to be two different
// radii glued together -- part of why the composition read as
// "assembled," not designed. One shared value, `rounded-[20px]`, now
// applies everywhere this card family (and PortalCard below) appears.
// `pg-surface-card` is not a styling hook -- it carries no properties of its
// own. It is the structural marker styles.css uses to answer one question:
// "is this text standing on an opaque-enough surface of our own, or is it
// standing on the venue's photo?" Under the dark scrim polarity (v7 §1.4 C3)
// the shell root re-declares the `--pg-ink*` tokens to pure #FFFFFF so that
// text sitting directly on the photo follows the scrim's flip; this class is
// what marks the regions where that flip must be undone again. Doing it with
// tokens and a marker class, rather than by editing components, is what lets
// the ten `portal.*.tsx` routes that render a bare <h1> on the photo pick up
// the correct ink without any of them being touched -- they already render
// inside `PortalCard`, or already render on the photo, and both cases now
// resolve correctly on their own.
export const GUEST_LEGIBILITY_CARD_CLASS =
  "pg-surface-card rounded-[20px] border border-white/60 bg-[var(--pg-surface)]/85 shadow-[0_8px_32px_-12px_rgba(30,27,75,0.25)] backdrop-blur-md";

/** The lg:+ (laptop-width) left-hand context panel -- fills the space
 * that used to be empty gradient next to a small floating card. Copy is
 * deliberately generic (real venue name, phrased so it never repeats the
 * exact headline sentence the sign-in card on the right already shows)
 * rather than fabricated marketing claims (speed, encryption, session
 * length) this codebase has no real config field for -- see this
 * session's own audit call-out on not inventing guest-facing copy that
 * isn't backed by real data.
 *
 * Owns its own `hasBackgroundImage` legibility backing again (previously
 * this delegated to `<GuestBackdrop>`'s v4 full-column panel -- see that
 * component's own comment for why that delegation was reverted: it
 * legibility-backed this text by washing out the photo behind everything
 * else too). */
function BrandPanel({
  venueName,
  hasBackgroundImage,
}: {
  venueName?: string;
  hasBackgroundImage?: boolean;
}) {
  const { t } = usePortalRuntime();
  // {venue} substitution done here rather than inside translate() itself --
  // see courtesyOfTemplate's own doc comment in portal-i18n.ts for why the
  // word order needs to flip per language ("courtesy of X" vs "X की ओर से").
  const courtesySuffix = venueName ? t("courtesyOfTemplate").replace("{venue}", venueName) : "";
  const content = (
    <>
      {/* Solid chip, not a glassy `bg-white/70 backdrop-blur` badge -- the
       * "quiet, confident, venue signage" direction deliberately drops the
       * glass-panel vocabulary of the previous pass; a flat neutral
       * background no longer needs a blur to stay legible underneath
       * this. */}
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pg-border)] bg-[var(--pg-surface)] px-3.5 py-1.5 pg-micro uppercase text-[var(--pr-primary,#6366f1)]">
        <Wifi className="h-3.5 w-3.5" /> {t("guestNetwork")}
      </span>
      <h2 className="pg-display mt-6 text-[var(--pg-ink)]">
        {t("brandHeadlineBase")}
        {courtesySuffix}.
      </h2>
      {/* No "it takes about fifteen seconds" -- that was a fabricated
       * timing claim this codebase has no real config field to back; the
       * rest of the sentence already tells a guest exactly what to do
       * next without inventing a number. */}
      <p className="mt-5 max-w-md pg-body text-[var(--pg-ink-muted)]">{t("verifyDeviceCta")}</p>
    </>
  );
  // The page-level scrim (`GuestBackdrop`) is a top/bottom vignette --
  // fully transparent through the vertical middle, exactly where this
  // panel sits once vertically centered. Fine against the plain
  // gradient/flat-canvas background (no photo, no contrast problem), but
  // a real customer photo can be any tone at all, so this needs its own
  // guaranteed-legible backing rather than trusting whatever's directly
  // behind it.
  if (hasBackgroundImage) {
    // captive-portal-v5-design-spec.md §3.1: brought in line with the
    // merged sign-in card's own `p-5` so the two read as one visual
    // family instead of two independently-tuned components.
    return <div className={cn("max-w-lg p-5", GUEST_LEGIBILITY_CARD_CLASS)}>{content}</div>;
  }
  return <div className="max-w-lg">{content}</div>;
}

/**
 * A bounded, self-sizing surface for text that would otherwise stand
 * directly on the venue's photo. **The single seam for "this text is not on
 * a card"** -- `GuestSignInCard`'s trailing note here, and the ten
 * `portal.*.tsx` routes that render a bare `<h1>` plus subtitle in a
 * `text-center` div outside `PortalCard` (v7 §1.1 L1).
 *
 * This is the answer to the one instruction in v7 §1.4 C3 that cannot be
 * taken literally -- "size the scrim from the content box, not a fixed
 * vignette height". Growing the vignette until it reaches the text is §0.1
 * item 1's forbidden move under a new name: it converges on PR #81's single
 * translucent wash over the content column as soon as text scales up under
 * the relative units the accessibility pass shipped. So the sizing happens
 * on the *text*, not on the scrim -- and `w-fit` is what makes that literal.
 * `fit-content` resolves to `min(max-content, available)`, so a short
 * heading gets a plate that hugs it and a heading that genuinely fills the
 * column gets a full-width one, with no breakpoint logic and no case where
 * the plate covers photo that no glyph needed. Coverage is derived from the
 * content box; it is never a constant.
 *
 * Renders its children bare when there is no photo -- on the flat
 * `--pg-canvas` background there is no contrast problem to solve and a plate
 * would be visual noise. That makes it inert for every venue that has not
 * uploaded a background, which is why routes can adopt it unconditionally.
 *
 * C5 (§1.4, the refusal rule) lands here rather than at the call sites: when
 * the resolved plan says the image is hostile, the plate stops being the
 * translucent legibility card and becomes **opaque** -- which is precisely
 * what "put the headline on the card too" means. Note what that escalation
 * does *not* do: it does not cover one additional pixel. It deepens a
 * surface already sized to its own text. Deepening bounded coverage is the
 * move v5 §2 endorses; widening it is the move that shipped twice and got
 * reverted twice.
 */
export function PortalTextPlate({
  children,
  className,
  /** `plate` (default) for a heading block; `pill` for a single short line.
   * Only radius and padding differ -- both hug their own content. */
  shape = "plate",
}: {
  children: ReactNode;
  className?: string;
  shape?: "plate" | "pill";
}) {
  // Optional context for the same reason `PortalCard` below uses it: these
  // are shared presentation components and are legitimately rendered outside
  // `PortalRuntimeProvider` (portal.tsx's `IncompletePortalLinkError`). With
  // no runtime there is no photo, so the plate correctly draws nothing.
  const config = usePortalRuntimeOptional()?.config;
  const plan = usePortalBackdropPlan();
  if (!config?.backgroundImageUrl) return <>{children}</>;
  return (
    <div
      className={cn(
        "mx-auto w-fit max-w-full text-center",
        // NOTE THE ARGUMENT ORDER, and do not "tidy" it: the shared class
        // must come FIRST. `cn` is tailwind-merge, which resolves a conflict
        // group by keeping the LAST class in it, and
        // `GUEST_LEGIBILITY_CARD_CLASS` contains `rounded-[20px]`. Written
        // the natural way round -- local overrides after the shared base --
        // `rounded-full` is silently discarded and you get a 20px-radius
        // box while the source says "pill". Verified by running `twMerge` on
        // these exact strings: as-written yields `rounded-[20px]`, swapped
        // yields `rounded-full`. The footer below had this bug for its whole
        // life; it is the kind of mistake that leaves no error behind, so it
        // is called out at both sites rather than just fixed.
        GUEST_LEGIBILITY_CARD_CLASS,
        shape === "pill" ? "rounded-full px-4 py-2" : "p-5",
        // C5. `bg-[var(--pg-surface)]` (no `/85`) wins the tailwind-merge
        // background group over the shared class's translucent value, for
        // the same last-one-wins reason documented above -- here relied on
        // deliberately rather than tripped over.
        plan?.headlineOnCard && "bg-[var(--pg-surface)] border-[var(--pg-border)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Renders the venue's uploaded background photo plus the top/bottom vignette
 * scrim -- nothing more. Does NOT wrap `children` in any opaque panel;
 * legibility for the actual text content is each zone's own job
 * (`PortalCard`, `GUEST_LEGIBILITY_CARD_CLASS`, `PortalTextPlate`).
 *
 * v4 (#81) first shipped this as one continuous `--pg-surface/92` panel
 * wrapping the *entire* content column -- logo, heading, sign-in card,
 * footer, min-h-dvh tall -- on the reasoning that a single structural
 * guarantee beats three independently-drifting per-block fixes. Correct
 * problem, wrong mechanism: on a real venue photo that panel covered
 * essentially the whole viewport at ~90% white, which is indistinguishable
 * from "the photo doesn't render" -- confirmed live on production
 * (/portal/welcome), the venue's real background photo was reduced to a
 * barely-visible ghost. That traded genuine illegibility for genuine
 * invisibility; neither is acceptable, and the photo is the actual point of
 * this feature (a venue's own branding asset). PR #82 reverted it. Every
 * comment in this file that insists on *coverage area* being the fixed
 * quantity is guarding against a third attempt.
 *
 * ---------------------------------------------------------------------------
 * v7 §1.4 C1 -- the photo is cropped against the VIEWPORT, not the document.
 * ---------------------------------------------------------------------------
 * This layer used to be `absolute inset-0` inside a container that is
 * `min-h-dvh` **and grows with its content**. That is the bug in §1.1 L6, and
 * it is much larger than it sounds. On a 390x844 phone, the OTP flow makes
 * the document roughly 1200px tall; `absolute inset-0` therefore sizes this
 * layer 390x1200, and `background-size: cover` scales a 1920x1080 photo to
 * fit *1200px of height*, i.e. ~2133px wide against a 390px box. About 82% of
 * the venue's own photograph is cropped off-screen and the guest sees a
 * random vertical sliver of the building.
 *
 * Measured in a real browser at 390x844 with a 1200px document: the layer
 * was 390x1200, the photo cover-scaled to 2133x1200, and 81.7% of it was
 * cropped away -- the spec's "~82%" is accurate. With the fix the layer is
 * 390x844, the photo scales to 1500x844, and the crop drops to 74.0%; for a
 * portrait upload it drops from 42.2% to 17.9%. The layer also stops
 * scrolling away (its `top` stayed 0 after scrolling 350px, where the old
 * one had moved to -350).
 *
 * §1.4 C1 additionally claims this "restores L7", i.e. makes the vertical
 * focal point work on phones. **That claim is false and is not repeated
 * here.** C1 changes the box's size, not which axis overflows -- and under
 * `cover` the overflowing axis is decided purely by image aspect versus box
 * aspect. A phone's box is portrait before and after, so the overflow stays
 * horizontal for every plausible upload and `focalY` stays inert on mobile
 * either way. See `resolveFocalPosition` for the measured matrix. The two
 * changes still belong together; C4 is simply not *dependent* on C1.
 *
 * `position: fixed` (not `absolute`) is the fix, because on a fixed element
 * `inset: 0` resolves against the viewport rather than the containing block,
 * which gives exactly the 390x844 box `cover` needs -- and the crop then
 * stays correct while the page scrolls, instead of being computed once
 * against whatever height the document happened to reach. Two things make
 * this safe here rather than fragile:
 *
 *  - The shell root's `overflow-hidden` does not clip it. `overflow` only
 *    clips a fixed descendant when that ancestor is also its containing
 *    block, which requires a `transform`/`filter`/`perspective`/
 *    `backdrop-filter`/`contain: paint`/`will-change`. There is none on the
 *    ancestor chain -- and notably the accessibility pass removed the one
 *    that existed (`contrast-125 saturate-150` on this very root), citing
 *    this exact containing-block behaviour as one of its reasons.
 *  - It is a fixed *element*, not `background-attachment: fixed`, which is
 *    the thing that is genuinely broken on iOS Safari.
 *
 * The admin Portal Preview (`constrained`) deliberately stays `absolute`:
 * it renders this shell inside a fixed-size phone-bezel mockup, and a fixed
 * layer would escape the bezel and paint over the whole admin page. That
 * leaves the preview on the old document-box crop when previewed content
 * overflows the bezel -- a known, documented fidelity gap in an internal
 * tool, not a guest-facing defect, and the same behaviour it has today.
 */
function GuestBackdrop({
  backgroundImageUrl,
  plan,
  constrained,
  children,
}: {
  backgroundImageUrl?: string | null;
  /** `null` when there is no photo. See `usePortalBackdropPlan`. */
  plan: BackdropPlan | null;
  /** See `GuestBackdrop`'s own comment on why the admin preview cannot use
   * a viewport-fixed layer. */
  constrained: boolean;
  children: ReactNode;
}) {
  // `data-pg-backdrop` is the attribute styles.css's `forced-colors` block
  // asked for by name: it previously had to match these layers by their
  // Tailwind classes (`.portal-runtime > .pointer-events-none.absolute.
  // inset-0`) because this component belonged to a different workstream,
  // with a comment saying to replace it with an attribute when that landed.
  // This is that landing. The attribute also carries the
  // `prefers-contrast: more` rule, which drops the photo and scrim entirely
  // rather than trying to compute a "more contrasty scrim" -- a scrim cannot
  // tell text from photo, so escalating it is not a contrast improvement.
  const layerCls = constrained
    ? "pointer-events-none absolute inset-0"
    : "pointer-events-none fixed inset-0";

  if (!backgroundImageUrl || !plan) {
    // captive-portal-v5-design-spec.md, Visual Assets §2b: the no-photo
    // case used to render nothing at all here (confirmed live -- a real
    // org with no background image configured shows a completely bare
    // `--pg-canvas` field). `PortalNoPhotoPattern` is deliberately not a
    // reintroduction of the old blurred-glow "AmbientGlow" mistake --
    // it's flat, hairline, ~4-10%-opacity geometry built from the
    // marketing site's own signal-arc motif, not a colored glow -- see
    // that component's own doc comment. `pointer-events-none`/absolute so
    // it never intercepts input or affects layout.
    // Wrapped rather than given the attribute directly, so that
    // `PortalNoPhotoPattern` (owned elsewhere) needs no prop-forwarding
    // change to participate in the `forced-colors`/`prefers-contrast`
    // drop-the-decoration rules.
    return (
      <>
        <div aria-hidden data-pg-backdrop className={layerCls}>
          <PortalNoPhotoPattern />
        </div>
        {children}
      </>
    );
  }
  return (
    <>
      {/* Shown at full clarity, not faded -- a customer's own uploaded
       * photo/artwork should actually be visible, not washed out to
       * near-invisibility. Any blur/base-tint belongs in the upload
       * pipeline (v7 §1.4 C2, backend), never in `backdrop-filter` here:
       * MDN is explicit that it forces the browser to render, filter and
       * composite everything behind the element *every frame including
       * every scroll frame*, with cost scaling by blur radius x element
       * area -- precisely wrong for a full-bleed layer on a 1080p Android,
       * and it has a silent failure mode where any ancestor with
       * `opacity < 1`/`filter`/`mask`/`clip-path`/`mix-blend-mode` becomes
       * a backdrop root and confines the blur to nothing. */}
      <div
        aria-hidden
        data-pg-backdrop
        className={cn(layerCls, "bg-cover bg-no-repeat")}
        style={{
          // `JSON.stringify`, not bare interpolation. CSS terminates an
          // *unquoted* `url(` token at the first `)`, and URLs legitimately
          // contain parentheses -- an SVG data URI with a gradient carries
          // `fill="url(%23g)"` with its parens NOT percent-encoded, because
          // `encodeURIComponent` leaves `(`/`)` alone. Interpolated bare,
          // the whole declaration is invalid and silently drops to
          // `background-image: none`: the venue's photo vanishes and every
          // downstream contrast decision (scrim polarity, plate alpha) is
          // made against a photo the guest cannot see. Found live: the
          // visual-matrix's gradient "dark"/"bright" test photos rendered as
          // bare canvas while the flat-rect "busy" one rendered fine.
          // JSON.stringify wraps in `"` and escapes `"`/`\` -- the exact
          // escapes a double-quoted CSS string needs, and a quoted CSS
          // `url("...")` accepts parens verbatim.
          backgroundImage: `url(${JSON.stringify(backgroundImageUrl)})`,
          // v7 §1.4 C4: the per-venue focal point. Defaults 50/25
          // reproduce `center 25%` exactly, so no existing venue moves.
          // On phones it is the *horizontal* half that does the work --
          // see `resolveFocalPosition` for why, and for why the spec's
          // claim that C1 makes the vertical half work is wrong.
          backgroundPosition: plan.focalPosition,
        }}
      />
      <div aria-hidden data-pg-backdrop className={layerCls} style={{ background: plan.scrim }} />
      {children}
    </>
  );
}

interface Props {
  children: ReactNode;
  contentClassName?: string;
  /** When true, sizes to 100% of its parent container (`h-full`) instead
   * of the full viewport (`min-h-dvh`) -- used by the admin Portal
   * Preview (src/routes/preview.portal.$locationId.tsx), which renders
   * this exact component inside a fixed-size phone-bezel mockup rather
   * than a real full-page /portal/* route. */
  constrained?: boolean;
  /** Default true. `BrandPanel`'s copy ("Verify your device on the
   * right...") is sign-in-oriented -- right context for `/portal/welcome`,
   * wrong context for the shared `PortalConnectingState` screen, which has
   * nothing left to verify (a login already happened; this is either the
   * pass-through `/portal/` render or `/portal/success`'s real hotspot-
   * login POST in flight). Both of those callers pass `false`, and only
   * together -- v4 §5's non-negotiable #3 requires `/portal/` and
   * `/portal/success` to render the pixel-identical connecting visual, so
   * this can never be set on just one of the two without silently
   * reintroducing the exact "two different-looking connecting screens"
   * flash that invariant exists to prevent. */
  showBrandPanel?: boolean;
}

/**
 * v4 §6.1/§8: the old "dark" (glass-on-navy) visual language and its
 * `variant` prop are gone -- confirmed all 17 real `portal.*` routes
 * always passed `variant="light"`, so the dark branch was ~150 lines of
 * dead code nobody had actually chosen in over a redesign cycle. This is
 * now one visual language, no branch: the "quiet, confident, venue
 * signage" flat-neutral `--pg-canvas` background, thin-bordered white
 * card, flat single-color CTA fill, system-font stack.
 */
export function PortalShell({
  children,
  contentClassName,
  constrained = false,
  showBrandPanel = true,
}: Props) {
  const { config, highContrast, largeText, organizationId, locationId, routerId, t } =
    usePortalRuntime();
  // Every portal.* route requires these three as real, required search
  // params (see src/routes/portal.tsx's own searchSchema) -- built
  // explicitly from the real runtime context here (rather than
  // `search={(prev) => prev}`) because PortalShell itself is shared
  // across routes with different search shapes, so there's no single
  // `from` route TanStack Router could type that callback against.
  const portalSearch = { organizationId, locationId, routerId };
  // `min-h-full`, not `h-full` -- the sole `constrained` caller (the Portal
  // Preview's laptop mockup) used to pair `h-full` with a fixed-height
  // parent box, which clipped (or forced an internal scrollbar on) any
  // guest-flow state taller than that box. `min-h-full` only sets a
  // floor, so this shell (and its fixed-height-turned-min-height parent)
  // can grow to fit whatever the real content needs instead of ever
  // clipping or needing to scroll.
  const heightCls = constrained ? "min-h-full" : "min-h-dvh";
  const hasBackgroundImage = !!config?.backgroundImageUrl;
  const backdropPlan = usePortalBackdropPlan();
  // v7 Part 3 -- see the footer's own comment. The template is split rather
  // than interpolated so the brand can be styled independently of the verb,
  // and split *here* rather than inline so the footer JSX stays readable.
  const [poweredByBefore, ...poweredByRest] = t("poweredByTemplate").split(WYFY_GUEST_TOKEN);
  const poweredByAfter = poweredByRest.join(WYFY_GUEST_TOKEN);

  return (
    <div
      className={cn(
        // "portal-runtime" is the selector PortalRuntimeContext's own
        // injected <style> scopes --pr-primary/--pr-accent/--pr-primary-
        // foreground and the v4 --pg-* token block to.
        "portal-runtime pg-shell relative w-full overflow-hidden",
        // The two-column desktop composition below is driven by Tailwind's
        // `lg:` *viewport*-width media query, not this element's own
        // (container) width -- fine for the real full-page guest route,
        // where the two always match, but not for the Portal Preview's
        // `constrained` mockup, which renders this same component inside
        // a much narrower fixed-width "laptop bezel" box while the
        // browser window itself can still be arbitrarily wide. Skipping
        // the whole `lg:` two-column treatment when constrained keeps
        // this to the single-column composition that already renders
        // correctly below that breakpoint, regardless of the real
        // window's width.
        !constrained && "lg:flex lg:items-center lg:justify-center",
        heightCls,
      )}
      // captive-portal-v7-design-spec.md §7.1/§7.4-1. What used to be here:
      //
      //   highContrast && "contrast-125 saturate-150",
      //   largeText && "text-[17px]",
      //
      // Both were removed because both were false. Running the Filter
      // Effects transforms and the WCAG luminance formula over the real
      // tokens, `contrast(1.25) saturate(1.5)` took `--pg-ink-faint`
      // #94A3B8 on #FFFFFF from 2.56:1 down to **2.30:1** -- and that token
      // was the placeholder colour in `PG_INPUT`, which until this branch
      // was the *only* labelling the sign-in fields had. The "high
      // contrast" control measurably reduced contrast on the only naming
      // the only form that matters had. (Reproduced, not taken on trust:
      // filter maths in the branch's scratch script, figures in the report.)
      // `text-[17px]` on this root could not cascade into a single one of
      // `pg-title`/`pg-body`/`pg-micro`/`text-sm`/`text-xs`/`h-[48px]` --
      // every one of those is absolute -- so "large text" did nothing at
      // all, to any element, ever.
      //
      // Neither option was deleted from the menu: removing the visible
      // control is a product decision (spec "Open items", item 3), not an
      // engineering one. Instead both are now honest. They set data
      // attributes that styles.css answers by **re-declaring tokens and a
      // type-scale multiplier** -- never a filter, which is blind to
      // tokens, blind to `forced-colors`, cannot tell text from photo, and
      // establishes a containing block for `position: fixed` descendants.
      // Contrast escalates on top of `prefers-contrast: more` rather than
      // replacing it (v7 §7.5, "escalation only").
      data-pg-contrast={highContrast ? "more" : undefined}
      data-pg-text-size={largeText ? "large" : undefined}
      // v7 §1.4 C3, the scrim's polarity, published to CSS as an attribute
      // rather than applied as inline colours. That is what makes the flip
      // work for text this component never sees: styles.css re-declares
      // `--pg-ink`/`--pg-ink-muted`/`--pg-ink-faint` to pure #FFFFFF under
      // `dark`, and re-declares them back inside `.pg-surface-card`. So the
      // ten `portal.*.tsx` routes that render a bare <h1> straight onto the
      // photo (§1.1 L1) follow the scrim automatically, with no edit to any
      // of them -- and every word that is already on a card keeps the dark
      // ink it should have. Absent entirely when there is no photo.
      data-pg-scrim={backdropPlan?.polarity}
      // v7 §1.1 L2 / §1.4 C3. The white card's only edge is `--pg-border`
      // #E2E8F0, which is 1.23:1 against the card itself and ~1.14:1 against
      // a bright photo -- the boundary dissolves and the headline reads as
      // floating text on a photograph. This is most likely the thing the
      // founder is actually looking at. Only set when the photo is measured
      // bright: over a dark photo a white card already has enormous edge
      // contrast and a heavy ring would be noise.
      data-pg-card-edge={backdropPlan?.strongCardEdge ? "strong" : undefined}
      // v7 §1.4 C5, the refusal rule, published for the same reason as the
      // polarity above: a route that has adopted `PortalTextPlate` can
      // let CSS decide, and QA can read the decision straight off the DOM.
      data-pg-headline={backdropPlan?.headlineOnCard ? "card" : undefined}
      style={{
        fontFamily: PG_FONT_STACK,
        background: "var(--pg-canvas, #F8F8FC)",
      }}
    >
      <GuestBackdrop
        backgroundImageUrl={config?.backgroundImageUrl}
        plan={backdropPlan}
        constrained={constrained}
      >
        {/* Below lg:, this fills the viewport edge-to-edge like every
         * phone/tablet captive-portal page should (single column, the
         * `lg:grid` below is a no-op until that breakpoint). At lg:
         * (laptop+) it becomes two columns -- a left context panel plus
         * the actual sign-in content on the right, vertically centered by
         * the parent's `lg:flex lg:items-center lg:justify-center` above
         * -- so a laptop-width viewport gets a considered composition
         * instead of a small card adrift in open gradient space. */}
        <div
          className={cn(
            // captive-portal-v5-design-spec.md §3.5: mobile gets the
            // primary layout pass, not desktop -- 80%+ of guest-WiFi
            // traffic is mobile (§0's external research). `pt-6` (24px)
            // used to start the card almost immediately at the top of the
            // viewport, leaving no room for the photo to read as a photo
            // before content starts. `pt-[12vh]` gives a deliberate
            // uncovered band of photo up top before the merged, shorter
            // card (§3.1-3.3) begins -- closer to "hero photo, then one
            // anchored card" than "card starting at the very top edge."
            // captive-portal-v7-design-spec.md §7.4-5: `viewport-fit=cover`
            // is set on the portal route (portal.tsx) with zero
            // `env(safe-area-inset-*)` anywhere in src/. On a notched
            // iPhone that puts the footer's `Terms` link -- a legal-consent
            // control -- under the home indicator, where the system's
            // swipe-up gesture intercepts the tap (also a 2.4.11 risk); in
            // landscape it puts the language/accessibility row in the notch
            // exclusion zone. The insets go on this content column rather
            // than the shell root on purpose: the backdrop photo and scrim
            // are `absolute inset-0` against the root's *padding* box, so
            // padding the root would letterbox the photo instead of
            // insetting the content. `max()` keeps today's 16px gutter as
            // the floor; `env()` is 0 everywhere that has no cutout, so
            // this is a no-op on every non-notched device and in the admin
            // Portal Preview.
            // captive-portal-v7-design-spec.md §2 W2, and a correction to it.
            //
            // W2 claims a long welcome message "reliably buries the primary
            // action on a 667px device" at three or four lines. Measured, at
            // the default type scale that is **false**: a five-line message on
            // 375x667 puts the CTA's bottom edge at 584px, comfortably above
            // the fold, and 360x640 gives 598px. The claim only becomes true
            // once Part 7's own text-size control is on:
            //
            //   375x667, scale 1.25, 5-line message -> CTA bottom 703px  (fold 667)
            //   360x640, scale 1.25, 3-line message -> CTA bottom 661px  (fold 640)
            //   360x640, scale 1.25, 5-line message -> CTA bottom 717px  (fold 640)
            //
            // So this is not really an authoring problem, it is an
            // interaction between a long message and the accessibility
            // control -- which means an admin character limit alone cannot
            // fix it, and a guest who needs larger text is exactly the guest
            // who should not have to hunt for the button.
            //
            // `12vh` of deliberately-uncovered photo above the card is Part
            // 1's decision and stays untouched wherever there is room for it.
            // But on a short viewport it is 77px of decoration bought with
            // the primary action, which is not a trade Part 1 was choosing --
            // it predates the type-scale control. The height query is the
            // narrowest possible fix: it fires only where the fold is
            // actually at risk, changes nothing on a 390x844 or a desktop,
            // and keeps the safe-area inset intact. Recovers 38px at 640px
            // tall and 40px at 667px.
            "relative z-10 mx-auto flex w-full max-w-[420px] flex-col pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(12vh+env(safe-area-inset-top))] [@media(max-height:720px)]:pt-[calc(6vh+env(safe-area-inset-top))] sm:max-w-[460px] md:max-w-[520px]",
            // See this component's own top-level comment on `constrained` --
            // these `lg:` classes assume this element's width tracks the
            // real browser viewport, which isn't true inside the Portal
            // Preview's narrower fixed-width mockup. No BrandPanel column
            // (`showBrandPanel={false}`, the shared connecting-state
            // callers) means there's nothing to grid against -- stays a
            // single centered column at every width instead of leaving a
            // blank first grid cell.
            // §3.3: sign-in column max-width 480px -> 440px -- gives the
            // photo back real width in the two-column composition without
            // meaningfully cramping the form.
            !constrained &&
              (showBrandPanel
                ? "lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16 lg:px-12 lg:py-10 xl:gap-24"
                : "lg:max-w-[440px]"),
            heightCls,
          )}
        >
          {!constrained && showBrandPanel && (
            <div className="hidden lg:block">
              <BrandPanel venueName={config?.name} hasBackgroundImage={hasBackgroundImage} />
            </div>
          )}
          <div
            className={cn(
              "flex w-full flex-col",
              !constrained && "lg:mx-auto lg:w-full lg:max-w-[440px]",
            )}
          >
            <div className="mb-2 flex items-center justify-end gap-1.5">
              <LanguageSwitcher tone="light" />
              <A11yMenu tone="light" />
            </div>
            {/* CSS-only mount fade-in (`pg-enter`, defined in styles.css)
             * -- a single 150-200ms ease-out fade/translate on mount
             * doesn't need a JS animation library. */}
            <main className={cn("pg-enter flex flex-1 flex-col", contentClassName)}>
              {children}
            </main>
            {/* captive-portal-v7-design-spec.md Part 3.
             *
             * This footer used to be one `flex` row of four dot-separated
             * children -- Terms, "Support: ask venue staff", and "Powered by
             * Wyfy Guest" -- all five in `--pg-ink-faint` at `pg-micro`.
             *
             * §3's complaint is that the attribution is illegible. That was
             * half the story, and the token retune fixed that half. The
             * other half is that **its problem was never its size, it was
             * its company**: a line sitting third in a dot-list next to
             * "Support: ask venue staff" reads as legal boilerplate by
             * association, and no amount of enlarging it fixes that. §3 P5
             * and §8.3 want the opposite reading -- a named operator across
             * venues is a *trust asset* to a guest who (per the survey data
             * in §8.3) is connecting while actively believing public WiFi is
             * unsafe.
             *
             * It was also literally broken, which §3 P2 suspected and marked
             * "not visually confirmed. QA must check this". Confirmed, at
             * 390x844 in a real browser: the row is ~362px of content in a
             * 326px box, so it already wraps to two lines today, in English,
             * on the design-target viewport -- with the separator dots left
             * stranded at mid-height between two ragged columns, inside a
             * `rounded-full` box whose 23px end-caps make a two-line pill
             * look like a rendering fault. In Hindi at 320px it is three
             * lines. So restructuring costs no height; it recovers some.
             *
             * The fix is three moves, and only one of them is new pixels:
             *
             *  1. **Two rows.** Utility copy on the first, the mark alone on
             *     the second. Removed from the disclaimer list.
             *  2. **Contrast, not size, carries the promotion.** "Powered by"
             *     stays `--pg-ink-faint`; the brand goes to `--pg-ink`, the
             *     darkest value in the system. Measured against the worst
             *     real composite of this zone (#D9D9D9, the plate at 85%
             *     alpha over a near-black photo region) that is 4.66:1 ->
             *     12.65:1, a 2.7x gain, **at exactly the same 11px**. That
             *     ratio is the whole argument: the mark gets materially more
             *     presence without taking one pixel of size from the venue's
             *     own name, which matters because the venue is the customer.
             *  3. **A 14px monochrome mark**, so the line reads as a lockup
             *     rather than a sentence. See `PortalFootnoteMark`.
             *
             * `flex-wrap` + `min-w-0` are the §3 P2 fix proper; `gap-y` means
             * that when row 1 does wrap it wraps deliberately, with the dots
             * as flex items on their own rather than stranded mid-height.
             *
             * The bespoke `hasBackgroundImage && cn(GUEST_LEGIBILITY_CARD_
             * CLASS, "rounded-full px-4 py-2")` branch is GONE, replaced by
             * the existing `PortalTextPlate` primitive. That is a functional
             * upgrade, not a refactor: the plate is `w-fit`, so it still
             * covers its own content and not one pixel more (§0.1 item 1 --
             * two content-sized rows in one bounded surface is not PR #81;
             * PR #81 was one panel sized to the *column*, independent of
             * content), it renders bare on the flat canvas with no photo,
             * and -- the part the footer did not have before -- it picks up
             * §1.4 C5's refusal rule, so on an image measured hostile the
             * plate goes opaque and the mark jumps to 17.85:1. It also fixes
             * the radius honestly: `rounded-[20px]`, the shared family
             * value, which is what a two-line block should have had all
             * along. */}
            <footer className="mt-8">
              <PortalTextPlate className="px-4 py-2.5">
                {/* One link, not two -- /portal/terms already covers both
                 * Terms of service and Privacy policy as separate sections.
                 * "Support" has no real guest-facing contact field wired
                 * through /captive-portal/resolve today, so it stays plain
                 * text rather than a fabricated mailto/tel link -- visually
                 * set apart (no separator, dimmer, non-interactive) so it
                 * doesn't read as a third, silently-broken link next to a
                 * real one. */}
                {/* The `·` separator that used to sit between these two is
                 * gone, and a permanent underline has replaced it. Two
                 * independent reasons, both found by looking at real
                 * renders rather than by taste:
                 *
                 *  - **The separator cannot survive wrapping.** As a flex
                 *    item it stays glued to the end of line 1 when the row
                 *    breaks, leaving a dangling dot -- visible today at
                 *    390x844 in English, and at 320px in Hindi it stranded
                 *    dots at mid-height between two ragged columns. There is
                 *    no CSS that hides a separator only when it lands last
                 *    on a line, so the honest fix is not to need one.
                 *  - **The link was not identifiable as a link.** `Terms &
                 *    privacy` is an anchor rendered in exactly the same
                 *    colour, size and weight as the static "Support: ask
                 *    venue staff" beside it, with the underline appearing
                 *    only on `:hover` -- which does not exist on the phone
                 *    every guest is holding. So the one legal-consent
                 *    control in the footer had no visual affordance at all
                 *    on touch. Underlining it permanently distinguishes the
                 *    two items far better than a dot did, and it is what
                 *    made dropping the dot possible. */}
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 pg-micro text-[var(--pg-ink-faint)]">
                  <Link
                    data-pg-measure="footer-terms"
                    to="/portal/terms"
                    search={portalSearch}
                    className="underline decoration-1 underline-offset-2 hover:text-[var(--pg-ink-muted)]"
                  >
                    {t("termsTitle")}
                  </Link>
                  <span>{t("supportAskStaff")}</span>
                </div>
                {/* v7 Part 3 P4 -- `!== false`, not `=== true` or a bare
                 * truthy check: `config` is legitimately undefined on the
                 * standalone error surfaces that render this shell without a
                 * runtime, and the mark must default to PRESENT -- absence
                 * of the white-label entitlement field can never mean
                 * white-label. Only the backend's explicit `false` (which it
                 * 402-gates behind `white_label.*`) removes the row. */}
                {config?.poweredByEnabled !== false && (
                  <a
                    data-pg-measure="powered-by"
                    // The research's "link it": the mark resolves to the real
                    // operator, which is the anti-spoofing half of its job --
                    // an evil twin can copy the pixels but not the domain.
                    // `target="_blank"` is deliberate and load-bearing on the
                    // walled-garden path: pre-auth, wyfyguest.com is
                    // unreachable, and navigating THIS document to it would
                    // dump the guest's half-finished sign-in on an error
                    // page inside the CNA. A new tab/window fails harmlessly
                    // (and in the iOS CNA, which suppresses window.open-ish
                    // navigation, a no-op is the correct worst case).
                    // No underline: this is the site's own footer-lockup
                    // treatment, and the row it sits in already has exactly
                    // one underlined element (the terms link) as the "this
                    // is a link" affordance for the row above.
                    href="https://wyfyguest.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 flex min-w-0 items-center justify-center gap-1.5 pg-micro text-[var(--pg-ink-faint)]"
                  >
                    {/* Sized in `em`, not `px`. A fixed `h-3.5` would stay 14px
                     * while the words beside it grew to 13.75px and beyond
                     * under Part 7's `--pg-type-scale`, so the lockup would
                     * come apart for exactly the guest who turned the text
                     * size up. `1.25em` against `pg-micro`'s 11px is 13.75px
                     * at the default scale and 17.2px at 1.25, keeping the
                     * mark and the wordmark in fixed proportion at every
                     * setting -- and it inherits the platform's own text
                     * scaling for free, since `pg-micro` is authored in
                     * `rem`.
                     *
                     * `--pg-brand-accent` (wyfyguest.com violet-700 #6D28D9) on
                     * the mark, `--pg-ink` on the wordmark: that is the site's
                     * own header lockup -- coloured shield, dark wordmark --
                     * reproduced exactly, and it is the strongest brand match
                     * available on this screen at zero bytes. It is applied as
                     * a `color`, not as an SVG `fill`, so the glyph's
                     * `currentColor` still resolves to `CanvasText` under
                     * `forced-colors: active`; a hardcoded hex inside the SVG
                     * would survive forced colours and should not.
                     * 5.02:1 against the worst plate composite as a non-text
                     * graphic, where SC 1.4.11 asks 3:1. */}
                    <PortalFootnoteMark className="h-[1.25em] w-[1.25em] text-[var(--pg-brand-accent)]" />
                    {/* Split on `{brand}` rather than interpolated, because the
                     * two halves are styled differently and because the word
                     * order flips between languages -- Hindi puts the brand
                     * first ("{brand} द्वारा संचालित"), so a fixed prefix/suffix
                     * pair would be wrong. Same reason `courtesyOfTemplate`
                     * exists. `split` with a limit of 2 is not used on purpose:
                     * if a future translation ever contains the token twice,
                     * losing the tail is a visible bug, whereas rendering it
                     * twice is at least self-evident.
                     *
                     * `whitespace-nowrap` on the brand only. A brand name broken
                     * across two lines is precisely the "something is wrong with
                     * this page" cue §8.3 describes, and at 320px in Hindi this
                     * row is genuinely tight. Wrapping is still permitted
                     * *between* the mark and the text. */}
                    <span>
                      {poweredByBefore}
                      <span
                        data-pg-measure="powered-by-brand"
                        className="whitespace-nowrap text-[var(--pg-ink)]"
                      >
                        {WYFY_GUEST_BRAND}
                      </span>
                      {poweredByAfter}
                    </span>
                  </a>
                )}
              </PortalTextPlate>
            </footer>
          </div>
        </div>
      </GuestBackdrop>
    </div>
  );
}

export function PortalCard({ children, className }: { children: ReactNode; className?: string }) {
  // Flattened: a thin 1px border + a small, tight shadow, not a heavy
  // glass-card blur/spread -- see this component's own history.
  // captive-portal-v5-design-spec.md §3.1/§3.3: radius unified to
  // `rounded-[20px]` (matches GUEST_LEGIBILITY_CARD_CLASS -- one shared
  // value across this card family, not two independently-tuned ones) and
  // padding trimmed `p-6` (24px) -> `p-5` (20px), still comfortably above
  // Purple's 44px touch-target floor (fields, not padding, need the room).
  //
  // v7 §1.1 L2 / §1.4 C3 -- the adaptive edge. Text *on* this card was never
  // the problem (17.85:1, fine); the card's own boundary was. Its only edge
  // is `--pg-border` #E2E8F0 at 1.23:1 against the card plus a faint shadow,
  // and against a bright photo -- a white lobby, an overcast sky -- white
  // card on bright photo measures ~1.14:1. The boundary vanishes, the card
  // stops reading as a surface, and the headline on it reads as text
  // floating on a photograph. That is very likely the actual complaint that
  // started v7.
  //
  // The fix is a real ring, but only when it is needed. `#64748B` measures
  // **4.76:1 against the white card**, comfortably clearing SC 1.4.11's 3:1
  // for a non-text boundary -- and note that ratio is between two colours we
  // control, so it holds no matter what the photo does behind it, which is
  // the property that makes it safe against an image we have never seen.
  // The heavier, wider shadow underneath does the rest of the separation
  // work perceptually. Nothing here covers one extra pixel of photo: this is
  // an edge, not a panel (§0.1 item 1).
  //
  // Driven by the `data-pg-card-edge` attribute on the shell root rather
  // than by a prop, because eleven `portal.*.tsx` routes call this component
  // with nothing but children and none of them should have to know.
  const plan = usePortalBackdropPlan();
  const strongEdge = plan?.strongCardEdge ?? false;
  return (
    <div
      className={cn(
        "pg-surface-card rounded-[20px] border bg-[var(--pg-surface)] p-5",
        strongEdge ? "border-[#64748B]" : "border-[var(--pg-border)]",
        className,
      )}
      style={{
        boxShadow: strongEdge
          ? "0 1px 2px rgba(30,27,75,0.10), 0 12px 32px -10px rgba(30,27,75,0.45)"
          : "0 1px 2px rgba(30,27,75,0.06), 0 8px 24px -12px rgba(30,27,75,0.18)",
      }}
    >
      {children}
    </div>
  );
}
