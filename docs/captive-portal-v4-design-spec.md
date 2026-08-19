# Captive Portal v4 — Design Spec

Two parallel work streams feed this one document:

- **UX / Interaction (this section, "UX v4")** — flow, information architecture, state machine, loading/error UX, copy hierarchy, auth-method switching pattern. Owner: UI/UX Engineer.
- **Visual design ("Visual v4")** — palette, type, layout rhythm, motion, illustration style. Owner: Senior Design Engineer. *(Add your section below the UX section, don't overwrite it — if you're reading this before UX v4 exists, same courtesy in reverse.)*

A FE engineer should be able to read both sections together without contradiction. The UX section deliberately avoids colors/fonts/exact spacing; where it says "higher visual weight" or "de-emphasized," that's a hand-off to Visual v4, not a spec of exactly how.

---

## UX v4 — UI/UX Engineer

### 0. Where this starts from

This is **not** a rebuild from an empty flow. `src/routes/portal*.tsx` and `src/components/portal-runtime/*` already carry a substantial redesign (referenced in code comments as a prior "captive-portal redesign spec," now merged and the doc itself deleted) that fixed a long list of real, live incidents — collapsed the flow from 4+ page-types down to essentially "sign-in card → connecting → session," moved a hidden-iframe hotspot login to a real top-level POST, added guest-identifier tracking so RADIUS actually authorizes the right user, and added a resubmit cooldown so OS-triggered remounts stop flashing the guest between screens.

v4's job is **not to re-litigate those fixes**. It's to (a) close the real gaps that are still there after that pass, and (b) make sure a full visual reskin doesn't silently reintroduce any of the mechanics that were hard-won from live incidents. Section 3 is the audit; Section 5 is the non-negotiable list; Section 6 is the actual brief.

### 1. The real state machine (as it exists in code today)

```
/portal  (layout — validates organizationId/locationId/routerId)
  │  missing/invalid any of the 3 → IncompletePortalLinkError (honest "link looks
  │  incomplete" screen, not a 500) — sessionStorage-persisted IDs fill in a bare
  │  reload/OS re-probe that drops query params
  ▼
/portal/  (PortalLoading — silent router, not really a "screen" a guest reads)
  │
  ├─ config still loading, or (no session + has deviceMac) live-session check in flight
  │     → branded logo/spinner splash, "still connecting" notice + retry at 3s
  │
  ├─ has session (persisted or live-checked) ─┬─ fresh hotspot redirect present → /portal/success
  │                                            └─ no fresh redirect               → /portal/session
  │
  ├─ no session, config.isOpenNow === false → /portal/closed
  │
  └─ no session, open → /portal/welcome

/portal/welcome  (GuestSignInCard — THE real landing screen)
  │  2-tab pill: [OTP channel] / [I have a password], picked by priority + returning-
  │  guest localStorage flag. OTP tab is inline: phone/email → send → 6-digit code →
  │  (new SMS/WhatsApp guest only) optional "tell us about yourself" → afterLogin.
  │  Password tab: identifier + password → afterLogin.
  │  Voucher + non-primary OTP channels: collapsed <details> "Other ways to sign in".
  ▼
afterLogin() → /portal/success
  │  fires the REAL hotspot-login POST (top-level form, not iframe) to RouterOS's
  │  link-login-only URL, gated on session + hotspotLoginUrl + guestIdentifier all
  │  being present, cooldown-guarded against OS remount bounces. dst → /portal/session.
  ▼
/portal/session  (the ONE real resting page — this is where a guest actually stays)
     countdown timer, data usage, device card, optional set-password nudge, optional
     "have a team code?" nudge, optional Campaign overlay, Continue-browsing button,
     Disconnect button.

Edge / failure states reachable from the above:
  /portal/closed    — business-hours gate (new sign-in only; existing session always wins)
  /portal/expired   — disconnected/session ended → "sign in again" (password) / "use OTP instead"
  /portal/offline    — no connectivity → retry
  /portal/failure    — generic auth failure → retry (legacy path, see below)
  /portal/team       — optional, post-connect only, never a login method
  /portal/set-password — optional, post-OTP-verify nudge (or reachable again from /portal/session)
  /portal/terms      — org's real terms/privacy content, or an honest platform-authored default
  /portal/redirect   — 5s countdown to the guest's real pre-hotspot destination

Legacy / deep-link-only (not part of the primary flow, kept for bookmarks/direct links):
  /portal/auth        — bare hit now just redirects to /portal/welcome
  /portal/auth/$method — full-page per-method form (mirrors GuestSignInCard's forms)
  /portal/verify       — full-page OTP verify (mirrors GuestSignInCard's inline OTP)
```

The founder's own standing requirement, already partly enforced in code comments: **"login page, then session page, that's it."** Any v4 change that adds a new mandatory full-page step between sign-in and session (not counting a real async wait) works against that mandate and needs a specific justification.

### 2. Real-world constraints this flow has to hold up under

