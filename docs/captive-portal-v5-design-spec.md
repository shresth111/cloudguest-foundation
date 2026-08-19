# Captive Portal v5 — Design Spec

Founder feedback on v4, verbatim: **"ye bada bekar lag raha hai"** — and two specific, concrete complaints:

1. The background photo still isn't coming through right.
2. The welcome / sign-in box is too big / too dominant.

This document is the Senior Design Engineer's visual-direction and layout-proportion brief for v5, grounded in (a) real external research into how other guest-WiFi/captive-portal products solve this exact problem, and (b) a first-hand look at the live page, not a re-read of our own prior specs. It is a shared doc — the UI/UX Engineer and Graphic Designer own separate sections below (placeholders included); this section is Visual & Layout only.

**Everything below was checked directly** — the live production URL (`app.wyfyguest.com/portal/welcome`, screenshotted at 1440×900 on 2026‑08‑19) and the actual code on `feat/portal-powered-by-footer` (HEAD `06afd9e`), which is the branch that actually carries the shipped v4 work (`GuestBackdrop`, the per-zone legibility cards, the token/typography system). **Local `main` does not contain any of the v4 portal work** — it's 14 commits behind `origin/main` on unrelated work and was never the right base to read the "current state" from. Anyone auditing this surface next should check out `feat/portal-powered-by-footer`, not `main`.

---

## 0. Real external research — what other products do here, and what we're taking from each

This is the exact problem — a sign-in card floating over a venue's own photo — that guest-WiFi splash-page vendors exist to solve, so their own written guidance is directly on-point, not generic taste:

