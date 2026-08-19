# Wyfy Guest v3 — Unified Design System Spec

**Owner:** Design lead (this doc) · **Status:** Ready for engineering, one recommendation below needs founder sign-off before Surface 2 starts · **Audience:** 6 implementation engineers, one per surface. Each of Parts 2–7 is self-contained — read your own surface's part plus Part 0 (tokens) and Part 1 (the shared rule for why three libraries coexist) and start. You don't need to read the other five surface sections.

## Why this doc exists

The founder wants shadcn/ui + Aceternity UI + Magic UI combined across all six Wyfy Guest surfaces. Those three libraries have different personalities — shadcn is a restrained Radix base, Magic UI is premium micro-interaction polish, Aceternity is bold landing-page spectacle. Used identically everywhere, they read as three libraries fighting each other, not one v3 product. This doc sets one coherent system: what's shared everywhere (tokens, type rhythm, elevation language), and what's deliberately different per surface (a **motion/effects budget**, tightest on the captive portal, loosest on the marketing site).

Nothing below is designed from memory of what these libraries "generally" offer. Part 1 documents what was actually confirmed by reading this codebase and the two libraries' real, current docs today.

---

## Part 0 — Unified token system

**Extending current tokens, not replacing them.** The app (`cloudguest-foundation`) already runs a real OKLCH token system in `src/styles.css`, built this session and last: indigo primary (`--primary: oklch(0.47 0.2 265)`, hue 265), Inter body + Space Grotesk display, a soft/elevated/glow/ring shadow scale, and named gradients. `wyfy-guest-website`'s `src/styles/global.css` runs its own hex-based indigo/violet ramp (`--color-indigo-600: #4f46e5`) that already lands on the *same hue* as the app's `--primary` — confirmed, not assumed: `oklch(0.47 0.2 265)` and `#4f46e5` are the same color. **The palette already matches across repos. Typography does not** — see the flag below. v3 keeps the palette as-is and fixes the two real gaps it found.

### Palette — "Signal" (indigo structure + cyan/teal accent, unchanged hue, two fixes)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--primary` | `oklch(0.47 0.2 265)` | `oklch(0.68 0.19 265)` | Structure, CTAs, active states — unchanged |
| `--brand` ("Aurora" accent) | see **Fix 1** below | — | Glows, active rail, hero accents |
| `--chart-1`…`--chart-5` | cyan→indigo→green→amber ramp | unchanged | Data viz — unchanged |
| `--success` / `--warning` / `--info` / `--destructive` | unchanged | unchanged | Semantic states — unchanged |

**Fix 1 — `--brand` is currently self-contradictory.** Its own comment in `styles.css` (line 66) reads *"Brand: electric cyan/teal — the ownable 'Aurora' accent... Distinct from `--primary` so bright cyan never has to carry white body text."* But its actual value, `oklch(0.55 0.19 265)`, is hue 265 — the same indigo as `--primary`, not cyan. It's currently unused app-wide (confirmed: no `bg-brand`/`text-brand` usage found), so this has shipped no visible bug yet, but v3 leans on `--brand` deliberately for Aurora-style glows in Parts 4 and 5 below, so the drift needs fixing first: **recolor `--brand` to genuinely be cyan/teal**, reusing the hue already present in `--chart-1` (`oklch(0.58 0.13 205)`) — e.g. `--brand: oklch(0.62 0.14 200)`. This makes the token do what its own comment always said it should, and gives Aurora glows a hue that's actually distinct from indigo `--primary` instead of a second copy of it.

**Fix 2 — type systems don't match, and that's a deliberate call, not an oversight.** The app uses Inter (body) + Space Grotesk (display); the website uses self-hosted Poppins (display) + Open Sans (body) — chosen last session specifically as a "Modern Professional" pairing distinct from the product UI's own faces. These are different font files, not a shared system. **v3 recommendation: keep them distinct, but tighten the shared *rhythm*** — both already use `-0.02em` to `-0.025em` letter-spacing on headings and a similar uppercase-eyebrow-with-gradient-tick pattern; standardize that rhythm (heading tracking, eyebrow treatment, section-lead line-height) as the thing that's actually shared, not the font files themselves. A marketing site is allowed a warmer, more editorial voice than a product UI used for hours a day; forcing one font stack onto both is a bigger, riskier change than the founder asked for and buys nothing the shared rhythm doesn't already deliver. Flagging this as a call made, not asking for sign-off — it's reversible and low-risk either way.