- **Weak/pre-auth network.** Config resolve and live-session check are on a 6s hard timeout specifically because a fresh guest device is "by definition... on a fresh, sometimes-flaky pre-auth network path" (`portal.index.tsx`). Every new network call v4 adds to the happy path is a new place this can stall.
- **Impatient guests.** The whole "collapse the funnel" direction — set-password and team-join both deliberately relocated from the login path to post-connect nudges on `/portal/session` — exists because forcing extra screens before internet access is the wrong trade for this audience. Preserve that principle; don't reverse it.
- **Non-English speakers, RTL.** i18n is already first-class (`portal-i18n.ts`, RTL_LANGS, full Hindi coverage as of `b9ff5e1`) — this is a strength, not a gap. v4 must not bolt any new hardcoded English string onto the flow; every new copy string needs a translation key from day one, the same discipline the rest of the flow already follows.
- **QR-code mobile vs. redirect desktop.** `PortalShell`'s light variant already does real two-column composition at `lg:` width (BrandPanel + card) vs. single-column edge-to-edge below it — and had a real bug (narrow constrained-preview container triggering the viewport-width breakpoint anyway) that's since been fixed. Any new screen v4 adds needs to work in both contexts, not just be visually inspected on one.
- **OS-triggered remounts.** iOS/Android's captive-portal-detection mini-browser genuinely reloads the portal URL mid-flow, confirmed live at ~3 cycles in ~600ms. This is not a hypothetical edge case to design around later — it happens on essentially every real connection.

### 3. UX audit — what's still actually wrong, grounded in the real code

**3.1 — `/portal/success` has no timeout/retry escape hatch, unlike everywhere else this exact lesson was already learned.**
`portal.index.tsx`'s loading screen explicitly added a 3-second "still connecting" notice + manual retry specifically because a silent unresolving spinner was a real, confirmed incident. `SuccessPage` (`portal.success.tsx`) fires a real top-level form POST to the venue's own router and then renders `PortalConnectingState` with **zero timeout, zero retry, zero escape hatch** — if that POST target is slow or unreachable (a flaky in-venue LAN segment, RouterOS momentarily busy), the guest is stuck on "Just a moment" indefinitely, with no way back. This is the single most concrete structural gap in the current flow and directly contradicts a lesson this same codebase already paid for elsewhere.

**3.2 — Two different resend-cooldown philosophies for the same action.**
`GuestSignInCard`'s inline OTP resend starts at `resendCooldown = 0` (a guest can hammer resend immediately) and only gets a real cooldown once the server 429s and hands back `retry_after_seconds`. The legacy full-page `/portal/verify` uses a fixed 60-second client-side countdown regardless of server truth. Neither is "wrong," but they disagree, and a guest bouncing between the inline flow and a bookmarked deep link (both real, both live) gets inconsistent resend behavior for what should be the identical action.

**3.3 — Terms checkbox appears at a different step depending on which tab a guest is on.**
Password tab: identifier, password, and the terms checkbox are all on the same screen. OTP tab: the checkbox only appears on the *second* screen (after phone entry, alongside the code input) — a guest can fill in their phone number, wait for the SMS, type the 6-digit code, and only then discover there's a required checkbox blocking submission. Same requirement, two different points of friction depending on which of the two tabs a guest happened to land on.

**3.4 — Country-code default doesn't match the real deployment base.**
`countryCode` defaults to `"+1"` in a freeform text input. The incidents on record (Haldwani, "sector 12") point at India-based venues as real, live deployments; a `+1` default is friction for the actual guest base, not a neutral placeholder. This is a data/interaction decision (default value, not a color), squarely in this section's lane.

**3.5 — Auth-method switcher degrades ungracefully for the "many OTP channels, no password" case.**
The 2-tab pill (`showTabs = hasOtp && hasPassword`) only renders when a location has *both* an OTP method and password enabled. A location with all three OTP channels (SMS + email + WhatsApp) but no password gets **no visible switcher at all** — just the primary channel's form, with the other two channels tucked inside the same collapsed `<details>` "Other ways to sign in" that also holds voucher. That's a reasonable minimal-friction default for the 2-method case, but it means "how many real, visible choices does a guest see" silently varies by venue configuration in a way that isn't obviously by design — worth a deliberate decision, not an emergent one.

