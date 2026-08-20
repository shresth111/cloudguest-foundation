# Captive Portal v6 — Design Spec

Founder feedback after v3/v4/v5, verbatim in spirit: every one of those passes fixed something real (motion restraint, structural legibility, one merged card, bundle size) but the result still doesn't feel genuinely next-generation — and this time the ask is explicit: **do real research against real open-source projects, land a genuinely distinctive premium direction, and ship two real admin-configurable features** (font choice, background-overlay control), engineered against this surface's actual constraints, not just styled.

This document does four things in order: (0) real external research, cited; (1) an honest internal audit of what "distinctive" has to mean here given what v3–v5 already spent (including a real bug this audit found: the admin UI already *has* a font picker, and it's fake); (2) the v6 visual thesis; (3) the two features' full design — data model, loading mechanics, UI, constraints; (4) the BE/FE build brief.

---

## 0. Real research — open-source captive portals, and what "premium" actually means in 2026

### 0.1 The open-source captive-portal landscape, actually looked at

Searched and fetched directly, not summarized from memory:

- **[openwisp-wifi-login-pages](https://github.com/openwisp/openwisp-wifi-login-pages)** (OpenWISP project) is the one genuinely well-regarded, actively-maintained, *configurable* captive portal in this space — a real React/Node client with per-organization config, login/signup/social-login/SMS-verification/payment flows, i18n. It's the closest thing to a real competitor to this codebase's own architecture (a shared component tree, themed per-tenant via config), which makes it the most useful comparison point, not a vague "best-in-class" citation.
- **[openNDS](https://github.com/openNDS/openNDS)** (484★) and **[nodogsplash](https://github.com/nodogsplash/nodogsplash)** (951★) — the two most-starred *embedded-gateway* captive portals (they run on OpenWRT routers themselves, not a hosted backend like this product). Their own docs describe splash-page theming as "simple changes to content" via raw HTML/CSS or a FAS (Forward Authentication Service) API — real, working, but explicitly minimal-tooling: no font system, no structured branding config, "edit the HTML" is the actual admin experience.
- **[unixfy/captive-portal](https://github.com/unixfy/captive-portal)**, built for OpenWRT + NoDogSplash — fetched directly: Bootstrap 3 + jQuery 3.3.1 slim, no design system, no screenshots even in its own README.
- **apfree-wifidog** (931★) and the historical **WiFiDog** project — infrastructure-focused (gateway/AAA), not visual references at all.

**The actual finding, stated plainly:** the open-source captive-portal category is functionally mature but visually stuck in a Bootstrap-template era — nobody in this space has shipped a genuinely *adaptive*, per-venue-considered visual system. There is no open-source captive portal worth copying pixel-for-pixel for "premium." That's not a dead end — it's the actual opportunity, and it reframes what v6 should be chasing: the premium bar for this surface has to come from *outside* the category (general SaaS/consumer auth), and the durable differentiator *inside* the category isn't a nicer gradient, it's that this product can make a temple's WiFi page and a co-working space's WiFi page both look bespoke from one shared codebase — which none of the above do. This directly motivates §2's thesis and both features in §3.

### 0.2 What "premium" actually means in real 2026 SaaS/consumer products

- **[Linear/Vercel/Raycast aesthetic, analyzed directly](https://studiomaydit.com/blog/linear-vercel-raycast-aesthetic):** the concrete, checkable techniques, not vibes — "a precise, confident typographic system, a clear scale, tight and intentional spacing, high-quality typefaces"; "near-greyscale with a single, deliberate accent colour used sparingly"; "one idea per section," ruthless reduction; "subtle, purposeful animation that guides attention, never decoration for its own sake"; and critically, **"real hover states, considered empty states, honest microcopy, pixel-level care"** — the premium signal is resolution of detail, not added ornament. This validates, not contradicts, this surface's existing zero-framer-motion/flat-canvas policy (§1.2) — it's the same restraint-as-confidence position, just independently corroborated from the SaaS side instead of the guest-WiFi-vendor side v5 cited.
- **Signature-moment research**: the specific, repeatedly-cited 2026 pattern for a premium auth-adjacent flow is not a decorated sign-in card — it's **"the transition between authenticated and first meaningful screen… that 0.5–2 second window is your new onboarding moment."** This maps directly onto a screen this codebase already has and has already motion-budgeted for: the `/portal/success` → `/portal/session` connecting state, a real network request (the hotspot-login POST) genuinely in flight. That is the one place in this flow where "something is happening" is true, not decorative — see §2.3.
- **Type pairing, 2026**: [General Sans](https://www.lummi.ai/blog/popular-font-pairs-2026) (distinctive geometric sans, not yet a cliché the way Inter/Manrope have become), **Bricolage Grotesque** (variable, dramatic display weights + solid text weights), and **Funnel Display/Funnel Sans** all surface repeatedly as 2025–2026's "distinctive without being experimental" display faces — exactly the register a heading-only font choice (§3.1) should pull from, not another Inter/Manrope rehash.
- **Grain/texture as a premium cue**: a recurring, real 2026 technique for reducing the "flat stock photo" read on a compressed/banded uploaded JPEG is a near-invisible film-grain overlay (2–4% opacity) — cheap (a few hundred bytes, static, no JS) and directly answers v5's own audit complaint that the photo reads as "a hazy backdrop fragment" (§2.2).

### 0.3 Font-loading engineering research (load-bearing for §3.1, not decorative)

- **[Chrome for Developers: improved font fallbacks](https://developer.chrome.com/blog/font-fallbacks)** and **[Aleksandr Hovhannisyan's fallback-matching writeup](https://www.aleksandrhovhannisyan.com/blog/perfect-font-fallbacks/)**: `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` on a `@font-face` fallback let a local system font occupy the *exact* box a webfont would, eliminating font-swap layout shift even under `font-display: swap` — or, combined with `font-display: optional`, eliminating both the shift *and* any FOIT risk. This is the mechanism §3.1 relies on.
- **Subsetting economics**: real, checkable numbers — a full Inter WOFF2 is ~132KB; Latin-only subsetted, ~22–35KB; ASCII-only, ~18KB — a 70–90% reduction is typical for any well-optimized subset. Since this surface's headings render at a single weight (700) everywhere they appear (confirmed directly in code, §1.3), a curated face doesn't even need the variable-font weight axis — a single static 700-weight, Latin-subset WOFF2 is realistically **10–18KB**, not the 130KB+ a naive `<link>` to a full family would cost.
- **Self-hosting is not optional here, it's the only thing that can work**: the existing `PG_FONT_STACK` comment already establishes that a captive-portal guest may not be able to reach an external network at all pre-auth (the router's walled garden typically only allowlists the portal's own domain until the guest authenticates). A `fonts.googleapis.com` request — the mechanism the rest of this app already uses for its authenticated surfaces (`__root.tsx`'s `LOAD_FONTS_SCRIPT`) — is not just slower here, it can silently **never resolve at all** on a real deployment. Any new webfont on this surface must be same-origin. This isn't a style preference, it's the hard constraint §3.1 is built against.

---

## 1. Internal audit — what "distinctive" has to mean given what v3–v5 already spent, and one real bug found along the way

### 1.1 What's already locked in, correctly, and must not be re-litigated

Confirmed directly against `origin/main` (`98f2876`, current HEAD): zero framer-motion anywhere on `portal.*` (verified — no live import left in `CampaignOverlay.tsx` or `portal.session.tsx`'s illustration, both fixed per the v4 brief); one merged sign-in card (v5 §3.1); `PG_FONT_STACK` as the only font stack across all 12 `portal.*` screens using it (`PortalShell.tsx:36`); a real `manualChunks` split keeping `recharts`/`d3-*` out of the guest route's shared chunk, just re-verified and re-fixed as recently as `#91` today. **None of this is up for revisiting in v6** — it's the floor everything below has to stand on without regressing.

### 1.2 The two real legibility incidents today, and the actual lesson

`PortalShell.tsx`'s own comments document this precisely: PR #80 fixed one header being illegible against a real photo (a targeted, per-element white/80 card); PR #81 ("v4 structural legibility fix") over-corrected by wrapping the *entire* content column in one `--pg-surface/92` panel, which shipped live and reduced a venue's real photo to "a barely-visible ghost"; PR #82 reverted that back to bounded per-zone cards. **The actual lesson**, already stated in `GuestBackdrop`'s own doc comment and v5 §2: the axis that broke both times was *coverage area* (how much of the page one panel eats), not opacity value per se. Every fix since has been a single engineer's own guess at one hardcoded opacity number, for every venue, forever. **§3.2 below is the structural fix to this whole saga** — not a third hardcoded guess, but making the number itself an admin input, with the coverage-area invariant (the transparent middle band) kept permanently non-configurable so an admin control can't reintroduce PR #81's mistake under a different name.

### 1.3 A real bug this audit found: the admin UI already has a font picker, and it does nothing

`src/components/portals/PortalCustomization.tsx` (reachable at `/portals/$portalId`, the real "Portals" builder route) already renders a "Font family" `<Select>` with 8 options (Inter, SF Pro Text, Playfair Display, Roboto, Poppins, IBM Plex Sans, DM Sans, Space Grotesk) bound to `PortalBranding.fontFamily`. It looks finished. **It is not wired to anything real:**

- `src/services/portal.service.ts`'s `update()` (the function this screen's save button actually calls) builds its `PUT /captive-portal-configs/{id}` body from an explicit field whitelist (lines 505–521) — `name`, `theme`, `logo_url`, `background_image_url`, `primary_color`, `secondary_color`, `default_language`, `supported_languages`, terms/privacy URLs, splash headline/message, redirect URL, login-method flags. **`fontFamily` is not in that list.** Neither is `backgroundType`, `borderRadius`, or `cardStyle`.
- `BackendCaptivePortalConfig` (the real, narrower backend shape both `portal.service.ts` and `portal-runtime.service.ts` map against) has no `font_family` field at all — confirmed against both services' interface definitions.
- The result: an admin changes the font, clicks Save, sees no error (the PUT still fires — just without that field), and the choice is silently discarded. It never reaches `RuntimePortalConfig`, never reaches `PortalShell`/`GuestSignInCard`, and a page reload of the *editor itself* would show it reverted to whatever the backend actually has. This is exactly the gap between "looks configured" and "is engineered" the founder is reacting to — not a design problem, a wiring one.

**v6 does not reuse this control as-is.** §3.1 below replaces it with a small, real, backend-backed enum (not a free-text 8-face `<Select>` with no perf story), and explicitly adds it to `update()`'s whitelist and to `BackendCaptivePortalConfig`/`toRuntimeConfig` so it's real end-to-end. Flagging this now so whoever picks up the FE brief doesn't build the pretty version of this bug a second time.

### 1.4 Where the real config surface actually is

`RuntimePortalConfig` (`src/types/portal-runtime.ts`) is the real, backend-round-tripped shape — resolved once per guest load via `GET /captive-portal/resolve`, mapped in `portal-runtime.service.ts#toRuntimeConfig`. This is the only config surface that reaches the actual guest-facing render (`PortalShell.tsx`, `GuestSignInCard.tsx`). Both new fields (§3) are additions to *this* type and its backend counterpart — not to `src/types/portal.ts`'s separate, richer-but-partly-fake `Portal`/`PortalBranding` shape that `PortalCustomization.tsx` currently binds to (§1.3). The real admin editor for these two new fields should be added to whatever screen actually calls `portal.service.ts#update()` against `/captive-portal-configs/{id}` — i.e., extend `PortalCustomization.tsx`'s existing Colors/Background cards, but fix the wiring gap as part of the same change, not after it.

---

## 2. The v6 thesis: **Adaptive Material**, not a new decoration pass

### 2.1 The actual distinctive idea

§0.1's research finding is the thesis: no open-source captive portal in this category is genuinely *adaptive per venue* — they're one fixed template, admin-editable only at the "change the HTML" level. This product's real point of difference was never going to be a nicer gradient than v5's; it's that the **same component tree** has to look like considered, bespoke signage whether a venue uploads a temple photo, a boutique-hotel lobby shot, or nothing at all — and it has to do that from admin *inputs* (logo, photo, two brand colors, and — new in v6 — a font and an overlay strength), not from a designer hand-tuning each deployment. That's the "next-generation" claim worth making: not a fixed aesthetic, but an aesthetic **system** engineered to stay legible and considered regardless of what any given venue hands it. §3's two features are not add-ons to this thesis, they *are* the thesis, made concrete.

### 2.2 What changes visually from v5 (not a rehash)

v5 correctly established the frame — one merged card, tighter scale, mobile-primary layout, a lighter scrim. v6 doesn't re-tune those numbers again; it changes what's allowed to vary *per venue* inside that frame, plus two small, real, restraint-respecting material touches:

1. **A near-invisible grain layer over the scrim only** (§0.2) — a single tiny inline SVG `feTurbulence` pattern (self-contained, no asset request, <1KB inlined as a CSS `background-image: url("data:image/svg+xml,...")`), composited at 2.5% opacity, applied only within `GuestBackdrop`'s scrim `<div>`, never over the card. This directly answers v5's own audit language — "the photo reads as a hazy backdrop fragment... not a hero image" — without touching layout, without JS, without a new asset pipeline dependency. Static, `prefers-reduced-motion` is irrelevant here (it's not motion), and it costs nothing on the no-photo path (`PortalNoPhotoPattern` is untouched).
2. **A three-step CSS-only entrance stagger**, replacing the flat single `pg-enter` fade on the merged card: logo, then heading, then the tab switcher/fields, each offset by ~60ms via `animation-delay` on the *same* keyframe already defined (`pg-enter`) — total elapsed time under the existing 200ms transition ceiling (v4 §5's non-negotiable), zero new CSS keyframes, zero JS, same `prefers-reduced-motion` guard `pg-enter` already has (collapses to one simultaneous appearance, not broken). This is the "considered micro-interaction, pixel-level care" §0.2's research names as the actual premium signal — deliberately small, not a new animation *system*.
3. **Font choice and overlay strength (§3)** — the two requested features, which are also the two real levers that let the *same* card/photo composition read as "boutique hotel" vs. "co-working space" vs. "temple courtyard" without a single conditional in the component tree.

**Explicitly not changing:** card merge, sizing scale, `background-position`, mobile-primary layout, the zero-framer-motion policy, the `GUEST_LEGIBILITY_CARD_CLASS` mechanism, coverage area of the scrim. v5 got those right; this pass adds two real controls and two small material touches on top, it doesn't re-open them.

### 2.3 The signature moment, spent where it's earned

Per §0.2's "0.5–2s transition" research, the one screen in this flow where something *real* is happening (not decorative) is `/portal/success`'s connecting state — an actual hotspot-login POST in flight. No new work needed here beyond what v4 already shipped (`pg-pulse-dot`, CSS-only, `prefers-reduced-motion`-guarded) — flagging it explicitly so it isn't accidentally "improved" with something heavier later: the existing implementation already is the correct answer to this research finding, not a gap.

---

## 3. Feature 1 — Font choice (heading layer only, self-hosted, zero cost when unset)

### 3.1 Scope: display/heading typography only, never body/UI text

Confirmed directly (`grep` across every `portal.*` route + `GuestSignInCard.tsx`): exactly three shared utilities carry every heading on this surface — `pg-display` (BrandPanel's `<h2>`), `pg-title` (sign-in card `<h1>`, `/portal/auth/$method`, `/portal/session`), `pg-subtitle` (the other 8 state screens' `<h1>`) — all defined in `src/styles.css`, all currently weight `700` with no other weight ever used. **v6's font choice governs only these three utilities.** Body copy, field labels, buttons, the tab pill, the footer, error/status text — everything on `pg-body`/`pg-meta`/`pg-micro` and every `<input>`/`<button>` — stays on `PG_FONT_STACK` permanently, unconditionally, for every venue including ones with a font chosen.

This is a deliberate engineering boundary, not a limitation applied after the fact:
- It bounds the blast radius of a slow/failed webfont load to a single heading per screen — never to a form field, a button label, or anything a guest has to read to actually complete sign-in. The one thing PR #80 was about (illegible *interactive* text) can never regress via this feature, structurally.
- It means the self-hosted asset only ever needs **one weight** (700), not the 3–4 weights a full type system would need — directly shrinking the perf budget in §3.3.
- It means the curated faces can be chosen for *display* character (the register §0.2's type-pairing research points at — General Sans, Bricolage Grotesque, a warm serif) without having to also hold up as an all-day body face, which is a different, harder design problem this pass isn't taking on.

### 3.2 Curated allowlist (not a free-text picker)

Four options, `RuntimePortalConfig.guestFontChoice: "system" | "modern-sans" | "editorial-serif" | "bold-display"`, default `"system"`:

| Value | Face | Character | Where it fits |
|---|---|---|---|
| `system` (default) | `PG_FONT_STACK` (unchanged) | Neutral, fast, zero risk | Any venue; the safe default, including every venue migrated from v5 |
| `modern-sans` | General Sans, 700 static | Distinctive geometric sans, not yet a cliché the way Inter/Manrope are | Co-working, tech-forward venues |
| `editorial-serif` | Fraunces or Newsreader, 700 static | Warm, considered, editorial | Boutique hotels, cafés |
| `bold-display` | Bricolage Grotesque, 700 static | Expressive, confident, a real display weight | Event spaces, hospitality with a stronger brand voice |

Deliberately **not** a free-text/Google-Fonts-catalog picker (what `PortalCustomization.tsx`'s fake control offered, §1.3) — every option here is a real, self-hosted, perf-budgeted asset this team controls, not an unbounded promise. Four is enough to make venues feel considered without becoming a font-catalog product; more can be added later, each one individually budgeted the same way, not opened up wholesale.

**Non-Latin languages (`hi`/`ar`) are unaffected by design, not by accident**: none of the three curated display faces ship Devanagari or Arabic glyphs. A Hindi- or Arabic-language guest always renders headings through the existing fallback chain (`..., "Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif`) regardless of `guestFontChoice` — the same proven, already-shipped rendering v5 has today. This should be stated to admins in the UI (§3.5), not left to be discovered: choosing a font affects the Latin-script heading only, on `en`/`fr`/`es`.

### 3.3 Loading mechanics — engineered against `PG_FONT_STACK`'s actual constraint, not around it

1. **Same-origin only.** Files ship from this app's own `/fonts/portal/*.woff2` (or the existing static-asset host this app already uses for its own build output) — never `fonts.googleapis.com` or any third-party font CDN. Per §0.3, this isn't a preference: a captive-portal guest's device is commonly walled off to only the portal's own domain until authenticated, so a cross-origin font request isn't just slower here, it can silently never resolve at all. This directly extends — doesn't contradict — `PG_FONT_STACK`'s own established "no webfonts pre-auth" reasoning: the rule was never "no webfonts, full stop," it was "no *unreachable* webfonts, full stop." A same-origin asset is reachable by construction.
2. **One static weight per face, Latin-subsetted, WOFF2.** No variable-font axis needed (§3.1 — every use site is weight 700). Real budget, per curated face: **≤18KB** (§0.3's cited Inter Latin-subset numbers, 22–35KB for a *full weight range*; a single static weight subsets smaller still). Four faces total ≈ 60–70KB of static assets sitting on disk — **but §3.4 below means a venue on the default (`system`, expected to remain the common case for a while) downloads zero bytes of this, ever.**
3. **`font-display: optional`, not `swap`.** On a flaky pre-auth connection (the literal operating environment of this whole product), a font that isn't ready within the browser's short block period simply never swaps in for that render — no FOIT, no jank, no dependency on the network actually cooperating. The fallback is not a degraded state to tolerate, it's `PG_FONT_STACK` — already the fully-considered, currently-shipped visual today.
4. **Metric-matched fallback (`ascent-override`/`descent-override`/`line-gap-override`/`size-adjust`), per curated face, computed once against `-apple-system`/Segoe UI's real metrics** (§0.3's cited technique). This makes the heading's box height and baseline identical whether or not the swap happens — the one thing this specifically avoids is a heading that reflows/jumps after the fact, which on a 3-line viewport-height mobile card is a real, visible defect, not a nitpick.
5. **Loaded conditionally, per-config, via the mechanism already in this codebase** — `PortalRuntimeContext.tsx`'s existing effect that injects `<style data-portal-runtime>` for `--pr-primary`/`--pr-accent` (lines ~370–388) is extended: when `config.guestFontChoice !== "system"`, the same effect also injects a `<link rel="preload" as="font" type="font/woff2" crossorigin>` for that face's file and a scoped `@font-face` + `--pg-display-font-family: "<Face>", <fallback chain with overrides>` custom property on `.portal-runtime`. No new Context/Provider, no new dependency — one existing effect does one more conditional thing.
6. **`pg-display`/`pg-title`/`pg-subtitle`** (in `styles.css`) each get one line added: `font-family: var(--pg-display-font-family, inherit);`. Unset (every `system`-choice venue, and every venue during SSR/first paint before the effect runs) resolves to `inherit` → the `.pg-shell` root's `PG_FONT_STACK` — **pixel-identical to today's output**, not a new default to verify against.

This is a genuinely zero-regression-risk addition to the bundle-splitting work landed today (`#91`): it's font assets and a CSS custom property, not JS — it cannot show up in `vendor-1-react`/`vendor-2-charts`, and it adds nothing to the shared route chunk those manualChunks rules govern.

### 3.4 Byte cost, stated explicitly

| Venue's `guestFontChoice` | Extra requests | Extra bytes |
|---|---|---|
| `system` (default) | 0 | 0 |
| any curated face | 1 (`<link rel=preload>`) | ≤18KB, same-origin, cached after first load for that org's guests |

No venue pays for a font it didn't choose. This is the same discipline `PG_FONT_STACK`'s original comment and today's `manualChunks` fix both apply — cost is opt-in, not ambient.

### 3.5 Admin UI

Replaces `PortalCustomization.tsx`'s existing fake "Font family" `<Select>` (§1.3) with a 4-option `<Select>` (`System Default` / `Modern Sans` / `Editorial Serif` / `Bold Display`), each option showing a small live text preview rendered in the actual face (cheap — these are the same ≤18KB self-hosted files, already loaded once the admin opens this panel). A one-line caption under the control: *"Applies to headings only. Hindi and Arabic headings always use the system font for full character support."* — states §3.2's real constraint instead of leaving it to be discovered. Wired for real this time: added to `portal.service.ts#update()`'s whitelist (`body.guest_font_choice = patch.branding.fontChoice`), added to `BackendCaptivePortalConfig`/`toRuntimeConfig` (§4). The real Portal Preview route (`src/routes/preview.portal.$locationId.tsx`, which already renders the actual `PortalShell`/`GuestSignInCard`) reflects a font change immediately — no separate mock preview to keep in sync.

---

## 4. Feature 2 — Background overlay strength (the structural fix to the PR #80/#81/#82 saga)

### 4.1 What this replaces

`GuestBackdrop`'s `GUEST_BACKDROP_SCRIM` constant (`PortalShell.tsx`) is today a single hardcoded gradient string — `rgba(255,255,255,0.55)` peak top, transparent 24–78%, `rgba(255,255,255,0.65)` at the very bottom — the result of three sequential single-engineer guesses (§1.2). Every one of those guesses was checked against exactly one real photo (a temple shot, per v5 §1). A venue with a much brighter or much busier photo than that one has no lever to pull; a support ticket about "the photo behind the sign-in card is hard to see" or "the photo's basically invisible" today has no fix except another code change and another guess. **v6 makes the peak opacity a real per-venue admin input**, while keeping the one part of the mechanism that must never become configurable (the transparent coverage band) fixed — this is the actual, structural difference from "just add a slider," and it's the part that stops this from being PR #81's mistake wearing a UI.

### 4.2 Data model

`RuntimePortalConfig.backgroundOverlayStrength: number` — integer 0–100, default **55**. The default is not arbitrary: it's chosen so that a venue with no explicit value set (every venue migrated from v5, and any new venue before an admin touches this control) renders **pixel-identical to today's shipped output** — `55` is defined to reproduce the current hardcoded `0.55` peak exactly (§4.3). No visual migration diff for any existing venue.

Backend counterpart: `background_overlay_strength` (int, 0–100, default 55) on `BackendCaptivePortalConfig` / the real `captive_portal` domain record, mapped in `toRuntimeConfig` the same way every other field on that type already is.

### 4.3 The mapping — opacity is tunable, coverage area is not

```ts
// New helper in PortalShell.tsx, replacing the hardcoded GUEST_BACKDROP_SCRIM string.
function buildGuestBackdropScrim(strengthPct: number): string {
  // Clamp to [15, 85] -- this is the actual guardrail against both real
  // historical incidents: below 15, a bright photo can reproduce PR #80's
  // illegible-header problem; above 85, the scrim approaches PR #81's
  // near-total-wash regression. An admin can go most of the way in either
  // direction, but never all the way back to either shipped incident.
  const peakTop = Math.max(15, Math.min(85, strengthPct)) / 100;
  const midTop = peakTop * 0.51;              // same ratio as today's 0.28/0.55
  const peakBottom = Math.min(0.85, peakTop + 0.10); // same +0.10 offset as today's 0.65/0.55

  // The 24%/78% transparent-band stops are NOT parameters. This is the one
  // line in this function that must never take strengthPct as an input --
  // see GuestBackdrop's own doc comment (and v5 §2) for why "coverage
  // area," not opacity, was the actual mistake both prior regressions made.
  return `linear-gradient(to bottom, rgba(255,255,255,${peakTop}) 0%, rgba(255,255,255,${midTop}) 14%, rgba(255,255,255,0) 24%, rgba(255,255,255,0) 78%, rgba(255,255,255,${peakBottom}) 100%)`;
}
```

At `strengthPct = 55` (the default): `peakTop = 0.55`, `midTop = 0.2805`, `peakBottom = 0.65` — matching today's hardcoded values to within a rounding hair, confirming the no-visual-diff-on-migration property directly rather than asserting it.

`GuestBackdrop` calls `buildGuestBackdropScrim(config?.backgroundOverlayStrength ?? 55)` instead of referencing the constant directly. The **per-zone `GUEST_LEGIBILITY_CARD_CLASS` backing** (the card's own `bg-[var(--pg-surface)]/85`) is deliberately **not** part of this control — it's a small, bounded, already-correct structural guarantee for the zones that sit directly on the photo with no card of their own (BrandPanel, the footer), and conflating it with the full-bleed scrim's tunable strength is exactly the kind of scope creep that turned PR #81 into a regression in the first place. One knob, one job.

### 4.4 Admin UI

A slider (Radix `@radix-ui/react-slider` — already a dependency, no new package) in the Background section of the real settings surface (`PortalCustomization.tsx`'s "Background" card, next to the image upload), 0–100, labeled **"Background overlay strength"**, default 55, live-updating the real Portal Preview as it's dragged (debounced, same pattern any other live-previewed field here would use). Disabled/hidden with an explanatory caption when no background image is set (`config.backgroundImageUrl` is null) — `PortalNoPhotoPattern`'s flat-canvas treatment has no scrim to tune, and this codebase already has a standing principle (per `PortalShell.tsx`'s own comments) against rendering a dead control. Two small live-preview swatches at the slider's ends ("Lighter — for a plain or dark photo" / "Stronger — for a busy or bright photo") replace the need for an admin to understand the underlying gradient math to make a sensible choice.

---

## 5. Token/code deltas summary

```
New RuntimePortalConfig fields (src/types/portal-runtime.ts):
  guestFontChoice: "system" | "modern-sans" | "editorial-serif" | "bold-display"  (default "system")
  backgroundOverlayStrength: number  (0-100, default 55)

New backend fields (BackendCaptivePortalConfig, both service files + the real
captive_portal domain record in cloud-guest-repo/backend -- separate repo, see §6):
  guest_font_choice: string  (default "system")
  background_overlay_strength: integer  (0-100, default 55)

styles.css:
  .pg-display / .pg-title / .pg-subtitle each add:
    font-family: var(--pg-display-font-family, inherit);
  New (small) grain-overlay utility for GuestBackdrop's scrim layer only (§2.2.1)

PortalShell.tsx:
  GUEST_BACKDROP_SCRIM constant -> buildGuestBackdropScrim(strengthPct) function (§4.3)
  pg-enter usage on the merged card -> staggered animation-delay per child (§2.2.2),
    same keyframe, same prefers-reduced-motion guard

PortalRuntimeContext.tsx:
  Existing --pr-primary/--pr-accent injection effect extended to also inject,
  conditionally on config.guestFontChoice !== "system":
    <link rel="preload" as="font" type="font/woff2" crossorigin> for that face
    a scoped @font-face with computed ascent/descent/line-gap/size-adjust overrides
    --pg-display-font-family custom property on .portal-runtime

New static assets:
  public/fonts/portal/{modern-sans,editorial-serif,bold-display}-700.woff2
  (Latin-subset, static weight, ≤18KB each -- §3.3/3.4)
```

---

## 6. BE/FE build brief

**Cross-repo note**: this repo (`cloudguest-foundation`) is the frontend; the real backend (`backend/app/domains/captive_portal`) lives in the separate `cloud-guest-repo/backend` repo (per this project's own repo map) and is not touched by this pass — §6.1 below specifies exactly what that repo needs, for a coordinated follow-up change there.

### 6.1 Backend (`cloud-guest-repo/backend`, separate repo — not built in this pass)

1. Add `guest_font_choice` (string enum, default `"system"`) and `background_overlay_strength` (int 0–100, default `55`) to the `captive_portal` domain's config model + migration.
2. Validate `guest_font_choice` against the same 4-value allowlist as §3.2 server-side (reject anything else) — this must never become a free-text field, per §3.2's reasoning.
3. Clamp `background_overlay_strength` to `[0, 100]` server-side (the `[15, 85]` guardrail in §4.3 is applied client-side at render time, not stored-value-side — storing the admin's literal chosen number, clamping only the *rendered* opacity, keeps the UI slider's displayed value honest).
4. Surface both on `GET /captive-portal/resolve` and accept both on `PUT /captive-portal-configs/{id}`, same as every other field this domain already round-trips.

### 6.2 Frontend (`cloudguest-foundation`, this repo)

1. `src/types/portal-runtime.ts` — add `guestFontChoice`/`backgroundOverlayStrength` to `RuntimePortalConfig` per §5.
2. `src/services/portal-runtime.service.ts` — add the two fields to `BackendCaptivePortalConfig` and `toRuntimeConfig` (snake_case → camelCase, same pattern as every existing field).
3. `src/services/portal.service.ts` — add both to `update()`'s serialization whitelist (§1.3 — this is the exact gap that made the existing font control fake; don't repeat it) and to whatever `create()`/`fetchOnePortal` mapping mirrors `toRuntimeConfig`.
4. `src/styles.css` — `pg-display`/`pg-title`/`pg-subtitle` font-family additions (§5); new grain-overlay utility, scoped to `GuestBackdrop`'s scrim div only.
5. `src/components/portal-runtime/PortalShell.tsx` — `buildGuestBackdropScrim()` (§4.3) replacing the hardcoded constant; staggered entrance on the merged card (§2.2.2).
6. `src/context/PortalRuntimeContext.tsx` — extend the existing style-injection effect per §3.3.5.
7. `src/components/portals/PortalCustomization.tsx` — replace the fake 8-option font `<Select>` with the real 4-option one (§3.5); add the overlay-strength slider (§4.4). Both call the same `set()`/`onChange` path already wired to `useUpdatePortal` → `portalService.update()` — once #3 above lands, these become genuinely real for the first time.
8. `public/fonts/portal/*.woff2` — the three curated static assets, subsetted and metric-audited per §3.3 before landing (verify actual file size against the ≤18KB budget with a real build, not assumed — same discipline `#91`'s bundle-splitting fix used, checking the real `.output/` artifact rather than trusting config in the abstract).
9. **Do not**: reintroduce framer-motion anywhere on this surface; widen the scrim's transparent coverage band (§4.3's fixed 24–78%) under any circumstance, including a future feature request to do so; add a 5th+ font option without individually budgeting it the same way as the first four; let `guestFontChoice` become free text.

### 6.3 Verification checklist before ship

- Real `.output/` build: confirm the new font files are same-origin (`/fonts/portal/...`, not a CDN URL) and that a `system`-choice venue's SSR HTML has zero `<link rel=preload as=font>` tags.
- Real browser network trace on a fresh `/portal/welcome` load for a `system`-choice venue: byte-for-byte the same request count as today's shipped v5 (no accidental preload firing regardless of config).
- Visual diff at `strengthPct = 55` (default) against today's live production scrim on the same real venue photo used in v5's audit — must be indistinguishable, confirming the no-migration-diff claim in §4.2 isn't just asserted.
- `tsc --noEmit` against the documented pre-existing baseline (14 errors per `#91`'s commit message) — new field additions should add zero net new errors in touched files.

---

## 7. Hand-off boundaries

- **This document owns**: the research (§0), the thesis and what does/doesn't change visually from v5 (§2), both features' full design — data model, loading mechanics, UI, guardrails (§3, §4), and the build brief (§6).
- **Needs sign-off before FE builds it**: the three curated font choices' actual look against a real range of venue photos/colors (a single design review pass, not per-venue tuning); the grain-overlay opacity (§2.2.1) checked against both a very dark and very bright real photo, not just the temple photo v5 already audited against — same "single example is real evidence, not exhaustive evidence" caution v5 §6 already flagged for the scrim tuning, now extended to this new texture layer.
- **Needs backend coordination**: §6.1's two new fields — this pass cannot ship end-to-end without that repo's change landing first (or in lockstep); until then, `guestFontChoice`/`backgroundOverlayStrength` should default-fallback in `toRuntimeConfig` exactly as specified (`"system"`/`55`) so the frontend change is safe to land ahead of the backend one without any behavior change for any venue.