### Radius, shadow, motion — the shared vocabulary

- **Radius:** base app `--radius: 0.75rem`; Master Console theme `0.625rem` (tighter, "Clean Enterprise" — deliberate, keep). Both stay as-is in v3.
- **Found and flagged, not touched:** `styles.css` also defines a `.customer-theme` class (Modernist: Archivo, **zero radius**, `#ec3013` red accent) — grepped app-wide and it is applied to **zero routes**. It's dead/orphaned CSS from an earlier exploration, not the live customer dashboard. The real `/c/*` customer surface (Part 4) uses the default indigo `:root` theme via `CustomerHeader`/`CustomerSidebar`, confirmed by reading `c.index.tsx`. Don't be misled by `.customer-theme` if you grep the CSS file — it isn't live. Recommend someone delete it in a follow-up cleanup PR; out of scope for this spec to remove unilaterally.
- **Shadow scale:** `--shadow-soft` / `--shadow-elevated` / `--shadow-glow` / `--shadow-ring` (app) and `--shadow-card` / `--shadow-lift` (website) are conceptually the same two-tier idea — ambient rest state + lifted/glowing interactive state. Keep both as named per-repo, no merge needed.
- **Motion easing:** `--ease-emphasized: cubic-bezier(0.2, 0.9, 0.15, 1)`, `--dur-fast: 140ms`, `--dur-med: 240ms` already exist in the app. **Adopt these as the one shared easing curve for every new Magic UI / Aceternity component added anywhere in `cloudguest-foundation`** — don't let a freshly-installed library component bring its own default easing and create a third motion feel alongside the app's existing two (the `reveal`/`aurora-drift` cubic-bezier on the website, `--ease-emphasized` in the app).

---

## Part 1 — Why these three libraries actually can coexist (confirmed, not assumed)

Checked both libraries' real current install docs today, not general memory:

- **shadcn/ui** — already the base. `components.json` confirms: style `new-york`, base color `slate`, CSS variables on, Tailwind v4 (`@import "tailwindcss"` + `@theme inline`), icon library Lucide. 43 primitives already installed in `src/components/ui/` (button, dialog, dropdown-menu, form, table, sidebar, chart, input-otp, sonner, etc.) — this is a mature, real base, not a starting point. Add more with `npx shadcn@latest add <name>`.
- **Magic UI** — confirmed via its own install docs: *"We have the exact same installation process as shadcn/ui."* Components install via `npx shadcn@latest add @magicui/<component>`, land as local files you own (not an npm package), imported like any shadcn component.
- **Aceternity UI** — confirmed via its own CLI docs: also shadcn-registry-based — `npx shadcn@latest add @aceternity/<component>` or the registry-URL form `npx shadcn@latest add https://ui.aceternity.com/registry/<component>.json`. Its `init` step installs `framer-motion` as a real dependency — already present in this repo's `package.json` (`^12.42.2`), so no new dependency for surfaces that already use it (Parts 3, 5, 6). This is the crux of the Part 3 recommendation below.

**The unifying fact:** all three now ship through the *same delivery mechanism* — the shadcn CLI pointed at a different registry. Engineers aren't learning three install stories, they're learning one command with three possible sources. That's a real, structural reason these three can read as one system rather than three grafted-on libraries — the founder's instinct that they combine isn't fighting the tooling.

**The one real constraint that comes with this:** almost every Aceternity effect component and most of Magic UI's "Special Effects" / animated-text components are `framer-motion`-driven under the hood. That's fine everywhere framer-motion is already a cost the app is paying (Parts 3, 4, 5, 6) — it is **not** fine on the captive portal, which is why Part 3 exists.

### What was actually built already this session (don't re-derive, don't undo blind)