- **[Purple](https://www.purple.ai/en-us/guides/the-10-best-wifi-splash-page-examples-and-what-makes-them-work) — "10 Best WiFi Splash Page Examples" + [Splash Page Design Best Practices](https://www.purple.ai/en-us/guides/splash-page-design-best-practices).** Purple is a dedicated guest-WiFi splash-page vendor (competitor product category to this one). Their concrete, checkable guidance: over 80% of guest-WiFi connections happen on mobile, so mobile is the primary design target, not a breakpoint afterthought; touch targets should be ≥44×44px (WCAG 2.1); **the authentication form is described as "the central element" and "the most visually prominent interactive component"** — singular, one element, not several competing panels; visual hierarchy is brand-identity zone → one concise value proposition → the form, in that order, not each repeated independently; total page weight should stay well under 500KB and images should be compressed/WebP, targeting LCP under 2.5s. **What we're taking:** the "one central form element" framing directly indicts our current three-panel composition (see §1) — this is the single strongest piece of external validation for merging panels, not inventing the idea internally. **What we're avoiding:** Purple's own examples lean toward social-login/marketing-capture splash pages optimized for data collection; that's not our model — we're not adding a value-prop marketing zone, we're removing the redundant one we already over-built.
- **[SplashAccess](https://www.splashaccess.com/hotel-wifi-login-page/) (Meraki splash-page specialist) — hotel WiFi login guide + [splash page examples](https://www.splashaccess.com/splash-page-examples/).** Reinforces "keep the message short," "buttons obvious," and explicitly: **"most guests are joining from phones, not laptops."** Separately, Meraki's own splash-page customization is HTML/CSS only (no JS) — a useful outside data point that the entire guest-WiFi industry treats this surface as something that must render correctly with zero animation dependency, which validates this codebase's own zero-framer-motion policy on this exact surface (already decided in v4 §5 — not re-litigated here, just independently corroborated).
- **[Ubiquiti UniFi community guidance](https://community.ui.com/questions/Guest-Portal-Customization-Responsive-Background-Image/59cfd5cb-7a21-4591-8486-a69b89b2c68b) on guest-portal background images.** UniFi's own admin-facing advice is blunt: pick a background image you can still read text over — their literal example is "a picture of coffee beans... might work better than a photo of your shop." That's a vendor telling *admins* to choose low-detail photos so **one** text zone stays legible — it assumes a single content zone over the photo, not several. Also specifies a real minimum source resolution (1280×720) to avoid the soft/stretched look a low-res upload produces at wide viewports — directly relevant, our own `PortalShell` comment already flags this as "the customer's problem to fix," but we should still pick a default `background-position` that degrades gracefully rather than assuming a perfectly-composed source image (see §3).
- **[Android's own captive-portal system UI](https://developer.android.com/about/versions/11/features/captive-portal) / [AOSP CaptivePortalLogin](https://source.android.com/docs/core/connect/android-custom-tabs-captive-portal).** Not a design showcase, a useful outside reference point: the OS-level captive-portal flow is deliberately chrome-minimal — no stacked branding panels, no marketing zone, one sign-in surface. When even the platform that *invented* this UI pattern treats it as "get the guest through, minimally," it's a corroborating signal against our own page's current three-panel stack, not just an aesthetic opinion.
- **Dribbble/Behance ("captive portal," "hotel wifi login," "guest wifi splash page") searched, not deep-audited.** These confirm the pattern space is real and actively designed-for (multiple live shot collections exist), but the search/fetch tooling available here can't reliably extract pixel-level layout facts from JS-rendered Dribbble shot pages — so nothing below is sourced to a specific unverified Dribbble shot. Where this doc makes a layout call, it's sourced to the vendor guidance above or to our own live-page audit (§1), not to an unconfirmed screenshot description.

**Net takeaway from research:** every real source that says anything concrete about this exact composition (photo + form) converges on the same two points — **(1) one form element, not several**, and **(2) mobile is the primary target, not desktop**. Our current page violates both: it renders three separate opaque panels, and the tallest, most cramped version of the layout is exactly the one every real guest sees.

---

## 1. Live-page audit — what's actually wrong, first-hand

Screenshotted `https://app.wyfyguest.com/portal/welcome?...` directly (desktop viewport, real production data — an actual venue's uploaded temple photo, not a placeholder). Two things are visible immediately, and neither is "is the photo technically rendering":

**1a. The photo reads as a hazy backdrop fragment behind a collage of white stickers, not a hero image.** Three independently-shaped opaque panels are visible simultaneously: the left `BrandPanel` card, and on the right, *two separate stacked cards* — a logo/heading card ("Welcome to WYFY-GUEST" / "Connect to continue.") sitting directly above, with a visible gap of raw photo showing between it and, a few pixels below, the actual sign-in form card. Nothing about where these three shapes land was decided relative to *this* photo — the strongest part of the image (the temple's spire and upper facade, the actual subject) sits directly under the heaviest part of the top vignette scrim, which is close to fully opaque white at the very top of frame. The single most visually interesting part of the photo is the part most washed out. This is the concrete version of "doesn't feel like a considered hero treatment" — the composition would look identical over almost any photo, because it isn't actually composed against this one.

**1b. The right-hand column is functionally one continuous block of white from ~15% to ~85% of viewport height**, split only by a thin sliver of visible photo between the two stacked cards — which reads as a rendering gap, not a deliberate reveal. Between the two cards: a full brand mark (up to 96px on desktop), an "H1" heading, a purely decorative subheading ("Connect to continue." — not venue-configured copy, just a hardcoded filler line, see §3), a two-tab pill at 52px min-height, a labeled input at 52px, a checkbox row, and a 52px primary button. Every individual choice here is defensible; the sum is a sign-in surface that's taller than most of the actual photo it's supposed to be sitting on top of. This is complaint #2, confirmed directly, not inferred.

This matches the founder's complaint exactly and is consistent with what the external research above says is wrong with this pattern in general (§0): too many panels, not sized for the primary (mobile, glanceable) use case.

---

## 2. Read the history first — this problem has already round-tripped twice; don't make it three

Confirmed via `git log` on `src/components/portal-runtime/`:

1. **`ce818d0`/`f487ecd`** — "Fix guest sign-in header illegible against a real background photo" — a targeted, per-element fix (`GuestSignInCard`'s header got its own `bg-white/80 backdrop-blur-md` card), independently duplicating a fix `BrandPanel` had already gotten weeks earlier. Correct fix, wrong mechanism (opt-in per block, not structural).
2. **`6a6e91f`/`1045634`** — "Captive portal v4: structural legibility fix" — over-corrected the opposite direction: a single `GuestBackdrop` panel at `bg-white/92` wrapping the *entire* content column (logo through footer), on the reasoning that one structural guarantee beats three independently-drifting patches. **This is the exact same complaint #1 the founder has now, already shipped once and already reverted** — a real live regression, confirmed in the v4 spec's own §3: "confirmed live on production... the venue's real background photo was reduced to a barely-visible ghost."
3. **`e776dac`/`9021c01`** — "Fix GuestBackdrop washing out the venue photo instead of just backing text (live regression)" — reverted back to bounded, per-zone cards (current shipped state), correctly keeping the one real structural win (a shared `GUEST_LEGIBILITY_CARD_CLASS` constant) while dropping the full-page wash.

**The lesson v5 must not re-learn a third time: the axis that was wrong both previous times was *coverage area* (how much of the page one panel eats), not *number of panels* per se.** Round 2's mistake wasn't "it used one panel" — a single panel is right per §0's research — its mistake was making that one panel span the *entire* content column including the photo's own breathing room. v5's fix (§3below) merges panels **and** keeps the merged panel bounded and small, specifically so it doesn't reintroduce round 2's failure mode under a different name. This is the throughline the UI/UX Engineer and FE builder both need before touching this file.

---

## 3. v5 visual direction

**One line:** one small, bounded, unified sign-in card — not three panels, not a full-column wash — anchored so the photo's own subject stays the visible hero, with the card confined to genuinely negative (visually quiet) space rather than centered indifferently on top of whatever the venue uploaded.

### 3.1 Merge the two right-column panels into one card

Currently `GuestSignInCard`'s header (logo + heading + subtext) wraps in its own `GUEST_LEGIBILITY_CARD_CLASS` panel, separate from `PortalCard`'s form panel below it. **v5 merges these into a single card** — one border, one shadow, one radius, the logo/heading sitting inside the same bounded surface as the tab pill and form fields, not floating above it with a gap of raw photo in between. This directly removes one of the three panels the live audit found (§1), and is exactly what Purple's "the form is the central, most visually prominent element" framing (§0) argues for — one thing, not two stacked things.

`BrandPanel` (desktop-only, left column) stays a separate card — it has to, it's a different grid column — but its radius/padding are brought in line with the merged card below so the two read as one visual family (same corner radius, same shadow recipe) rather than two independently-tuned components that happen to share a class name.

### 3.2 Drop the decorative filler subtext

`"Connect to continue."` is not venue-configured copy — it's a hardcoded fallback (`t("signInSubtext")`) that renders whenever `config.splashWelcomeMessage` is empty, which is the common case. It adds a full text row (line-height + margin) for zero real information. This codebase already has a standing principle against exactly this shape of problem — `BrandPanel`'s own comment describes deliberately dropping a fabricated "~15 seconds" timing claim because "this codebase has no real config field to back" it. Apply the same discipline here: **when there's no real venue-authored welcome message, don't render a placeholder line at all.** The heading ("Welcome to [venue]") already carries the necessary information on its own. This is a genuine height reduction, not just a copy trim — cutting a real row, not shortening one.

### 3.3 Tighten the sizing scale (concrete deltas from the current shipped tokens)

| Element | Current (shipped) | v5 | Why |
|---|---|---|---|
| Card padding | `p-6` (24px) | `p-5` (20px) | Every screen edge of the card is currently spending 24px on air; 20px is still generous, not cramped, per Purple's 44px-target floor (fields, not padding, need the room). |
| Logo | 64/80/96px (mobile/sm/md) | 48/56/64px | The brand mark doesn't need to out-size the actual heading text it sits above; this alone removes ~30-40px of vertical space at every breakpoint. |
| Input / button height | `h-[52px]` | `h-[48px]` | Still well above the 44×44px WCAG/Purple floor — this is trimming excess, not undercutting accessibility. |
| Tab pill height | `min-h-[52px]` | `min-h-[46px]` | Matches the field-height trim above; the pill shouldn't be taller than the inputs it sits above. |
| Card corner radius | `rounded-3xl` (header) / `rounded-2xl` (form) — two different values | One value, `rounded-[20px]`, everywhere this card family appears | Removes the "two slightly different rounded rectangles glued together" seam that's part of why the current composition reads as assembled rather than designed. |
| Vertical rhythm inside card | `gap-5`/`space-y-3.5` (20px/14px) | `gap-4`/`space-y-3` (16px/12px) | Modest, deliberate tightening — not so tight it feels crowded, but every row currently has more air than the content needs. |
| Sign-in column max-width (desktop) | `480px` | `440px` | Gives the photo back real width in the two-column composition without meaningfully cramping the form (still comfortably wider than the 320px minimum Purple's guide cites as the floor). |

Stacked, these add up to a card that's noticeably — not subtly — shorter: roughly 150-180px shorter at desktop once the merge (§3.1) and the dropped subtext (§3.2) are counted in, which is the actual "too big" complaint addressed by arithmetic, not vibes.

### 3.4 Give the photo back its own visible identity

Two concrete, code-level changes, both scoped to `GuestBackdrop`/`PortalShell`, neither touching the per-zone legibility mechanism itself (§2's lesson — don't touch coverage area the wrong direction again):

- **Reduce the top-vignette scrim's peak opacity** from `rgba(255,255,255,0.8)` at the very top to `rgba(255,255,255,0.55)`, and widen the fully-transparent middle band from `34%–72%` to `24%–78%`. With the merged, shorter card from §3.1–3.3 needing less protected space, the scrim no longer needs to run this dark this high up the frame — this is a direct, proportionate response to the card getting smaller, not an independent aesthetic call (and specifically *not* round 2's mistake — this is tuning the *scrim's* opacity curve, not turning the *card* into a full-column panel again).
- **Set a deliberate default `background-position`** (`center 25%` instead of today's `bg-center`) for the full-bleed photo. On a portrait-oriented venue photo (a building, signage, an entrance — the common case, confirmed live on the temple photo used in the audit), dead-center cropping tends to center empty sky/foreground and cut the actual subject at the frame edges. Anchoring a quarter of the way down keeps a typical architectural subject's upper two-thirds in frame at wide/short viewport ratios. This is a default, not a fix for every possible photo — flag to the Graphic Designer/PM as a real follow-up candidate: a per-location focal-point picker in the portal settings (out of scope for this pass — no such field exists in `RuntimePortalConfig` today, and per this codebase's own standing rule, don't invent one client-side without the backend field to back it).

### 3.5 Mobile gets the primary layout pass, not desktop

Per §0's research (80%+ of guest-WiFi traffic is mobile, confirmed by the one vendor source that actually publishes a number), the current single-column mobile layout starts the content block at `pt-6` (24px) — meaning the sign-in card begins covering the photo almost immediately at the top of the viewport, leaving no room for the photo to read as a photo before content starts. v5 increases top clearance on the single-column layout (`pt-[12vh]` or equivalent, tuned so the card's *bottom* still comfortably clears the fold on a typical 375–430px-wide device) so there's a deliberate uncovered band of photo at the top before the merged card begins — closer to a "hero photo, then one anchored card" composition than "card starting at the very top edge." This is the highest-leverage single change for the majority of real guests, per the research in §0, not a desktop nice-to-have.

---

## 4. Updated token deltas (for `src/styles.css` / `PortalGuestUi.tsx`)

No new token *names* — v5 tunes existing `--pg-*` values and Tailwind utility choices, it doesn't introduce a second system:

```
Unchanged (already correct, don't touch):
  --pg-canvas: #FAFAF8
  --pg-surface: #FFFFFF
  --pg-ink / --pg-ink-muted / --pg-ink-faint: #0F172A / #64748B / #94A3B8
  --pg-border: #E2E8F0
  --pg-danger* / --pg-success

Tuned in v5 (see §3.3 table for the full list):
  Card radius        rounded-3xl / rounded-2xl (mixed) → rounded-[20px] (single value)
  Card padding        p-6/p-8 (mixed)                   → p-5
  Field/button height h-[52px]                           → h-[48px]
  Tab pill height     min-h-[52px]                       → min-h-[46px]
  Sign-in column max  480px                               → 440px
  Legibility scrim    0.8 peak / transparent 34–72%      → 0.55 peak / transparent 24–78%
  Photo position       bg-center                          → center 25%  (background-position)
```

---

## 5. FE build brief

File-level, same format the v4 spec used so this reads consistently to whoever picks it up:

1. **`src/components/portal-runtime/GuestSignInCard.tsx`** — remove the header block's own `GUEST_LEGIBILITY_CARD_CLASS` wrapper div; move logo/heading/subtext to render *inside* `<PortalCard>`, above the tab switcher, as one continuous card. Drop the subtext `<p>` entirely when `config?.splashWelcomeMessage` is empty (§3.2) — no fallback string.
2. **`src/components/portal-runtime/PortalShell.tsx`** — `BrandPanel`'s legibility card and the merged sign-in card both move to `rounded-[20px]` / `p-5`; sign-in column `lg:max-w-[480px]` → `lg:max-w-[440px]`; single-column mobile content wrapper gets increased top clearance per §3.5.
3. **`GuestBackdrop`** (in `PortalShell.tsx`) — tune `GUEST_BACKDROP_SCRIM`'s gradient stops per §3.4; add `backgroundPosition: "center 25%"` alongside the existing `backgroundImage`/`bg-cover` styling on the full-bleed photo `<div>`.
4. **`src/components/portal-runtime/PortalGuestUi.tsx`** — `PG_PRIMARY_BTN`/`PG_INPUT` height `h-[52px]` → `h-[48px]`.
5. **`AuthTabSwitcher.tsx`** — tab pill `min-h-[52px]` → `min-h-[46px]`; internal `gap-5`/`mb-5` spacing → `gap-4`/`mb-4` per §3.3.
6. Nothing in this brief touches: the auth state machine (`useGuestSignIn.ts`), the flow/routing, the zero-framer-motion policy, i18n, or the non-negotiable invariants already locked in the v4 spec (hotspot-login POST mechanics, resubmit cooldown, etc.) — this is a visual/layout-only pass, consistent with this doc's own scope.
7. **Explicitly do not** touch `GuestBackdrop` in the direction of wrapping more content in one panel, or increasing scrim opacity/coverage — that's round 2's mistake (§2), and the fix this time is the opposite direction: smaller card, lighter scrim, more visible photo.

---

## 6. Hand-off boundaries

- **This section (Visual & Layout, Senior Design Engineer) owns:** card composition/merge decision, sizing scale, photo/scrim treatment, spacing tokens, the mobile-primary layout call in §3.5.
- **UI/UX Engineer owns (section below, not written here):** whether any interaction/flow change is needed to make the smaller card still feel complete (e.g., does collapsing the subtext change how the tab switcher's default state reads) — flagging as a question for that section rather than assuming an answer here.
- **Graphic Designer owns (section below, not written here):** actual illustration/asset treatment for the `/portal/closed` and empty/no-photo states referenced in the v4 spec, and any future focal-point/crop-guidance tooling for venue photo uploads flagged in §3.4.
- **Where this section needs their sign-off before FE builds it:** the mobile top-clearance value in §3.5 (needs a real-device check, not just a viewport-width simulation) and the reduced scrim opacity in §3.4 (needs a check against a genuinely dark or genuinely bright real venue photo, not just the one temple photo this audit used — a single example is real evidence, not exhaustive evidence).

---

## UX v5 — UI/UX Engineer

*(Add your section here.)*

## Asset & Illustration v5 — Graphic Designer

*(Add your section here.)*
