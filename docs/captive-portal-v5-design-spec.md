# Captive Portal v5 Design Spec

Two workstreams feed this document, added independently:

- **Visual direction / background-photo composition** (Senior Design Engineer) —
  section not yet added as of this writing. Add it here as its own top-level
  section; nothing below assumes or depends on its contents.
- **Interaction design, perceived performance, information density** (UI/UX
  Engineer) — the section below.

Founder's two starting complaints this round: the sign-in card feels
too big/bulky, and — the critical one — the experience should *feel* fast
the moment a guest's device joins the WiFi.

---

## UX + Performance (UI/UX Engineer)

### 1. External research: what real captive-portal products do in the first few seconds

**Android's Captive Portal API (RFC 8908, tied to RFC 8910/DHCP Option 114),
Android 11+.** When a network advertises a captive-portal API endpoint, the
OS skips its own generic connectivity-probe loop (repeated HTTP fetches to
`connectivitycheck.gstatic.com`/`clients3.google.com`, which Android itself
budgets up to ~10s for) and jumps straight to presenting the portal's login
UI once the API reports `"captive": true`. The design implication is blunt:
*don't make the guest wait through generic network probing before your own
UI even gets a chance to appear* — RFC 8908 exists specifically so the OS
can shortcut that. Our backend already exposes `GET /captive-portal/rfc8908`
(`app/domains/captive_portal/router.py`), so devices that support it already
skip the generic probe loop. Worth confirming this is actually wired into
the Setup Script's DHCP Option 114 config for every deployed router, since
the win only applies to devices that receive it.
([developer.android.com](https://developer.android.com/about/versions/11/features/captive-portal), [RFC 8908](https://www.rfc-editor.org/rfc/rfc8908.html), [RFC 8910](https://www.rfc-editor.org/rfc/rfc8910.html))

**The Captive Network Assistant / Captive Portal Mini-Browser** (iOS,
macOS, Android, Windows all ship one). It's a deliberately stripped-down
browser — no extensions, no bookmarks, often no full address bar, reduced
JS/feature support — sized to a small fixed window (900×572 on iOS).
Two implications for us: (a) don't build the sign-in path assuming a full
modern-browser feature surface; (b) iOS in particular can take **up to ~45
seconds** just to *present* the CNA window in the first place — real,
uncontrollable latency spent before our page gets a chance to load at all.
That's exactly why the seconds our own code *does* control (first paint →
interactive sign-in form) matter disproportionately: the guest has often
already waited through a slow, invisible OS step by the time they see
anything from us.
([Apple Developer Forums](https://developer.apple.com/forums/thread/706265), [captivebehavior.wballiance.com](https://captivebehavior.wballiance.com/))

**Splash-page vendor guidance (Meraki-ecosystem writeups, Purple, UniFi).**
Converging advice across all three: lead with logo/title + location context
+ one clear action; design mobile-first because guest-WiFi traffic is
majority mobile and a page that was only checked on a laptop routinely
breaks on phones; every additional field or screen has a real, measured
conversion cost. None of the vendor material discusses skeleton/progressive
loading explicitly — the perceived-speed research below is the stronger
source for that half of the brief.
([splashaccess.com](https://www.splashaccess.com/meraki-splash-page/), [purple.ai](https://www.purple.ai/en-us/guides/how-to-create-a-guest-wifi-login-page), [help.ui.com](https://help.ui.com/hc/en-us/articles/23948850278295-Best-Practices-Guest-WiFi))

**Perceived-performance research (Nielsen Norman Group, web.dev).** Skeleton
screens are read as ~20–30% faster than spinners, but the effect is
band-limited: NN/g's 2026 report finds skeletons help perceived performance
specifically when *actual* load time falls between **400ms and 3s** — below
that they're an unnecessary flash, above it the guest needs a real status/
retry affordance instead, not a placeholder. Facebook measured skeleton
screens as ~300ms faster perceived-load than spinners. NN/g separately finds
"waits with feedback" feel 11–15% faster than silent waits. Notably, our own
`portal.index.tsx` already splits its loading UI at 3s (spinner → "still
connecting" text) and times out network calls at 6s — almost exactly NN/g's
400ms–3s skeleton band followed by a real status/retry affordance past it.
That structure is already right; what's missing is that the *content* of
the wait is a generic spinner+dots, not a skeleton of the destination
sign-in card itself (see §3.2).
([nngroup.com](https://www.nngroup.com/articles/skeleton-screens/), [web.dev](https://web.dev/learn/performance/understanding-the-critical-path))

**Critical rendering path guidance (web.dev/MDN).** Inline only
above-the-fold-critical CSS, defer everything else, and use resource hints
(`preload`/`prefetch`) deliberately rather than by default — this is the
direct lens for the bundle-size finding below.

---

### 2. What's actually happening today, read from the real code

#### 2.1 `/captive-portal/resolve` — not the bottleneck

Traced `CaptivePortalService.resolve_portal_config` and
`CaptivePortalRepository` (`cloud-guest-repo/backend/app/domains/
captive_portal/{service,repository,router}.py`): worst case this is ~3–4
sequential single-row lookups — a location fetch, `find_active_for_location`,
a fallback `find_active_org_default`, plus (in the router, guest-facing path
only) a second location fetch for the display name and a conditional
`BrandingRepository.get_by_organization` lookup when the config row itself
has no logo/background URL set. Every query is an indexed `WHERE` with
`LIMIT 1`; there are no joins, no N+1s. This is cheap on the DB side — it is
not where "feels slow right after connecting" comes from. Also worth
noting as something already done right: `portalRuntimeService.resolveConfig`
/ `checkActiveSession` (`src/services/portal-runtime.service.ts`) both
already use a deliberately shortened **6s** timeout instead of the client's
global 20s default, specifically because a guest device is on a fresh,
sometimes-flaky pre-auth network path. Keep this.

#### 2.2 What's actually eagerly loaded before the sign-in form is usable — the real bottleneck

Measured directly from the current production build in `.output/`
(bundle inspection + the app's own route manifest — no live device-on-a-real-
captive-portal network trace was available in this environment, flagged
honestly rather than fabricated):

- TanStack Start's build manifest (`_tanstack-start-manifest_v-*.mjs`)
  attaches a `preloads` array to `__root__` — the root route every single
  route in this app mounts under, `/portal/*` included. That array currently
  points at 9 chunks totaling **~354KB gzipped (~1.19MB raw)**, dominated by
  one `index-*.js` chunk alone: **1,166,469 bytes raw / 326,992 bytes
  gzipped**. Grepping that file confirms it contains `recharts` and `xlsx`
  — admin-dashboard charting and spreadsheet-export code with zero relevance
  to the guest sign-in flow, shipped anyway because `vite.config.ts` has no
  `manualChunks`/`rollupOptions` splitting the guest-portal entry away from
  the admin-dashboard entry. Rollup's default chunking put everything
  reachable from the single shared root into one vendor graph.
- On top of that, the portal-specific chunks actually needed to paint and
  hydrate `/portal/welcome`'s sign-in card (`portal.index`, `portal.welcome`,
  `PortalShell`, `PortalGuestUi`, `portal-schemas`, `portal-auth-methods`,
  `portal-locale`, `portal-returning-guest`, `portal-guest-errors`,
  `guest-portal`, plus 3 tiny helper chunks) add **~17.5KB gzip** more.
- **Net: ~371KB gzip / ~1.2MB raw of JS sits on the critical path to an
  interactive sign-in form** — on a device that just associated with WiFi
  and has *no real internet yet*, only walled-garden access to this app's
  own host, often over a shared/congested venue backhaul. This is the
  single biggest concrete lever available for "feel fast the moment a guest
  connects."
- SSR is already in place (`.output/server/_ssr/*.mjs` per route), so first
  paint does *not* wait on this bundle — the guest sees server-rendered HTML
  immediately. But **time-to-interactive** (the moment tapping the phone
  field / "Send OTP" actually works) is gated on this ~370KB bundle
  finishing download + parse + execute + hydrate. That gap — fast paint,
  slow interactivity — is exactly the "feels slow right after connecting"
  window the founder is describing, even though first paint itself is fine.

#### 2.3 Webfonts: the brief's PR #81 framing doesn't match what's on disk — verified against actual code

Worth flagging directly: PR #81 on this repo is titled *"Captive portal v4:
structural legibility fix + UX brief"* — not a webfont-removal PR. The real
webfont-removal work is **PR #53** ("drop framer-motion + webfonts on this
path") and commit `0bada97` ("Load Google Fonts asynchronously instead of
render-blocking"). The "12 screens" figure in the brief *is* accurate,
though — verified by grep, independent of which PR gets credited:

- **Holding, confirmed real:** `src/routes/__root.tsx` injects the Google
  Fonts `<link>` via a `<script>` *after* mount (`LOAD_FONTS_SCRIPT`), never
  a blocking `<link rel="stylesheet">` in `<head>` — no captive-portal page
  is render-blocked on `fonts.googleapis.com`, which the code's own comment
  correctly notes is unreachable pre-auth (a blocking request would hang for
  a full browser connection-timeout before anything painted).
- **Holding, confirmed real:** `PortalShell.tsx`'s redesigned "light" flow
  (`portal.welcome`/`success`/`expired`/`set-password` + `GuestSignInCard`)
  uses a hardcoded system-font stack (`PG_FONT_STACK`) for the actual
  card/heading text — genuinely zero webfont dependency for the sign-in
  card itself.
- **NOT fully holding:** 12 other `portal.*.tsx` route files — `portal.index`,
  `portal.closed`, `portal.offline`, `portal.redirect`, `portal.failure`,
  `portal.team`, `portal.set-password`, `portal.auth.$method`,
  `portal.expired`, `portal.terms`, `portal.verify`, `portal.session` —
  still use Tailwind's `font-display` utility class, which resolves
  (`styles.css:65`) to `--font-display: "Space Grotesk", "Manrope",
  ui-sans-serif...` — a real webfont dependency, on real guest-facing
  headings (e.g. `portal.index.tsx`'s own "Connecting…" loading screen).
  Because `LOAD_FONTS_SCRIPT` fires unconditionally on every route, this
  fetch goes out on `/portal/` too, and a fresh guest device genuinely
  cannot reach `fonts.googleapis.com` pre-auth — so this is a
  guaranteed-to-fail request fired on **every single portal pageview**, not
  an edge case. It doesn't block rendering (confirmed, good), but it's dead
  bandwidth/battery on every guest session, and on the rare occasion it
  *does* succeed (tab still open once the guest is authenticated and back on
  real internet, or a venue whose walled garden happens to allow Google
  Fonts) any heading using `font-display` FOUT-swaps from system font to
  Space Grotesk/Manrope mid-session — a visible font swap squarely in scope
  of "should feel fast," not just a cosmetic nit.

  **Recommendation:** finish what PR #53 started. Cheapest fix: give
  `.portal-runtime` its own `--font-display` override pointing at the same
  `PG_FONT_STACK` system stack already used by the redesigned screens — one
  CSS rule, no component changes, and it retroactively fixes all 12 files
  at once since they all render inside `.portal-runtime`.

---

### 3. Recommendations — perceived-speed improvements

1. **Split the guest-portal entry out of the shared root vendor chunk.**
   Highest-leverage fix given the ~354KB of avoidable payload in §2.2 — add
   `manualChunks` (or an equivalent route-level split) so `recharts`/`xlsx`/
   other admin-only dependencies aren't reachable from `__root__`'s preload
   list for `/portal/*`. The goal isn't a specific bundler config so much as
   the outcome: `/portal/*`'s preload list should not be identical to
   `/customer/*`'s or `/master/*`'s.
2. **Skeleton state for the sign-in card, not a generic spinner.**
   `portal.welcome.tsx` currently renders a bare centered spin-circle while
   `isLoading`. Swap it for a static skeleton shaped like the real
   `GuestSignInCard` (logo circle, heading bar, tab pill, input rows) — per
   §1's NN/g finding this reads ~20–30% faster within the exact 400ms–3s
   band this screen already lives in, and lets the guest start visually
   parsing the eventual form before data arrives. Cheap to build: the real
   card's shape/dimensions don't depend on `config`, so the skeleton can be
   authored once, statically.
3. **Progressive reveal instead of one big `isLoading` gate.**
   `WelcomePage` currently hides the *entire* `GuestSignInCard` behind one
   boolean. The logo mark and card shell don't need `config` at all beyond a
   placeholder; only venue name, tab set, and brand colors are actually
   config-dependent. Render the shell immediately, stream in the
   config-dependent pieces as they resolve.
4. **Finish the webfont scoping fix** (§2.3) and audit
   `CampaignOverlay`/`AuthMethodForms` and other portal-adjacent components
   for anything not needed for first paint that isn't already route-split.
5. **Keep, don't regress:** the 6s timeout + 3s "still connecting" split
   (`portal.index.tsx`) — it already lines up with NN/g's perceived-
   performance band almost exactly — and SSR for first paint.

---

### 4. Information-density brief — "the welcome box feels too big/bulky"

**What's actually in the card today** (`GuestSignInCard.tsx`):

- *Above* the card (not even inside it): a logo mark scaling up to 96px
  (`h-24` at `md:`), an `h1` heading, a subtext paragraph — a substantial
  vertical block before the actual white card starts.
- *Inside* `PortalCard` (`variant="light"`, `p-6` = 24px padding all
  sides): an optional 2-tab pill switcher, phase-dependent input fields, a
  terms-acceptance block that is *itself* a visually boxed element
  (`rounded-xl bg-slate-50 p-3`) nested inside the already-bounded card, an
  alert-banner slot, the primary CTA, then secondary methods.
- *Below* the card: a "saved passwords" note.

**Already doing the right thing, worth building on rather than
reinventing:** the alternate-OTP-channel links and voucher fallback
(`otherMethodLinks`/`hasVoucher`) are already collapsed behind a native
`<details>`/`<summary>` disclosure, closed by default — real progressive
disclosure, already in the codebase, not something to introduce from
scratch.

**Concrete brief:**

a. **Collapse the floating header block into the card, or shrink it hard.**
   Logo + heading + subtext sitting above a separate white card reads as two
   stacked components, which is a real, structural source of "bulky" —
   independent of any one element's size. Recommend a fixed ~56–64px logo
   regardless of breakpoint (today's up-to-96px scaling at `md:`+ is
   desktop-oriented sizing on a flow that's majority mobile, per §1's vendor
   research) and one tighter heading step — cuts real vertical space before
   the card even begins.

b. **Flatten the terms-acceptance box.** `rounded-xl bg-slate-50 p-3` is a
   card-within-a-card. The legal content is required; the dedicated
   background/padding/border-radius nested inside an already-bounded
   container is not. Drop the wrapper, keep a plain inline checkbox + label
   row — same legal text, materially less visual "boxiness," and it costs
   nothing functionally.

c. **Consider extending `<details>` to the tab switcher itself**, for the
   case where a returning device already has a known-preferred method
   (`deviceHasPassword()` already exists as exactly this signal). When both
   OTP and password are enabled, the pill switcher currently shows both
   forms' worth of visual weight up front; a single default method + a
   "use a password instead" link that reveals the second form on demand
   would shrink the default first-paint form to one path's fields.
   Flagging as an option, not a mandate — the founder's complaint was about
   the box overall, not the tabs specifically.

d. **The target is density and hierarchy, not deletion.** Every field and
   link currently shown is a real, working, backend-verified auth path
   (confirmed by reading `GuestSignInCard.tsx` end to end) — nothing here
   should be cut for its own sake. The fix is fewer, tighter vertical blocks
   and less nested "boxes within boxes," not fewer features.

---

### Sources

- [Captive portal API support | Android Developers](https://developer.android.com/about/versions/11/features/captive-portal)
- [RFC 8908: Captive Portal API](https://www.rfc-editor.org/rfc/rfc8908.html)
- [RFC 8910: Captive-Portal Identification in DHCP and Router Advertisements](https://www.rfc-editor.org/rfc/rfc8910.html)
- [Captive Network Portal Behavior — Wireless Broadband Alliance](https://captivebehavior.wballiance.com/)
- [Delay of 45 seconds with captive portal, DHCP 114 — Apple Developer Forums](https://developer.apple.com/forums/thread/706265)
- [Meraki Splash Page: Complete Guide to Guest WiFi — Splash Access](https://www.splashaccess.com/meraki-splash-page/)
- [How to Create a Guest WiFi Login Page — Purple](https://www.purple.ai/en-us/guides/how-to-create-a-guest-wifi-login-page)
- [Best Practices: Guest WiFi — Ubiquiti Help Center](https://help.ui.com/hc/en-us/articles/23948850278295-Best-Practices-Guest-WiFi)
- [Skeleton Screens 101 — Nielsen Norman Group](https://www.nngroup.com/articles/skeleton-screens/)
- [Understand the critical path — web.dev](https://web.dev/learn/performance/understanding-the-critical-path)