- **Captive portal (`PortalShell.tsx`, `GuestSignInCard.tsx`) had `framer-motion` deliberately removed.** Confirmed via `styles.css`'s own comment (lines 563–570): *"CSS-only replacements for the two `framer-motion` usages that used to be in PortalShell.tsx / GuestSignInCard.tsx... removing that JS-driven pair is what lets Rollup stop pulling framer-motion into the shared guest-portal entry chunk every `portal.*` route... loads."* This is a **bundle-architecture fact, not a taste preference**: every `portal.*` route shares one Rollup entry chunk, so a framer-motion import in *any* portal component reintroduces the regression for *every* guest login screen, including ones a given guest never touches, on networks where every KB matters. It was replaced with two CSS-only primitives that are still there and still in play for v3: `.pg-enter` (fade+rise, 0.2s) and `.pg-tab-pill` (sliding tab indicator, 0.18s), both `prefers-reduced-motion`-guarded. This is why Part 3 pushes back on Aceternity/most-of-Magic-UI for the portal — see that section for the full argument and the explicit ask for founder sign-off.
- **Homepage illustrations-v2** (`wyfy-guest-website/src/components/illustrations/*.astro`, 27 files) — flat line-art + soft-glow SVG illustrations, hand-authored, Stripe/Linear-referenced style, already carrying the indigo/violet/cyan/fuchsia accent system. This is the marketing site's real illustration language; Part 2 builds on it rather than replacing it with Aceternity's own 3D/globe visuals.
- **Master Console conventions** (`master.channel-partners.tsx`, read as the reference) — routes don't touch shadcn primitives directly; they go through `MasterKit` (`MPageShell`, `MSectionHeader`, `MStat`, `MSeg`, `MTag`, `MTable`/`MTh`/`MTd`/`MTr`, `MDrawer`, `MDialog`, `MButton`, `MField`, `M_INPUT`), which itself wraps shadcn. **Part 5's rule follows directly from this: new accents extend `MasterKit`, they don't bypass it route-by-route.**
- **`AnimatedCounter`** (`src/components/ui-ext/AnimatedCounter.tsx`, consumed by `StatCard`, `MasterKit`'s `MStat`) — a hand-rolled `requestAnimationFrame` count-up, no framer-motion, `prefers-reduced-motion`-aware. This is already exactly what Magic UI's "Number Ticker" does. **Don't install `@magicui/number-ticker` alongside it** — it would be a second implementation of the same idea. Extend `AnimatedCounter` if it needs a feature Number Ticker has and this doesn't.
- **Both login pages already lean into a premium hero treatment.** `master-login.tsx` and `login.tsx` both already import `framer-motion` (`useMotionValue`, `useSpring`, `useTransform`), already render a bespoke `CountUp` stat component, and already render bespoke aria-hidden SVG hero illustrations (`ControlTowerIllustration` for master — a radar mast overseeing a router fleet; `HeroWifiIllustration` for customer — a guest figure connecting to WiFi) tinted to each surface's own palette. The `aurora-blob`/`aurora-grid`/`float-badge`/`glow-pulse` keyframes in `styles.css` exist for exactly this. **Parts 6 and 7's brief is therefore narrow and precise**, not "add Aceternity to the login page" — see those sections.

---

## Part 2 — Marketing website (`wyfy-guest-website`, Astro)

**Budget: loosest of the six.** This page's entire job is to impress a first-time visitor once. Bold landing-page effects earn their keep here in a way they don't anywhere else in this spec.

### The hard constraint, stated up front

**Astro cannot use React component libraries.** shadcn/ui, Aceternity UI, and Magic UI are all React (Radix + framer-motion under the hood). There is no `npx shadcn@latest add` for this repo. **The brief for this surface is "port the visual language — palette, motion feel, spacing rhythm, effect *category*" — never "install these packages."** Every effect below is re-implemented as hand-authored CSS/vanilla JS or an Astro-native equivalent, using this repo's existing patterns (`.reveal`/`.reveal-delay-*` scroll-reveal via IntersectionObserver, `.ambient-pulse`, `.success-pop-in`) as the starting vocabulary, not a from-scratch rebuild.

### Where, what, why

- **Hero section — port Aceternity's "Aurora Background" or "Background Beams" *effect category*, not the component.** Re-implement as a CSS-only radial-gradient blob animation (the app's own `.aurora-blob`/`.aurora-drift` keyframes in `cloudguest-foundation/src/styles.css` are the exact reference to copy the *technique* from — slow `transform: translate/scale` drift, 20–28s loop, `prefers-reduced-motion` disabled). Recolor to the website's indigo/violet/fuchsia/cyan accent set (already used in the current hero's corner blobs per `HeroWifiIllustration`'s own comment). This is a straight CSS port; no JS animation library needed at all.
- **Feature sections — port Aceternity's "Bento Grid" layout pattern**, hand-built in Astro/Tailwind (it's a CSS grid technique, not a stateful component) for the features overview and comparison sections, replacing flatter grid layouts where a feature genuinely has a hero visual to show off (e.g. Live Analytics, Router Failover) alongside ones that don't.
- **Section entrances — already built, extend rather than replace.** `.reveal`/`.reveal-delay-1/2/3` (IntersectionObserver-driven, 0.85s cubic-bezier rise+fade+scale, dims-not-hides on failure, `noscript`-safe) is already a correct, production-hardened implementation of what Magic UI's "Blur Fade" / "Text Animate" do. Extend this system to any new section rather than hand-rolling a second reveal mechanism.
- **Stat/number moments — port Magic UI's "Number Ticker" *effect*, CSS/vanilla-JS only**, same rAF technique as `cloudguest-foundation`'s `AnimatedCounter.tsx` (that file is short enough to port near-verbatim minus the React bits) for any homepage/pricing-page stat callouts.
- **CTA buttons — port the "Shimmer Button" or "Rainbow Button" *feel* sparingly**, on the single primary hero CTA only, as a CSS `background-position` sweep (same mechanism as the app's own `.shimmer` utility in `styles.css`) — not on every button on the page, or it stops reading as a highlight.
- **Illustrations stay exactly as they are.** The 27-file `illustrations-v2` Astro pass is this site's real, hand-authored visual signature. Nothing in Aceternity or Magic UI replaces these — they're the asset, not a placeholder for a library component.

### Don't

- Don't attempt to actually `npm install` any of the three React libraries into this Astro project — they won't render, and pulling in React-only tooling here is a much bigger architectural change than "match the visual language."
- Don't introduce a hue outside indigo/violet/cyan/fuchsia/amber because a library demo happened to look good in a different color — palette discipline matters more than matching a demo screenshot.
- Don't let a hero effect push back First Contentful Paint or cause layout shift — CSS-only, GPU-composited (`transform`/`opacity` only) effects exclusively, same rule the existing `.reveal` system already follows.
- Don't autoplay video or ship a WebGL/canvas background on mobile — battery and data cost, no fallback story for a visitor on a slow connection evaluating whether to sign up.
- Don't add a second scroll-reveal implementation alongside `.reveal` — extend the one that exists.

### Setup notes

No package installs. This is a "read the component's source on ui.aceternity.com / magicui.design, extract the CSS/keyframe technique, re-author in this repo's existing Tailwind v4 + vanilla-JS/Astro idiom" workflow — same posture already used for `.aurora-blob`, `.reveal`, `.ambient-pulse`.

**Cross-reference:** a pointer to this spec lives at `wyfy-guest-website/docs/design-v3-visual-language.md` (see that file for the short version scoped to this repo).

---

## Part 3 — Captive guest portal (`portal-runtime`, `portal.*` routes)

**Budget: tightest of the six — and this is where the plan deviates from "use all three everywhere." Flagging for explicit founder sign-off, not silently deviating.**

### The recommendation

shadcn's clean base, plus **at most** very light Magic UI-style micro-interactions re-implemented as CSS (not the framer-motion-backed package) — a subtle button hover, a clean state transition. **No Aceternity components. No Magic UI components that depend on `motion/react`** (which is most of its catalog outside static backgrounds/typography).

### Why — this is an engineering fact, not a style opinion

Guests hit this screen on hotel/cafe WiFi, often on a weak connection, and the *entire job* of the page is: get them online in seconds. This session already did the work of stripping `framer-motion` out of `PortalShell.tsx`/`GuestSignInCard.tsx` for exactly that reason — the codebase's own comment (`styles.css` lines 563–570) states removing it is "what lets Rollup stop pulling framer-motion into the shared guest-portal entry chunk every `portal.*` route... loads." That's a shared-bundle-chunk fact: **every** `portal.*` route pays the cost of a framer-motion import in **any** portal component, not just the one screen that uses it.

Per Part 1's real install-doc research: Aceternity's own `init` step installs framer-motion as a hard dependency, and it's the backbone of nearly every effect in its catalog (Background Beams, Aurora Background, 3D Card, Sparkles — all `motion`-driven). Most of Magic UI's "Special Effects" and interactive text components are the same. **Installing essentially anything from either catalog into a `portal.*` component reintroduces the exact regression this session already fixed** — for every guest, on every portal route, including the ones who never see the new component.

This is precisely the scenario the task brief anticipated: restraint here goes against "use all three everywhere," and that's a call a design lead should make explicitly and flag, not quietly decide alone. **Recommendation stands; please confirm before Part 3's engineer starts.**

### Where, what, why (within the recommendation)

- **Forms — shadcn only.** `Input`, `Button`, `Label`, `InputOtp` (already installed) for the OTP/password/voucher forms. No change to the library mix here at all.
- **The two-tab sign-in switcher — already built, keep it.** `.pg-tab-pill` (CSS `transform: translateX`, 0.18s, driven by a `data-active-tab` attribute, no JS animation library) is already exactly the kind of "clean, subtle transition" this budget calls for. This *is* the Magic-UI-feel this surface gets, minus the dependency.
- **Screen entrances — already built, keep it.** `.pg-enter` (CSS fade+rise, 0.2s, `prefers-reduced-motion`-guarded) likewise.
- **Ambient backdrop — already built, keep it, don't add more.** `.pg-glow-1`/`.pg-glow-2` (slow CSS blob drift, 24–28s) is the one ambient touch this surface gets. It's already there; resist the urge to add a second one alongside it once Aceternity's catalog is fresh in mind from Part 2/6.
- **If a genuinely new micro-interaction is needed** (e.g. a button hover lift, a success-state check-mark pop): re-implement it as CSS, same posture as the marketing site's Part 2 approach — take the *idea* from Magic UI's catalog (e.g. "Shimmer Button," "Ripple Button"), write it as a `@utility` in `styles.css` scoped to the portal's light theme, never `npx shadcn@latest add @magicui/...` on this surface.

### Don't

- No Aceternity components, none, on any `portal.*` route or `portal-runtime` component.
- No Magic UI component that imports `motion/react` (rules out most of "Special Effects," all animated text components, Dock, Orbiting Circles, etc.) — CSS-only Magic UI ports (the *idea*, not the package) only, same as Part 2.
- No parallax.
- No autoplay video backgrounds.
- No transition longer than 200ms on the OTP input specifically — it's the single highest-frequency interaction on this entire surface and needs to feel instant.
- No new webfonts — this surface already deliberately dropped Manrope for a system-font stack (see `PortalShell.tsx`'s own comment) specifically because a captive-portal guest may not be able to reach a font CDN pre-auth. Don't reintroduce that dependency for a v3 polish pass.
- No re-introducing `framer-motion` to `PortalShell.tsx`, `GuestSignInCard.tsx`, or any file that shares their Rollup entry chunk — if unsure whether a new file is in that chunk, check before adding any JS-driven animation import, not after.

### Setup notes

No new package installs on this surface, by design. Everything is a CSS `@utility`/`@keyframe` addition to the portal-scoped section of `styles.css`, following the existing `pg-*` naming convention.

---

## Part 4 — Customer / org-admin dashboard (`/c/*`, `src/components/customer`)

**Budget: shadcn as the true backbone; Magic UI for tasteful accents; Aceternity sparingly, only at empty-state/onboarding moments — never persistent chrome.**

This is a data-density tool used for hours. Confirmed by reading `c.index.tsx`: routes already import shadcn primitives directly (`Card`, `Table`, `Badge`, `Button` — no wrapper kit, unlike Master Console's `MasterKit`), already use `framer-motion`/`AnimatePresence` for view transitions, and chart with `recharts`. The default indigo `:root` theme applies here (not the orphaned `.customer-theme` — see Part 0's flag).

### Where, what, why

- **Tables, forms, page chrome — shadcn, unchanged.** `Table`, `Form`, `Dialog`, `Sheet`, `Command`, `Select` etc. stay the backbone. This surface's job is information density done well; it's the last place to add visual noise.
- **Stat tiles — extend `StatCard`/`AnimatedCounter` (already built), don't install a duplicate.** Per Part 1's finding, `AnimatedCounter` already does what Magic UI's Number Ticker does. If a stat tile needs a new *visual* treatment Magic UI has and `StatCard` doesn't (e.g. Magic UI's "Border Beam" as a subtle rotating-highlight border on a hero KPI card), install that one specific accent (`npx shadcn@latest add @magicui/border-beam`) and wrap it around the existing `StatCard`, rather than replacing the counting logic.
- **Chart transitions — Magic UI accents around Recharts output, not a chart-library swap.** Recharts stays the charting engine (it's already deeply integrated — `AreaChart`, `PieChart`, `BarChart` all in use in `c.index.tsx`). A Magic UI "Blur Fade" or the existing `.reveal`-equivalent can wrap a chart's mount/update so it settles in rather than popping, but the chart itself is untouched.
- **Empty states / onboarding — the one place Aceternity earns a slot here.** A first-run "no locations yet" or "connect your first router" empty state is exactly the kind of low-frequency, high-first-impression moment Aceternity's catalog is built for. A single, well-chosen component — e.g. "Background Boxes" or a restrained "Sparkles" accent behind an empty-state illustration/CTA — is appropriate *there specifically*, and nowhere else on this surface. Framer-motion is already a real dependency on this surface (per `c.index.tsx`), so this doesn't add new bundle cost the way it would on the portal.
- **List/row entrances — the existing `AnimatePresence` usage is the model.** Extend it for new list views rather than introducing a second animation approach.

### Don't

- Don't add Aceternity's persistent-chrome effects (Background Beams, Vortex, Aurora Background, Meteors) behind a table, form, or any screen a user looks at for more than a few seconds — motion behind dense data is a readability tax paid every session, forever.
- Don't give dense table/list rows a card-style hover lift+scale (`.card-interactive`'s treatment is right for a marketing card, wrong for a 40-row table).
- Don't replace Recharts with a different charting approach to get a Magic UI effect — wrap the output, don't swap the engine.
- Don't let a counting stat's animation overshoot or bounce — `AnimatedCounter`'s current cubic ease-out is deliberate (a number that overshoots past its final value and settles back reads as *wrong*, not delightful).
- Don't install a second numeric-counter package alongside `AnimatedCounter`.

### Setup notes

shadcn additions: `npx shadcn@latest add <name>` (matches existing `components.json`). Magic UI additions: `npx shadcn@latest add @magicui/<name>` — confirm where the CLI writes the file (Magic UI's registry may default to its own folder rather than `src/components/ui/`); if so, treat that as a new `components/magicui/` peer to the existing `components/ui-ext/`, don't force-merge it into `ui/` alongside hand-authored shadcn primitives. Aceternity additions (empty-states only): `npx shadcn@latest add @aceternity/<name>` or the registry-URL form.

---

## Part 5 — Master Console (`master.*` routes, `src/components/master`)

**Budget: same posture as Part 4 (shadcn backbone, Magic UI accents, Aceternity only at onboarding/empty-state moments) — plus one hard rule specific to this surface: everything routes through `MasterKit`.**

Confirmed by reading `master.channel-partners.tsx` as the current reference example: Master Console routes don't touch shadcn primitives directly. They compose `MasterKit` (`MPageShell`, `MSectionHeader`, `MStat`, `MSeg`, `MTag`, `MTable`/`MTh`/`MTd`/`MTr`, `MDrawer`, `MDialog`, `MButton`, `MField`, `M_INPUT`), which itself wraps shadcn underneath. `master-theme` (`.master-theme` class, `MasterShell.tsx`) is a distinct "Clean Enterprise" sub-brand — blue/indigo `oklch(0.52 0.19 260)`, tighter `0.625rem` radius, light sidebar (unlike the base app's dark one) — deliberate and out of scope to change here.

### Where, what, why

- **`MStat` is the one file to touch for counter/KPI polish, not individual routes.** It already consumes `AnimatedCounter`. Any Magic UI accent for KPI tiles (Border Beam, Shine Border, a subtle Magic Card hover) gets added *inside* `MStat` once, so every route using it (channel partners, customers, billing, analytics — 16 route files) picks it up automatically. Never add a one-off animated stat tile inside a single route file.
- **`MTable` is the one file to touch for row-level polish.** Same rule — a subtle Magic UI "shimmer" loading-skeleton treatment belongs in `MTable`'s loading state, not hand-rolled per route.
- **Empty states in `MPageShell`** — the same Aceternity-for-onboarding-moments allowance as Part 4 (a channel-partner list with zero partners yet, a fresh tenant with zero routers). One component, one place (`MPageShell`'s empty-state slot), not per-route.
- **`MDrawer`/`MDialog` open/close transitions** — if a Magic UI "Blur Fade"-style entrance is wanted for drawers/dialogs platform-wide, it goes into these two shared components, not per-usage.

### Don't

- Don't import a shadcn, Magic UI, or Aceternity component directly into a `master.*` route file — go through `MasterKit`, or extend `MasterKit` first if it doesn't yet expose what's needed. Bypassing it route-by-route is exactly how six months from now this console ends up with three different KPI-tile animation styles across 16 route files.
- Don't add persistent Aceternity chrome behind operator data tables — same reasoning as Part 4, doubled: this console is used by internal ops staff for hours, and a router fleet's live status table is precisely the kind of screen where a wrong number needs to be spotted instantly, not admired.
- Don't override `master-theme`'s blue palette, tighter radius, or light-sidebar convention to "match" another surface — it's a deliberate, already-shipped sub-brand distinction from the base app theme and from `customer-theme`'s (unused) red modernist look.

### Setup notes

Same CLI mechanism as Part 4. New primitives get added at the `MasterKit` layer (`src/components/master/MasterKit.tsx`) so the abstraction stays the single place routes compose from.

---

## Part 6 — Customer dashboard login page (`login.tsx`)

**Budget: a tasteful Aceternity moment on the hero panel, shadcn for the actual form — and most of this is already built.**

Confirmed by reading `login.tsx`: it already imports `framer-motion`, already renders a bespoke `CountUp` component (`useMotionValue`/`useSpring`), already renders a bespoke aria-hidden `HeroWifiIllustration` (guest figure + WiFi signal arcs + venue pin, in the cyan/fuchsia/violet accent set), already uses shadcn `Input`/`Label`/`Button` plus a `Dialog` for the forgot-password flow. **This is not a blank page waiting for a library — it's a working, on-brand hero that needs one specific upgrade, not a rebuild.**

### Where, what, why

- **The credentials form itself — shadcn, already correct, no change.** `Input`, `Label`, `Button`, `Dialog` (forgot-password). Leave as-is.
- **The one real opportunity: swap the hand-rolled backdrop glow blobs for one Aceternity primitive, keep everything else.** The plain `motion.circle` glow blobs behind `HeroWifiIllustration` are exactly what Aceternity's **Aurora Background** or **Spotlight** components are built for. Install one of the two, place it as the backdrop layer *behind* the existing bespoke illustration and `CountUp` stats — don't replace the illustration or the stats, they're already bespoke, on-brand, and distinct from the master login's control-tower illustration (Part 7). This is a precise "upgrade the backdrop, keep the foreground" brief, not "add Aceternity to the login page."
- **`CountUp` stays as-is.** It's already framer-motion-based on a surface that already depends on framer-motion — no cost to keep it, and it's already what Magic UI's Number Ticker does (Part 1).

### Don't

- Don't replace `HeroWifiIllustration` with a generic Aceternity 3D Globe/Pin/Marquee visual — the bespoke guest-connecting-to-WiFi illustration is this login page's identity; a generic library visual is a downgrade, not an upgrade.
- Don't install a second numeric-counter component alongside the existing `CountUp`.
- Don't let the new backdrop effect get bold enough to compete with the credentials form for attention — the current glow blobs are already tuned to sit behind the panel, not draw the eye away from it; whatever Aceternity primitive replaces them needs the same restraint (check it against the existing panel's `glass-panel`/backdrop-blur treatment, don't just drop in the library's default intensity).

### Setup notes

`npx shadcn@latest add @aceternity/aurora-background` (or `spotlight`) — framer-motion is already a dependency of this file, so no new cost. Verify the component's default color stops against Part 0's palette before shipping; Aceternity's demos default to purple/pink, this needs the indigo/violet/cyan set already in `HeroWifiIllustration`.

---

## Part 7 — Master dashboard login page (`master-login.tsx`)

**Budget: same posture as Part 6 — one tasteful Aceternity backdrop moment, shadcn for the form, keep the bespoke illustration.**

Confirmed by reading `master-login.tsx`: structurally near-identical to Part 6's file — `framer-motion`, a bespoke `CountUp`, shadcn `Input`/`Label`/`Button` — but with its own distinct hero illustration (`ControlTowerIllustration`: a radar mast overseeing a router fleet, "operator oversight" framing vs. the customer login's "guest connecting" framing) and its own stat set (`8 Tenants managed`, `93% Routers online`, `99.9% Platform uptime` vs. the customer login's `10K+ Networks`, `99.9% Uptime`, `24/7 Support`). This is also the one screen in the whole app confirmed to already use the shared `.aurora-blob-1/2/3`/`.aurora-grid`/`.float-badge`/`.glow-pulse` CSS keyframes from `styles.css` — grepped, it's the *only* current consumer of those utilities.

### Where, what, why

- **The credentials form itself — shadcn, already correct, no change.** Same as Part 6.
- **The backdrop — already partway to an Aceternity-equivalent, finish the job rather than starting over.** This page already runs `.aurora-blob-1/2/3` (CSS blob drift) + `.aurora-grid` (CSS grid pan) + `.float-badge`/`.glow-pulse` — a hand-authored approximation of Aceternity's Aurora Background + Grid/Dot Backgrounds *combination*. Given this is the one file already using those shared utilities, the highest-leverage move is: **evaluate replacing the hand-rolled combination with Aceternity's actual "Aurora Background" component here first** (before Part 6, since this page is closer to being "done" already and can validate the swap once), then decide whether to port the same swap to `login.tsx`. If the swap doesn't clearly read better than the existing hand-rolled version, it's fine to leave this page as-is — it's already a working, tuned implementation of the same idea, not a placeholder.
- **`ControlTowerIllustration` and `CountUp` stay exactly as they are** — same reasoning as Part 6: already bespoke, already on-brand, already carry this surface's distinct "operator console" identity vs. the customer login's "guest" identity.

### Don't

- Don't let this page's backdrop converge on looking identical to the customer login's (Part 6) — the indigo/blue-only palette rule already noted in `ControlTowerIllustration`'s own comment ("no green/teal accents here, matching the rest of this codebase's decorative-color rule") is a deliberate differentiator from the customer login's cyan/fuchsia accents. Keep it.
- Don't replace `ControlTowerIllustration` with a generic Aceternity visual — same reasoning as Part 6.
- Don't add a second ambient CSS animation on top of the existing `aurora-blob`/`aurora-grid`/`float-badge`/`glow-pulse` set — if adopting an Aceternity primitive here, it *replaces* that set, it doesn't stack on top of it.

### Setup notes

If adopting Aceternity's Aurora Background: `npx shadcn@latest add @aceternity/aurora-background`, then remove the now-redundant `.aurora-blob-*`/`.aurora-grid` CSS (but leave `.float-badge`/`.glow-pulse` if still used elsewhere — check before deleting). Framer-motion already a dependency, no new cost.

---

## Motion/effects budget — at a glance

| Surface | shadcn | Magic UI | Aceternity | Framer-motion cost |
|---|---|---|---|---|
| Marketing website | n/a (Astro) | visual language only, CSS-ported | visual language only, CSS-ported | n/a — no React libs at all |
| Captive portal | Full backbone | CSS-only ports of the *idea*, no `motion/react` package | **None** | Zero — deliberately removed, stays removed |
| Customer dashboard | Full backbone | Tasteful accents on stats/charts | Empty-states/onboarding only | Already a dependency, no new cost |
| Master Console | Full backbone, via `MasterKit` | Tasteful accents, added at the `MasterKit` layer | Empty-states/onboarding only | Already a dependency, no new cost |
| Customer login | Form components | `CountUp` already covers this | One backdrop moment (Aurora/Spotlight) | Already a dependency, no new cost |
| Master login | Form components | `CountUp` already covers this | One backdrop moment, evaluate first | Already a dependency, no new cost |

---

## Open item for founder sign-off

**Part 3 (captive portal) recommends zero Aceternity and near-zero Magic UI**, against the "use all three everywhere" framing. The reasoning is a concrete bundle-architecture fact (shared Rollup entry chunk across all `portal.*` routes, confirmed via this session's own removal of framer-motion for exactly that reason), not a taste call. Recommend confirming this before Part 3's engineer starts; every other surface proceeds as written regardless.