**3.6 — The post-OTP profile prompt breaks the "extras happen after connect" pattern the rest of the flow just established.**
Set-password and team-join were both *deliberately* relocated out of the login funnel and onto `/portal/session`, specifically because forcing extra steps before internet access is the wrong trade (see `portal.session.tsx`'s own comments on why both moved there). The "tell us about yourself" name/email prompt (new SMS/WhatsApp guests only) still sits *inside* the login funnel, between OTP verification and `afterLogin()` — one more screen before a guest who just proved their identity actually gets online. It's skippable, but it's still a screen, and it's the one piece of "nice-to-have, not required for network access" content that didn't get moved to the post-connect nudge pattern its siblings already use.

**3.7 — `/portal/closed` gives no actionable next step.**
The business-hours gate shows a static message with no indication of *when* the venue reopens, even though `config.isOpenNow` is computed live off a real configured schedule. Whatever the venue admin didn't type into `businessHoursClosedMessage`, a guest gets zero information on when to come back — a dead end, not a next step.

**3.8 — Legacy per-method pages (`/portal/auth/$method`, `/portal/verify`) are a second, slightly different implementation of the same forms.**
Not currently broken, and deliberately kept for deep links/bookmarks — but `AuthMethodForms.tsx` (used by the legacy pages) and `GuestSignInCard.tsx`'s own inline field markup (used by the real primary path) are two separate implementations of "enter your phone number," "enter your OTP," etc., not one shared component. §3.2 above is a direct symptom of this split. v4 should not grow this gap further; ideally the legacy pages become thin wrappers around the same inline building blocks `GuestSignInCard` uses, not a second copy to keep in sync by hand.

### 4. What's already right — preserve these, don't "fix" them

- The 2-tab pill for OTP-vs-password when both are enabled is the right pattern for this screen size and this guest's patience level — a 5-item vertical method list (the old `/portal/auth` menu) forces a guest to read and choose before they've even started, and is exactly what got demoted to a deep-link-only fallback. Don't resurrect it as the primary pattern.
- Collapsing less-common methods (extra OTP channels, voucher) behind a single low-emphasis disclosure instead of always-open competing links is correct hierarchy — one obvious primary action, not four things fighting for attention.
- The shared, identical `PortalConnectingState` component across `/portal/` (pass-through) and `/portal/success` (actively submitting) must stay a single shared component, not two visually distinct screens. This is what stops the OS-remount bounce from reading as a flash — see §5.1.
- The real, honest error copy pattern (backend business-logic messages shown verbatim, only the raw 422 framework string gets a friendly rewrite via `friendlyGuestAuthError`) is correct and should extend to any new error state v4 introduces — never invent a vaguer message when the backend already has a plain-English one.
- Accessibility (A11yMenu: high-contrast, large-text) and i18n (RTL, translate()) are real, load-bearing features already wired through every screen — extend them to any new screen, don't treat them as optional polish.

### 5. Non-negotiable invariants (do not reintroduce these incidents)

Anyone touching this flow — FE engineer, either design stream — must preserve these regardless of visual direction:

1. **The hotspot-login submission must be a real top-level navigation (a full-page form POST), never an iframe or fetch/XHR.** The portal is HTTPS; RouterOS's `link-login-only` target is plain HTTP on the venue LAN. An iframe/fetch gets silently mixed-content-blocked or CORS-blocked with nothing visible telling anyone it failed (`portal.success.tsx`'s incident #1).
2. **Whatever identifier a guest verified with must be threaded through to the hotspot-login POST exactly as sent — never a hardcoded/shared credential.** RADIUS authorizes by exact username-to-active-session lookup; a wrong or generic username is silently rejected with no diagnostic (incident #2, Haldwani).
3. **`/portal/` (pass-through) and `/portal/success` (actively submitting) must render the identical connecting visual.** OS captive-portal-detection remounts bounce a guest between these two routes for real — confirmed ~3 cycles in ~600ms. Two different-looking "connecting" screens read as a flash; one steady frame doesn't.
4. **A resubmit-cooldown must gate the hotspot-login POST**, so an OS-triggered remount within the cooldown window skips straight to the resting page instead of firing a redundant top-level POST (itself a full navigation, itself the visible flash).
5. **An existing app-level session must never be shown as "connected" without also re-verifying/re-opening the NAS's own gate whenever a fresh hotspot redirect is present.** The app's own session is long-lived; the router's hotspot gate is not (a WiFi blip reopens it). Route through `/portal/success` first whenever `hotspotLoginUrl` is present on this load, even for an already-known guest.
6. **Every genuinely async wait needs a visible timeout + manual retry, not an indefinite spinner.** This is the single most-repeated lesson in this codebase's history (§3.1 is the one place it's still missing).
7. **A missing/invalid portal link (bad or absent org/location/router ID) renders an honest, friendly explanation as a normal 200, never the generic root error boundary or a raw 500.**
8. **No client-supplied MAC/device claim may ever grant access on its own.** That bypass was found and removed; don't reintroduce anything that trusts a browser-supplied MAC/IP for auth decisions (device IP/MAC threading for bandwidth queues is fine and real — auth trust is not).

### 6. v4 interaction brief

Concrete asks, in FE-actionable terms. Each is interaction/flow/copy — visual execution (exact spacing, color, motion timing) is Visual v4's call.

**6.1 Fix the `/portal/success` dead-end (highest priority).**
Add the same pattern `/portal/` already uses: a "taking longer than expected" notice with a manual retry after ~3–5s of the hotspot POST being in flight, and — since a top-level form POST can't easily be "cancelled and retried" the way a query can — the retry action should re-run the same `submitHotspotLogin` call (safe: RADIUS authorize is a no-op for an already-authorized session) rather than silently doing nothing. If the guest is still stuck past a longer bound (~15s), offer a way back to `/portal/welcome` as a last resort, framed honestly ("Still working on it — you can wait, or try signing in again"), not as a hard failure state.

**6.2 One terms-acceptance placement, not two.**
Move the terms checkbox to appear at the *first* screen of every method's flow (phone/email entry for OTP, not the code-entry screen) so its position is consistent with the password tab and a guest never discovers a blocking requirement only after already waiting for and entering a code. Needs a translation-key copy pass, not new keys — `agreeToThe`/`termsAcceptableUsePolicy` already exist.

**6.3 Default the country code to the deployment's real locale, not a hardcoded `+1`.**
Derive a sensible default from `config.defaultLanguage`/venue locale if available, or from the browser's own locale as a fallback — this is a UX correctness fix, not a visual one. If no reliable signal exists, keep it editable and prominent rather than silently wrong for most real venues.

**6.4 Make the resend-cooldown behavior consistent everywhere the same action exists.**
Pick one source of truth: server-driven (the `retry_after_seconds` GuestSignInCard already reads from a 429) is the more honest one, and the fixed 60s in `/portal/verify` should be brought in line with it rather than the reverse — a guest shouldn't be told "wait 60s" if the server itself would have allowed a resend at 30s, or vice versa.

**6.5 Move the post-OTP "tell us about yourself" prompt out of the login funnel, onto `/portal/session` as another optional nudge — consistent with set-password and team-join.**
This keeps "OTP verified → online" as a true two-step handoff (matching the founder's "login page, then session page, that's it") and treats profile capture the same way the codebase already decided to treat every other non-blocking extra. Needs `pendingSession`/`afterLogin` in `GuestSignInCard` simplified to always call `afterLogin` immediately after verify; the profile form becomes a new nudge card on `/portal/session`, gated the same way `showPasswordNudge` already is (only for a guest who hasn't filled it in, dismissible).

**6.6 Give `/portal/closed` a real next step when the venue configured schedule data exists.**
If `config` exposes the actual open-hours schedule (confirm the exact shape on the backend before committing to this — don't invent a field), surface "opens again at [time]" alongside the admin's free-text message rather than only ever showing that free text. If no such field is currently exposed by `/captive-portal/resolve`, flag it as a backend follow-up rather than fabricating a number client-side (this codebase has an explicit standing rule against inventing guest-facing claims not backed by real data — see `BrandPanel`'s own comment on dropping a fabricated "~15 seconds" claim).

**6.7 Decide the multi-OTP-channel-no-password case deliberately, not by omission.**
For a venue with 2+ OTP channels enabled and no password method, give that primary channel's form a visible (not collapsed) way to switch channel — could be as light as small icon-tabs above the single field, distinct from the full 2-tab pill (which is specifically for the OTP-vs-password split) so it doesn't imply a false parity between "channel" and "method." This is a real, live configuration (SMS+email+WhatsApp all enabled) and currently degrades to an undiscoverable disclosure link.

**6.8 Consolidate the legacy per-method forms onto the same field components `GuestSignInCard` uses.**
Not a visible guest-facing change — an implementation ask so `/portal/auth/$method` and `/portal/verify` stop being a second, driftable copy of the same phone/email/OTP/password fields. Concretely: extract the phone/email/code inputs from `GuestSignInCard` into small shared pieces `AuthMethodForms.tsx` renders too, rather than each maintaining its own JSX and its own resend-cooldown logic (which is exactly how §6.4's inconsistency happened in the first place).

**6.9 Auth-method switcher — hierarchy guidance for whoever builds this visually.**
The 2-tab pill pattern is right; give it clearly higher visual weight than the collapsed "other ways to sign in" disclosure and the OTP-channel micro-switcher from §6.7 — three tiers of visual weight (primary tab pill > inline channel switcher > collapsed disclosure), not two, now that §6.7 adds a middle tier. The primary CTA button (Send code / Sign in) needs to read as unambiguously the one thing to tap; that's a hierarchy requirement for Visual v4 to execute, not a color choice made here.

### 7. Explicit hand-off boundary (for the FE engineer building both together)

- **This section owns:** which screens exist, what order they happen in, what's required vs. skippable, what state persists across reloads/remounts, what copy says and where terms/errors/nudges appear, timeout/retry behavior, the auth-method-switching pattern's *structure* (tabs vs. inline switcher vs. disclosure, and which tier each method falls into).
- **Visual v4 owns:** palette, type, exact spacing/radius/shadow, motion/transition timing and easing, illustration style, the "flat vs. glass" card language, iconography style.
- **Where they must agree explicitly, don't assume:** the visual weight ordering in §6.9 (three tiers, not two) needs a matching visual treatment, not just a DOM order; the §6.1 retry affordance needs to look actionable enough that a stuck guest actually taps it, not blend into the connecting screen's calm styling; any new screen from §6.5/§6.6/§6.7 needs to inherit `PortalShell`'s light-variant card language rather than get a one-off visual treatment.

---

*(Visual v4 — Senior Design Engineer: add your section below this line.)*

## Visual v4 — Senior Design Engineer

### 0. Grounding note (read before the rest of this section)

Everything below was checked directly against `origin/main` today (`f487ecd`), not memory or an older local checkout — worth stating explicitly because this repo's local `main` was found 11 commits behind `origin/main`, missing exactly the commits most relevant to this brief: **PR #77** ("Captive portal: v3 polish — flatten last gradient/glass remnants, drop redundant framer-motion") and **PR #80** ("Fix guest sign-in header illegible against a real background photo" — the live incident this whole redesign is a response to). If you're reading this on a checkout that predates `f487ecd`, sync first; the audit below assumes that commit is present.

A second grounding fact worth stating up front: a prior document, `docs/design-v3-unified-system-spec.md`, already did real, correct thinking about this exact surface (its Part 3, "captive guest portal," is the source of the zero-framer-motion / zero-Aceternity policy this section ratifies below). That document itself never made it into any branch — it exists only in an orphaned local commit (`486622a…`, unreachable from `main` or `origin/main`), the same class of loss this task was explicitly asked not to repeat. Its Part 3 conclusion was right and is preserved below (§5); the document itself is superseded by this one, which — unlike its predecessor — is actually being committed.

### 1. Point of view — what's actually wrong, and why "restrained and legible" hasn't been enough

The post-#77/#80 surface is honest and functional: flat `#FAFAF8` canvas, thin-bordered white cards, one indigo accent used sparingly, system fonts, zero framer-motion on the critical path. None of that is wrong, and none of it is being thrown out. But five real, verifiable problems remain, and they share one shape: **a correct principle, applied once, at one call site, instead of structurally.**

1. **Legibility-against-photo was fixed twice, independently, four days apart** — `BrandPanel` got a `hasBackgroundImage && "bg-white/80 backdrop-blur-md"` treatment on Aug 5; `GuestSignInCard`'s own header got the identical fix, separately, on Aug 18 (PR #80), because nobody had connected the two as the same underlying gap. That's not a criticism of either fix — both are correct — it's evidence the *mechanism* is wrong: legibility is currently an opt-in each content block has to remember, not a guarantee the layout provides. A third block added next month, in either repo's future, will reintroduce the exact bug PR #80 just fixed, because there's still no single place that makes it structurally impossible not to. §3 below is the actual fix.
2. **The same "no webfonts pre-auth" principle drifted the same way, for a different resource.** `PortalShell`'s `PG_FONT_STACK` comment is explicit: a captive-portal guest "may not even be able to reach a font CDN pre-auth," so the redesigned sign-in card deliberately dropped Space Grotesk/Manrope for system fonts. Checked directly: **12 of the 17 real `portal.*` screens** (`closed`, `expired`, `failure`, `offline`, `redirect`, `team`, `verify`, `set-password`, `session`, `index`, `terms`, `auth.$method`) still reach for `font-display` (Space Grotesk, an async Google Font) on their own `<h1>`. Only `GuestSignInCard` itself — the one screen the principle was written for — actually honors it. Same shape of bug as #1: a good rule, applied at exactly one call site.
3. **`PortalShell.tsx` still carries a complete second "dark" visual language** (glass-on-navy, its own header, its own `PortalCard` recipe) that **zero real routes use** — every one of the 17 `portal.*` routes passes `variant="light"`, confirmed directly. This isn't a hypothetical simplification opportunity; it's ~150 lines of dead branching that everyone touching this file has to read past, and the reason the file *looks* like it's still making a real design decision ("which variant for this screen?") when in practice that decision was already made, everywhere, and never cleaned up.
4. **`GuestSignInCard.tsx` is a 765-line monolith** fusing the visual shell (heading, tab pill, card) with three independent auth state machines (OTP send/verify + profile capture, password login, resend cooldown) and the legacy per-method forms duplicate large parts of it by hand (UX v4 §3.2/§3.8 already flagged the resulting drift). A visual redesign has no clean seam to attach to here — every past "just reskin it" attempt has necessarily also touched auth logic, which is exactly how a restrained, careful pass still reads as a patch rather than a system four PRs later.
5. **The visual language is competent but hasn't earned a point of view.** "Flat white card, thin border, small shadow, one accent color used sparingly" is what's left *after* stripping out glassy-SaaS excess — it's the negative space of the old design, not a positive statement of what this product's sign-in screen actually is. That gap is very likely the real substance of "bilkul theek nahi lag raha": everything about the current screen is *defensible*, and none of it is *distinctive*. A rebuild needs to add exactly one thing back, deliberately, not just keep subtracting.

**The v4 point of view, in one line: a canvas that is legible by structural guarantee, independent of anything a venue uploads — plus exactly one deliberate, ownable visual signature, cheap enough to run on every screen without a JS animation cost.** Sections 2–7 make that concrete.

### 2. Design tokens

The portal intentionally does **not** consume the dashboard's `--primary`/`--background`/dark-mode token system (`src/styles.css`'s `:root`/`.dark`/`.master-theme`/`.customer-theme` layers) — it never has, and that's correct, not an oversight: a captive-portal guest signing in for thirty seconds should never see this screen shift because their OS is in dark mode, or because of a theme decision that belongs to an internal dashboard. **v4 makes this separation explicit and permanent** rather than leaving it implicit (today it's true only because nobody's written a `dark:` class on a portal route yet). The portal gets its own small, closed token set:

**Structural neutrals — fixed, never venue-controlled, this is what makes legibility a guarantee and not a hope:**

| Token | Value | Role |
|---|---|---|
| `--pg-canvas` | `#FAFAF8` | Page background, no-photo case. Unchanged — already correctly distinct from stock `#FFFFFF` SaaS white. |
| `--pg-surface` | `#FFFFFF` | Card / legibility-panel fill. |
| `--pg-ink` | `#0F172A` (slate-900) | Primary text — headings, body. |
| `--pg-ink-muted` | `#64748B` (slate-500) | Secondary text — subtext, labels. |
| `--pg-ink-faint` | `#94A3B8` (slate-400) | Tertiary/meta text — footer, timestamps. **Not** slate-300: a real incident (PR #77-era, `PortalShell.tsx`'s footer comment) found slate-300 on `#FAFAF8` genuinely illegible in production ("a guest couldn't make out this text at all"). slate-400 is the empirically-confirmed legibility floor on this canvas — treat it as a hard minimum, not a starting point to fade further. |
| `--pg-border` | `#E2E8F0` (slate-200) | Card border, dividers. |
| `--pg-danger` / `--pg-danger-bg` / `--pg-danger-border` | `#DC2626` / `#FEF2F2` / `#FECACA` | Error banners — unchanged, already correct. |
| `--pg-success` | `#10B981` (emerald-500) | Matches `ConnectedIllustration`'s existing verified badge — reuse, don't introduce a second green. |

**Venue accent layer — `--pr-primary`/`--pr-accent`, unchanged names (already injected by `PortalRuntimeContext`'s `useEffect` into a scoped `<style>`), but a tightened contract:**

Used **only** for: primary CTA fill, active-tab text/pill, focus rings, progress-bar fill, small icon accents, illustration accent strokes. **Never** for: body text color, a background wash behind content that must stay legible, or a border relied on to carry meaning by itself (always pair with icon or text).

**New rule, closing a real gap:** today `PG_PRIMARY_BTN` hardcodes white text on `var(--pr-primary)`. A venue that picks a pale accent color (a light yellow, a pastel) gets the *identical* legibility failure PR #80 just fixed for backgrounds — just for button text instead of a photo. Fix it the same structural way: compute a guaranteed-contrast foreground alongside `--pr-primary` in the same `useEffect` that already writes it, using relative luminance (WCAG formula, no new dependency):

```ts
function accessibleForeground(hex: string): "#ffffff" | "#0F172A" {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // contrast of white (L=1) vs L, WCAG formula: (1+0.05)/(L+0.05)
  return (1.05) / (L + 0.05) >= 4.5 ? "#ffffff" : "#0F172A";
}
```
Write the result as `--pr-primary-foreground` alongside the existing two variables; `PG_PRIMARY_BTN` and the tab-pill's active state read it instead of a hardcoded `text-white`. This is the accent-color half of the same "legible against anything a venue provides" mandate the background-photo fix is the other half of — both should ship together, not just the one that already had a live incident.

### 3. The structural legibility system — the core mandate, solved once

This is the actual answer to "solve the background-photo problem structurally, not as a patch."

**Current mechanism (as of #80), stated precisely:** `PortalShell` renders the photo full-bleed, then a vertical scrim gradient that's **deliberately transparent through the middle** (`rgba(255,255,255,0.8)→0.4→0→0→0.65`), on the assumption that whatever sits in that transparent band supplies its own opaque backing. Two things now do: `BrandPanel` (desktop-only) and `GuestSignInCard`'s header block (all breakpoints) — each with its own independently-written `hasBackgroundImage && "rounded-3xl border border-white/60 bg-white/80 ... backdrop-blur-md"` conditional. The footer (`Terms · Ask staff`) still has **no opaque backing at all** — it relies on the scrim's `0.65` opacity at the very bottom edge, which is weaker protection than either fixed block gets, on the one piece of text sitting closest to the photo's own edge.

**v4 fix: invert who's responsible.** Instead of "the scrim is transparent in the middle, and each block opts in to covering itself," make the guarantee live in exactly one place, own it at the layout level, and give every child of that layout the guarantee for free:

- New `<GuestBackdrop>` component (owns exactly this, nothing else — see §6.5) renders, when `config.backgroundImageUrl` is set: the photo full-bleed as today, **then one continuous `--pg-surface` panel** (not per-block cards) that contains the *entire* content column — logo, heading, sign-in card, footer, and on desktop both the `BrandPanel` column and the sign-in column — as one visual object sitting on the photo, not text floating over a photo hoping each piece remembered its own backing.
  - Panel treatment: `bg-white/92 backdrop-blur-md`, `rounded-[28px]` (full-bleed to viewport edges below `sm:`, inset with rounded corners at `sm:`+), a hairline `border border-white/70` and the same soft shadow `BrandPanel` already uses (`0 8px 32px -12px rgba(15,23,42,0.25)`) so the panel reads as a distinct object via its own edge even in the pathological case of a photo whose luminance happens to be close to the panel's.
  - The top/bottom vignette scrim **stays**, underneath the panel, as defense-in-depth for the sliver of photo still visible around the panel's edges (so exposed edges don't go harsh under any lighting) — belt-and-suspenders, not either/or.
  - No `config.backgroundImageUrl`: unchanged from today — content sits directly on `--pg-canvas`, no panel, no scrim. Same conditional that exists today, just resolved once (in `<GuestBackdrop>`) instead of three times (`PortalShell`'s scrim, `BrandPanel`'s own check, `GuestSignInCard` header's own check).
- **Why this is structural and the current approach isn't:** any content anyone adds to `PortalShell`'s children next month — a new nudge card, a new campaign banner, a redesigned footer — inherits legibility automatically, because it's inside a layout-level guarantee, not because someone remembered to write a fourth `hasBackgroundImage &&` conditional. The bug class (busy/dark/light/high-contrast photo makes some *specific* piece of text unreadable) becomes structurally impossible to reintroduce by omission, which per-consumer opt-in can never claim.
- **Bonus, not the point but worth having:** this composition also reads better. "Full-bleed photo framing one deliberate content panel" is a considered editorial layout (poster/magazine convention); "text with a translucent smudge behind it, hoping it's enough" — which is what per-block backing panels look like once you have three of them at slightly different opacities — reads exactly as improvised as it is.

### 4. Typography

Keep `PG_FONT_STACK` exactly as-is (`-apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif`) — correct, already solves Hindi via Noto Sans Devanagari, correct reasoning about pre-auth network reachability. **The only change is extending it to 100% of `portal.*` screens** — remove `font-display` (Space Grotesk) from the 12 files listed in §1.2; every heading becomes weight/size/tracking on the same system stack, exactly the technique `GuestSignInCard`'s own `<h1>` already proves works (`text-[26px] font-bold tracking-tight leading-tight`, no separate font family needed).

Replace today's scattered per-screen sizes (`26px`, `2xl`, `42px`, `50px`, `4xl`, `lg`, `sm`, `xs`, `11px`, each hand-picked per file) with one numeric scale:

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `pg-display` | 42px/1.08 (50px/1.08 at `xl:`) | 700 | -0.02em | `BrandPanel` headline only |
| `pg-title` | 26px/1.15 | 700 | -0.015em | Primary screen heading (`GuestSignInCard`'s "Welcome to X", `/session`'s "You're connected") |
| `pg-subtitle` | 20px/1.25 | 700 | -0.01em | Secondary screen titles (`closed`/`expired`/`failure`/`offline` — currently `2xl`, inconsistent with the primary heading one tier up) |
| `pg-body` | 15px/1.5 | 400–500 | normal | Form labels, card copy |
| `pg-meta` | 13px/1.4 | 500–600 | normal | Countdown/usage labels, secondary links |
| `pg-micro` | 11px/1.4 | 500–600 | 0.02em | Footer, legal text — floor is `--pg-ink-faint`, never lighter (§2) |

OTP digits stay `tabular-nums` (already correct). High-contrast mode (`A11yMenu`'s `contrast-125 saturate-150` CSS filter) and large-text mode (`text-[17px]` base bump) both keep working unmodified — they're post-hoc filters/overrides on top of whatever tokens render, not a competing token set, so nothing above needs special-casing for them.

### 5. Motion budget — ratify the existing policy, close the two real gaps left in it

**Ratified, not re-litigated:** the lost `design-v3-unified-system-spec.md`'s Part 3 conclusion is correct and this document adopts it as the permanent policy for this surface, now actually committed to the repo instead of living in an orphaned commit: shadcn as the clean base; **zero Aceternity**; **no Magic UI component backed by `motion/react`** (CSS-only ports of the *idea* only); the reasoning is an engineering fact, not a taste call — every `portal.*` route shares one Rollup entry chunk, so a framer-motion import anywhere in it costs every guest on every route, including the ones who never see that component.

**Checked directly against `origin/main` today — the policy is not yet fully delivered:**

- ✅ Delivered by PR #77: `PortalShell.tsx`, `GuestSignInCard.tsx`, `portal.tsx`, `portal.index.tsx` are framer-motion-free. `pg-enter` (fade+rise), `pg-tab-pill` (sliding indicator), `pg-pulse-dot` (loading dots), `pg-blob-drift`/`pg-glow-1`/`pg-glow-2` (ambient backdrop, no-photo case only) are all correct, `prefers-reduced-motion`-guarded CSS-only implementations. **Keep all of these exactly as they are.**
- ❌ **`CampaignOverlay.tsx` still imports `framer-motion`** — reached from `/portal/session` (a real, high-traffic screen, not an edge case), never addressed by PR #77's scope. This is still costing every guest on every `portal.*` route the bundle weight PR #77's own commit message measured at ~121KB/~39KB gzipped for the shared chunk.
- ❌ **`portal.session.tsx`'s `ConnectedIllustration` still imports `framer-motion`** for its SVG draw-in (`pathLength`, opacity pulses) — PR #77 explicitly flagged this as "out of scope here (not one of the two flagged remnants)," a deliberate deferral, not an oversight. v4 should finish it: a one-time celebratory SVG animation, seen once, on one screen, doesn't justify a shared-chunk dependency paid by every guest on every route. Port to CSS `stroke-dasharray`/`stroke-dashoffset` (the same mechanism `pathLength` uses under the hood) — a new `pg-draw` utility, same `prefers-reduced-motion` guard as its siblings.

Closing both makes the "Zero framer-motion cost" line in the original budget table **actually true**, not true for 2 of 4 real usages. No other motion changes: still a 200ms ceiling on any OTP-adjacent transition, no parallax, no autoplay video, no new webfonts (now formally extended to all 17 screens per §4, not just the sign-in card).

### 6. Component structure — is the current shape right for v4?

**Verdict: the composition model is sound; keep it. What needs to change is where responsibilities sit, not the overall shape.** This isn't a from-empty rebuild of the component tree — per UX v4's own §0, the flow underneath has already earned its current form through real incidents, and the same is true of the shell/card/panel split visually. Concretely:

1. **Delete `PortalShell`'s "dark" variant, and the `variant` prop entirely.** Confirmed: all 17 `portal.*` routes pass `variant="light"`. This isn't a simplification opportunity to consider — it's dead code (a full second background/header/`PortalCard` implementation) that should not survive into v4. `PortalShell` becomes one visual language, no branch.
2. **Extract `<GuestBackdrop>`** from `PortalShell`'s current inline JSX — owns exactly the background-image + unified legibility panel from §3, nothing else. One file to open for "why isn't text legible here," instead of a conditional buried inside a ~300-line render function.
3. **`BrandPanel` stays** (the desktop context panel is good composition, not the problem) **but stops owning its own legibility treatment** — that moves to `<GuestBackdrop>` per §3, so `BrandPanel` goes back to being a pure content component with no `hasBackgroundImage` prop of its own to keep in sync.
4. **Split `GuestSignInCard.tsx`** into a `useGuestSignIn()` hook (all mutation/state-machine logic: OTP send/verify, password login, resend cooldown, tab selection — zero JSX) plus small presentational pieces (`<AuthTabSwitcher>`, `<OtpForm>`, `<PasswordForm>`). This is not scope creep on top of a visual pass — it's the direct prerequisite for two things UX v4 already asked for and that a visual reskin would otherwise have to route around: §6.5 (moving the profile prompt to `/portal/session`) and §6.8 (deduping the legacy `/portal/auth/$method`+`/portal/verify` forms onto the same building blocks). Doing the split now means the visual and interaction passes land on the same underlying file once, not twice.
5. **`<AuthTabSwitcher>` implements UX v4's §6.9 three-tier hierarchy explicitly**, since that section asked Visual v4 to make the call: tier 1 (OTP-vs-password pill, `pg-tab-pill`, unchanged mechanism) reads at full `pg-body` weight and `--pr-primary`-tinted active state; tier 2 (the new inline OTP-channel switcher from UX v4 §6.7, when 2+ OTP channels and no password) reads as small icon-tabs at `pg-meta` weight, visually subordinate to tier 1 and never sharing its pill treatment (so it never implies a false parity between "channel" and "method"); tier 3 (the collapsed `<details>` disclosure — voucher, non-primary channels when a pill already exists) stays exactly as-is, `pg-meta`/`--pg-ink-muted`, closed by default.
6. **`PortalGuestUi.tsx`'s shared primitives stay** (`AlertBanner`, `ConnectingOverlay`, `PortalConnectingState`, `PG_PRIMARY_BTN`, `PG_INPUT`) — correct, already the right abstraction level, just re-pointed at the new token names (§2) instead of the hardcoded hex/Tailwind-slate values they currently carry inline.

Net effect: same number of conceptual layers (shell → backdrop → panel/card → form), each with one clear owner instead of duplicated logic at 2–3 call sites.

### 7. Illustration & iconography

`lucide-react` stays for all inline icons — correct, zero cost, already the house style. Hand-authored flat-shape/thin-stroke SVG illustrations in the `ConnectedIllustration` mold are good and worth extending (e.g., a `/portal/closed` "opens again at X" illustration if UX v4 §6.6 ships) — same restrained palette (`--pg-ink`, one venue-accent stroke, `--pg-success` for a verified state), CSS-driven per §5, not framer-motion. No stock icon-in-gradient-badge treatment anywhere (already flattened per PR #77 in `portal.index.tsx`) — ratify as permanent, not just this pass's choice.

### 8. What changes vs. survives from PR #77 — explicit, so the FE engineer isn't re-deriving decisions

**Survives, unchanged:**
- The zero-Aceternity / zero-framer-motion-Magic-UI policy for this surface (§5) — decided, not open for re-litigation.
- `pg-enter`, `pg-tab-pill`, `pg-pulse-dot`, `pg-blob-drift`/`pg-glow-1`/`pg-glow-2` CSS utilities — correct as shipped.
- `PG_FONT_STACK`'s actual font list, `PG_PRIMARY_BTN`'s flat single-color fill, the thin-border/small-shadow `PortalCard` "light" recipe, `#FAFAF8` canvas.
- The route/flow shape and every non-negotiable invariant in UX v4 §5 — this document doesn't touch flow.
- The venue-accent-in-safe-places-only pattern (button fill, focus ring, tab active state) — kept, just tightened per §2.

**Changes:**
- `variant="dark"` and the `variant` prop deleted from `PortalShell`/`PortalCard` — confirmed dead, zero real usage.
- `font-display`/Space Grotesk removed from the 12 screens still using it; `PG_FONT_STACK` becomes the only font stack on every `portal.*` route, not just `GuestSignInCard`.
- Legibility backing consolidated from 2 independent per-consumer patches (`BrandPanel` Aug 5, `GuestSignInCard` header PR #80) into 1 structural guarantee in the new `<GuestBackdrop>` — the core ask of this brief (§3).
- CTA/tab-pill/focus-ring foreground color gets a computed-contrast fallback (`accessibleForeground()`, §2) instead of hardcoded white — same legibility mandate extended to venue-accent elements, not just backgrounds.
- `CampaignOverlay.tsx` and `portal.session.tsx`'s `ConnectedIllustration` both lose their `framer-motion` import (§5) — the last two real usages on this surface, closing what PR #77 explicitly deferred.
- `GuestSignInCard.tsx` decomposed per §6 — no visible change to a guest, real change to who owns what.
- Numeric type scale (§4) replaces today's ad hoc per-screen sizes.
- Hardcoded hex/Tailwind-slate values in `PortalGuestUi.tsx`'s shared primitives repointed at the named `--pg-*` tokens (§2) — same colors, one place to tune them going forward.

### 9. FE build brief — file-level checklist

1. `src/styles.css` — add `--pg-*` token block (§2) scoped to `.portal-runtime` (same selector `--pr-*` already uses); add `pg-draw` keyframe/utility (§5); remove nothing yet from the `aurora`/`master-theme` blocks (unrelated surfaces).
2. `src/context/PortalRuntimeContext.tsx` — add `accessibleForeground()` (§2) to the existing `useEffect` that writes `--pr-primary`/`--pr-accent`; write `--pr-primary-foreground` alongside them.
3. `src/components/portal-runtime/PortalShell.tsx` — delete the `variant="dark"` branch and the `variant` prop; extract `<GuestBackdrop>` (§3, §6.2) as a new file or a clearly-separated function within this one; `BrandPanel` drops its own `hasBackgroundImage` conditional (moves to `<GuestBackdrop>`).
4. `src/components/portal-runtime/GuestSignInCard.tsx` — extract `useGuestSignIn()` + `<AuthTabSwitcher>`/`<OtpForm>`/`<PasswordForm>` (§6.4); header block drops its own `hasBackgroundImage` conditional (same reason as #3); implements UX v4 §6.2 (terms checkbox placement) and, once the hook exists, is the natural landing spot for UX v4 §6.5's profile-prompt relocation.
5. `src/components/portal-runtime/CampaignOverlay.tsx` — remove `framer-motion`, port to CSS per §5.
6. `src/routes/portal.session.tsx` — `ConnectedIllustration`'s draw-in ports to `pg-draw` (§5); this file plus `closed/expired/failure/offline/redirect/team/verify/set-password/terms/auth.$method.tsx` all lose `font-display` (§4, §8).
7. `src/components/portal-runtime/PortalGuestUi.tsx` — repoint `AlertBanner`/`ConnectingOverlay`/`PortalConnectingState`/`PG_PRIMARY_BTN`/`PG_INPUT` at `--pg-*` tokens.
8. `src/lib/portal-i18n.ts` — no changes required by this section; any new copy UX v4 introduces (§6.1's retry copy, §6.6's reopen-time copy) still needs real translation keys per that section's own §2 constraint.

Every item above is additive-or-consolidating against what PR #77/#80 already shipped, not a reversal of it — the "restraint" verdict on this surface stands; this is where the restraint pass didn't yet finish, plus the one real structural fix (§3) the brief asked for.
