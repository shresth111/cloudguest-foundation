# Captive Portal v7 — Design Spec

**Status:** Complete. All eight parts are ready for engineering, subject to the three blocking prerequisites in §0.2–§0.4 and the three sign-off items at the end.
**Audience:** FE engineer, BE engineer, graphic designer, QA. Parts are self-contained; read Part 0 plus your own part.

## Why v7 exists

Three complaints from the founder, in his words: on a phone, whatever background a customer uploads **ruins the headline**; the **welcome message** should be visible; **"Powered by" should show properly**. Plus: loading still takes time, the design still isn't good enough, and add an accessibility button.

Every claim below was checked against the live code or a live source. Each carries a `file:line` or a URL. The handful that could not be verified are marked as such, and two places where an earlier audit of this same work was **wrong** are corrected explicitly in §9 — believe §9 over any earlier draft.

**The captive portal is the business.** That is the quality bar this spec is written to.

---

## Part 0 — Non-negotiables and blockers

### 0.1 Settled by v4/v5/v6. Do not re-litigate.

1. **Coverage area, not opacity, was the bug — and it has shipped twice.** v5 §2 records it: PR #80 fixed legibility per-element → PR #81 replaced that with one 92%-opaque wash over the whole column, **shipped, and reduced a real venue's photo to a ghost** → PR #82 reverted. Any proposal that widens what a single translucent panel covers is proposal #3 of a mistake already shipped twice.
2. **No filler subtext.** A venue with no welcome message shows no line at all (`useGuestSignIn.ts:100` returns `undefined`, not `""`). v5 §3.2.
3. The v5 sizing scale is settled: `rounded-[20px]`, `p-5`, 440px sign-in column, 48/56/64px logo. Fixed *heights* are revisited in Part 7 — see §7.3, they are an accessibility defect.
4. One merged sign-in card, not stacked header + form (v5 §3.1).
5. **Zero framer-motion on `portal.*`. No webfont that is not same-origin.** Independently corroborated by a captive-portal vendor's own field guide: *"Do not use Google Fonts"*, and do not link an external stylesheet — inline it.
6. Never invent guest-facing copy or a guest-facing control with no backing config field.

### 0.2 BLOCKER — verify the portal survives the iOS Captive Network Assistant

This outranks everything else in this spec. If it is real, it is why the portal "feels broken" in ways no amount of visual work will fix.

The iOS CNA is a stripped WebKit websheet, not Safari:

- `localStorage` / `sessionStorage` **throw** — it behaves like private browsing.
- Cookies are **destroyed** when the websheet closes.
- Detecting successful authorization requires a **full page navigation**. An AJAX/`fetch` state update does not close the websheet — the guest sits on a "connected" screen with no internet, forever.
- It is **not inspectable** in Web Inspector, and Apple Developer Support has confirmed the behaviour is deliberately undocumented for developers. You cannot debug this in the field.
- Practitioner reports also describe a ~128 KB cap on the *initial* HTML resource. *Folklore, not spec — but cheap to design around and expensive to discover in production.*

`PortalRuntimeContext` currently routes state through `sessionStorage`, and the portal is a client-routed TanStack application.

**Required before any v7 implementation starts:** trace the real sign-in flow end to end and answer, in writing, (a) does any step depend on Web Storage surviving, (b) does the final authorization complete via a full navigation or via `fetch`, and (c) does any internal step rely on client-side routing where the CNA needs a document load. Fix whatever that turns up **first**. Design every new step to work with **no persistent state at all**.

### 0.3 BLOCKER — fix PR #36 before it merges

`_config_from_cache_payload` indexes the cached payload unguarded for every name in `_CACHED_CONFIG_SCALAR_FIELDS` (`captive_portal/service.py:356-357`), and the cache-hit call site has no `try`/`except` (`service.py:717-719`). So the first request after a deploy that adds a cached field raises `KeyError` out of the **unauthenticated** `GET /captive-portal/resolve` — a 500 for every guest joining WiFi, for up to the 60 s TTL. Two independent audits found this.

**Fix:** version the cache key (`cache.py:42` → `captive_portal:resolve:v2:{organization_id}:{location_id}`), and bump `v<N>` whenever the cached field set changes. Chosen over `payload.get(name, default)` deliberately — a missing field should fail loudly in tests, not degrade silently in production. **v7 bumps it to `v3`.**

*(Applied and pushed to that branch as `65a2b48`, together with the migration docstring fix below.)*

### 0.4 BLOCKER — merge order

`origin/main` head migration is `0087_add_lead_qualification_fields_to_demo_requests`; PR #36 is `0088`.

| Order | v7 revision | v7 `down_revision` |
|---|---|---|
| **#36 first (required)** | `0089_…` | `0088_add_guest_font_choice_and_overlay_strength` |
| v7 first | ❌ two Alembic heads, `upgrade head` fails |

**Do not author a v7 migration numbered `0088`.** Merge #36 (BE) → #96 (FE) → v7. If v7 must proceed in parallel, branch it off `add-captive-portal-v6-branding-fields`, not `main` — the two otherwise conflict textually in `constants.py`, `exceptions.py`, `models.py`, `schemas.py`, `router.py`, `service.py`, `validators.py` and the captive-portal tests. v7 needs **one** migration.

### 0.5 Outside this spec, but probably the highest-leverage change available

Implement **RFC 8910** (DHCP option 114 / IPv6 RA advertisement) and **RFC 8908** (the JSON captive-portal state API) on the Wyfy gateway.

On Android 12+ with a current Mainline `CaptivePortalLogin` module (v361335020, Jan 2026), that is what makes the OS open the portal in **Custom Tabs — a real browser** — instead of the stripped WebView. AOSP's own documentation states the legacy WebView has no one-tap credential autofill and breaks on devices using a VPN or private DNS, while Custom Tabs restores full browser capability. India is **92.44% Android**.

This is a gateway/networking change, not a redesign change. It should be scoped separately and it may deliver more guest-visible improvement than all of Parts 1–8 combined.

### 0.6 Two branches to delete, not merge

- `feat/portal-powered-by-footer` — byte-identical to what merged as #84, and predates the entire v5 pass.
- `merge-fix/portal-charts-chunk-leak` — the recharts leak was fixed on main as #91; the only remaining diff deletes a doc file.

---

## Part 1 — Legibility

### 1.1 What is broken

**L1 — 10 of 12 portal routes render an unbacked `<h1>` and subtitle directly on the photo.** `portal.expired`, `.failure`, `.offline`, `.closed`, `.redirect`, `.set-password`, `.team`, `.verify`, `.session`, `.auth.$method`, `.terms`. Each sits in a bare `<div className="text-center">` **outside** `PortalCard`, landing in the scrim's fully-transparent 24–78% band. Over a dark photo, `--pg-ink` `#0F172A` has effectively zero contrast; over a busy photo no fixed ratio exists at all. Every breakpoint.

**L2 — the sign-in card dissolves on a bright photo.** Text-on-card is 17.85:1 and fine. But the card's only edge is `--pg-border` `#E2E8F0` (1.23:1 on white) plus a faint shadow. Against a bright photo — white lobby, overcast sky — white-card-on-bright-photo is **~1.14:1**. The boundary vanishes and the headline reads as floating text on a photo. **This is most likely what the founder is looking at.**

**L3 — the scrim can only lighten.** `GUEST_BACKDROP_SCRIM` is hardcoded `rgba(255,255,255,…)` (`PortalShell.tsx:132-133`). Over a bright photo it is a no-op. Protection exists in exactly one direction, and it is the wrong one for L2.

**L4 — `--pg-ink-faint` fails AA everywhere.** `#94A3B8` is 2.45:1 on canvas, 2.56:1 on white, **1.82:1** on the legibility card over a dark photo. It carries the **entire footer at 11px, including "Powered by Wyfy Guest"** — and, worse, it is the **placeholder** colour in `PG_INPUT`. See §7.2: placeholders are currently the *only* labelling on the primary sign-in fields.

**L5 — `--pg-ink-muted` `#64748B` is marginal.** 4.76:1 on white — which only passes at ≥16px, and it is used at `text-xs`/`text-sm`. Drops to **3.37:1** on the card over a dark photo. This is the token on the **welcome message**.

**L6 — the photo is cropped against document height, not viewport height.** The backdrop is `absolute inset-0` on a container that is `min-h-dvh` *and grows with content*. On a 390px phone where the OTP flow makes the document ~1200px tall, `bg-cover` scales a 1920×1080 photo to ~2133px wide and **crops ~82% of it off-screen**. The venue sees a random vertical sliver of their own building.

**L7 — therefore `background-position: center 25%` is a no-op on every portrait phone.** A percentage background-position only acts along the axis where the image overflows its box. With `cover` on a tall narrow box the overflow is horizontal, so the vertical `25%` has nothing to act against. v5 §3.4 introduced that value specifically for portrait venue photos on mobile; it has only ever worked on desktop.

### 1.2 The architecture: take the text off the photo

**Earlier drafts of this spec proposed making the scrim adapt to the photo. That was the wrong emphasis.** The state of the art — Auth0 with tenant-uploaded backgrounds, Apple's own Liquid Glass guidance that controls "sit on top of a system material, not directly on content" — converged on something simpler and provable: **the photo is a decorative stage; every word sits on an opaque surface.**

| Layer | Treatment |
|---|---|
| Background | Venue photo, `cover`, focal point from server-side analysis, **blur baked in server-side at upload** (not `backdrop-filter`), plus a base tint |
| Scrim | Eased multi-stop gradient over the tint, total alpha at any text zone **≥ 0.535** |
| Card | **Opaque.** All body copy and every interactive element lives here. |
| Headline | May sit on the scrim — but only as Large Text (≥24px, or ≥18.67px at 700) in pure `#FFFFFF` |
| Footer / "Powered by" | On the card, or on its own solid pill. Never on a gradient tail. |

### 1.3 The proof that makes this safe for an image we have never seen

Composite a black scrim at alpha α over the image. The worst possible underlying pixel is pure white. Solving the WCAG contrast formula for the α at which white text still clears each threshold:

| Text | Minimum α safe against **every possible image** |
|---|---|
| `#FFFFFF` body text, 4.5:1 | **0.535** |
| `#FFFFFF` large text (≥24px / ≥18.67px bold), 3:1 | **0.417** |
| `#FFFFFF` body text, AAA 7:1 | 0.651 |

This was computed independently and reproduces the only published derivation of it (CSS-Tricks, *"Nailing the Perfect Contrast Between Light Text and a Background Image"*, which binary-searches per image and reports the optimum "never exceeds 0.54").

**Three consequences, and the second one simplifies this project significantly:**

1. **A fixed α ≈ 0.55 black scrim is unconditionally AA-compliant for white body text over literally any image.**
2. **Therefore image analysis is not required for compliance — only for beauty.** You analyse luminance to use *less* scrim than the floor when the photo is already dark, so a nice photo is not needlessly muddied. Safety comes from the floor, not from the analysis. Earlier drafts had this backwards.
3. **Off-white text is expensive.** `#F7F5F2` needs α 0.558; `#EDEAE4` needs 0.584. Over imagery use pure `#FFFFFF`; save any warm off-white for the card.

Note the honest limit, stated by the same source: a mathematically compliant ratio can still read badly over a *busy* image, because glyph edges compete with image edges. That is what C2 below solves.

Useful convergence: PR #36's `background_overlay_strength` already defaults to **55**. The peak value was never the problem — the problems are that the scrim is white and that it is fully transparent exactly where the text sits.

### 1.4 The four changes

#### C1 — Crop the backdrop against the viewport, not the document
Give the photo layer its own viewport-height stacking context so `cover` resolves against the viewport box, not the grown document box. Fixes L6, restores L7, and is a prerequisite for C4. Verify on a page tall enough to scroll, not just first paint.

#### C2 — Pre-blur and pre-tint server-side at upload
One Pillow operation at upload (blur radius ~20–28px equivalent, plus a base tint at α ≥ 0.45) **collapses high-frequency content, hides low resolution, and makes portrait-into-landscape acceptable — three problems in one step, at zero cost to the guest's device.**

**Do not use `backdrop-filter` to achieve this look.** MDN states plainly it is computationally expensive; the browser must render, filter and composite the scene behind the element *every frame including every scroll frame*, with cost scaling by blur radius × element area — exactly wrong for a full-bleed layer on a 1080p Android. It also has a silent failure mode: any ancestor with `opacity < 1`, `filter`, `mask`, `clip-path` or `mix-blend-mode` becomes a backdrop root and confines the blur to nothing. And `prefers-reduced-transparency` is still not shipped in Firefox, so the user's own preference cannot be reliably honoured. Permitted only as an `@supports`-gated enhancement on the card, blur ≤ 12px, static, never animated.

#### C3 — Bidirectional scrim, plus an adaptive card edge
Store `background_luminance` and `background_top_luminance` (0–100), computed in the same upload pass. Use them to pick scrim **polarity** — dark scrim over a light photo, light scrim over a dark one — never to go below the §1.3 floor. `buildGuestBackdropScrim(strengthPct)` from PR #36 gains a polarity argument.

For L2, the card gains an **adaptive edge**: when `background_luminance` is high, a visible ring and stronger shadow; when low, today's treatment is already right.

**Size the scrim from the content box, not a fixed vignette height.** The current fixed top/bottom vignette is why text can sit in an unprotected band, and it breaks again as soon as text scales up under Part 7's relative units.

#### C4 — Per-venue focal point
`background_focal_x` / `background_focal_y` (`Integer NOT NULL`), defaulting to `50` / `25` so the render is identical to today's `center 25%` for every existing venue. Per-venue on `captive_portal_configs`, not org-level on `brandings` — the same shared org photo should crop differently per venue.

#### C5 — The refusal rule, for hostile uploads
Meta holds a patent on exactly this problem: compute a readability score for the image, and **if it is below threshold, render the text adjacent to the image rather than on it.** Adopt the same rule. If the computed worst-case luminance and an entropy ("busyness") measure exceed thresholds, **drop the headline onto the card too.** Automatic, graceful, no human in the loop, and it means there is no such thing as an upload that breaks the portal.

### 1.5 Token fixes and the QA gate

Darken `--pg-ink-faint` and `--pg-ink-muted` until each clears 4.5:1 against the **worst** real composite of its own zone, and re-derive every affected ratio rather than eyeballing it — the existing code comment calling `#94A3B8` an "empirically-confirmed legibility floor" is how the current failure survived. Retire `--pg-ink-faint` from the placeholder role entirely (§7.2).

**QA must know that automated tooling cannot verify this.** axe-core's `color-contrast` rule returns **`incomplete` — "background color cannot be determined"** for text over a `background-image`, and throws with impact "unknown" when a *parent* carries one. Lighthouse inherits the same blind spot. Verification must be pixel-based: render at 390×844, extract the text region, compute worst-pixel contrast, assert. There is no off-the-shelf package for this; it is roughly 40 lines.

---

## Part 2 — Welcome message

It renders correctly — `splashWelcomeMessage` → `useGuestSignIn.ts:100` → `GuestSignInCard.tsx:82-84`. Three real problems, none of them "it doesn't show":

**W1 — it fails contrast over a dark photo** (`--pg-ink-muted`, 3.37:1). Fixed by §1.5.

**W2 — a long message pushes the sign-in button below the fold.** On a 390×844 phone it starts around y≈255px, and each wrapped line pushes the tab pill, field, terms row and 48px CTA down. Three or four lines reliably buries the primary action on a 667px device. No validation exists anywhere in the chain. **Fix at the admin end** — a character limit with a live counter in the dashboard plus a matching backend validator. Truncating at render would hide copy the venue deliberately wrote; refusing it at authoring time tells them why.

**W3 — the admin preview can never show it.** `preview.portal.$locationId.tsx:210-211` hardcodes `splashHeadline: null, splashWelcomeMessage: null`, while `PortalPage.tsx:258-259`'s live-preview path wires them correctly. The two preview surfaces disagree and the one an admin uses to check their portal is the broken one.

---

## Part 3 — "Powered by Wyfy Guest"

Already shipped and rendering (`PortalShell.tsx:400`, i18n at `portal-i18n.ts:101`/`:259`, merged as #84). The complaint is not that it is missing — **it is illegible in every case**: 11px on `--pg-ink-faint`, giving 2.45:1 with no photo, 2.56:1 over a bright photo, **1.82:1** over a dark one.

**P1** — fixed by §1.5 plus C3 polarity. It gets a real surface, never a gradient tail.

**P2 — the footer row has no `flex-wrap` and no `min-w-0`** (`PortalShell.tsx:365`). Four items in a ~358px column, longer strings in Hindi, inside a `rounded-full` pill — the classic setup for a rounded background to break across lines. *Not visually confirmed. QA must check this specific case in Hindi at 360px before calling it fixed.*

**P3 — it is not a logotype exception.** WCAG exempts logotypes, but only as an image mark. Set as live text, "Powered by Wyfy Guest" must meet contrast like any other text. Do not lean on the exception.

**P4 — the toggle is a white-label entitlement.** Turning attribution off is `PlanFeatureKey.WHITE_LABEL` behaviour, but `captive_portal.update` is granted to roles holding no `white_label.*` at all. Add `powered_by_enabled: Boolean NOT NULL DEFAULT true` with a service-layer entitlement check in `update_config` firing **only** when the value is set to `false`, raising 402. Do **not** add `RequireFeature` as a router dependency — it would gate the whole `PUT`. Do **not** gate the read path: resolve is unauthenticated and a 402 there breaks the portal for any non-entitled tenant.

**P5 — keep it prominent, deliberately.** A named, consistent operator across venues is a **trust asset**. See §8.3: guests connect to public WiFi while actively believing it is unsafe, and a recognisable operator mark is reassurance, not chrome to be minimised.

---

## Part 4 — Backend image pipeline

Today there is **no image processing for backgrounds at all** — `branding/service.py:30-33` says so in its own comment. Content-type and a 5 MiB cap are validated; raw bytes are stored and served. That is why photos look soft: a heavily-compressed upload gets upscaled by `cover` to fill a phone.

Add `_process_background_image(content) -> tuple[bytes, str, str] | None`, mirroring `_process_logo`'s contract including its graceful "return `None`, store the original unchanged" fallback. Order matters:

1. **Decode**, reusing `_process_logo`'s hard-won `except` list — and add **`Image.DecompressionBombError`**, which it currently misses. **That is a live bug today, not a v7 one:** the class subclasses bare `Exception`, and the `4096` guard runs *after* `img.load()`, so a ~20000×20000 PNG well under 5 MiB **500s the logo upload right now**. Do not widen to bare `except Exception` — the enumerated list is what makes it auditable.
2. **Size guards** before any pixel work — per-edge ceiling *and* a total-pixel ceiling, since a 1×200000000 aspect passes a per-edge check. Set the background ceiling far above the logo's 4096: a 24MP phone photo is 6000×4000, and reusing 4096 would make the fallback fire on exactly the uploads that most need downscaling.
3. **`ImageOps.exif_transpose` — mandatory.** Browsers auto-rotate JPEGs by EXIF `Orientation`; Pillow does not, and re-encoding drops the tag. Without this, **every portrait phone photo comes out sideways after v7 ships** — a regression that does not exist today precisely because bytes are currently untouched.
4. **Compute `background_luminance`, `background_top_luminance`, and an entropy/busyness measure** for C3 and C5, while the image is decoded.
5. **Blur and tint** per C2.
6. **Downscale** to 2560px on the long edge (LANCZOS).
7. **Re-encode WebP** at q≈82. A 5 MiB GIF becomes ~90 KB.
8. **Reject below a hard resolution floor** (~1200px long edge) at upload, with the reason shown in the dashboard — never silently.

Hook in **after** the 5 MiB check: the cap must apply to ingress bytes, not post-compression bytes.

**WebP is safe.** `BACKGROUND_IMAGE_ALLOWED_CONTENT_TYPES` already contains `"image/webp": "webp"`, and the served content-type derives from the key's extension, so a `.webp` key serves correctly with **zero** changes to the serving path. The URL carries no extension, so nothing downstream can branch on format. Support is Safari 14 / iOS 14 and every Android WebView.

**Two traps:**
- **Do not simply delete `image/gif` from the allowlist.** `_EXTENSION_TO_CONTENT_TYPE` is *derived* from it, so removing GIF also removes it from the **serving** map — every stored `.gif` would start serving as `application/octet-stream` and stop rendering. Decouple the dicts first.
- An animated GIF flattens to frame 0. Correct for a background, but log it.

**Existing images:** no migration needed — the extension lives inside the `String(1024)` key. Write a one-off idempotent `scripts/backfill_background_images.py` with `--dry-run`, skipping keys already ending `.webp`, writing to a **new** key and leaving the old object so rollback is one `UPDATE`. **Do not** re-process lazily on read — that puts an object-storage write and a DB write on an unauthenticated guest path reachable by org-UUID enumeration.

**Existing tests keep passing** — `test_branding.py:193`'s `PNG_BYTES` is a magic header plus garbage that Pillow cannot decode, so every current background test takes the `return None` path and its `.png`/`.jpg` assertions hold. New happy-path tests must build a real image via `Image.new(...)`.

---

## Part 5 — Load speed

Bundle bytes are measured from a real production build; **network and CPU timings are modeled** — no browser trace was possible. Already fixed, do not redo: the recharts leak (#91), `ssr: false` removal, branding `Cache-Control`/ETag/304 (#34).

**S1 — the sign-in card is never server-rendered.** SSR is on, but config comes from a plain `useQuery` in a React context with **no route `loader`, no `ensureQueryData`, no dehydration** anywhere in the portal routes. The chain is: HTML spinner → 365 KB gz download → 1.22 MB parse → hydrate → cross-origin resolve → client redirect → card. Add a route loader resolving server-side so the card ships in the first HTML. Biggest structural win — **and it aligns with §0.2, since a server-rendered, full-navigation flow is also what the CNA requires.**

**S2 — 39 KB gz of framer-motion ships to every guest, for admin login pages.** `login.tsx`, `forgot-password.tsx` and `master-login.tsx` each export a named component *beside* `Route`, dragging the whole module and its imports into the entry chunk. Identical bug class to #91; three instances remain. The portal has zero framer-motion. Move the three components into non-route files under `src/components/`. Mechanical — do it first.

**S3 — no `preconnect` to the API origin**, which is cross-origin in production (`__root.tsx:108-113`). The guest pays cold DNS + TCP + TLS at the moment resolve fires, on a pre-auth walled-garden path. One line, ~200–400 ms.

**S4 — the image pipeline** (Part 4). A gallery photo is 1–5 MB; a correctly sized WebP for a 1170×2532 viewport is 80–150 KB. **10–40× overhead** on the venue's own uplink.

**S5 — cache-bust the asset URLs.** ETag and `Cache-Control` exist, but URLs are stable and not content-addressed, so a re-upload (or the Part 4 backfill) stays invisible for up to an hour. The stored key already contains a fresh `uuid4()` — append a token from it and serve `public, max-age=31536000, immutable`. Instant invalidation *and* a longer TTL.

**S6 — i18next plus the admin dashboard's locale bundles ship to the portal for nothing.** `__root.tsx` eagerly imports all 8 locale JSONs and runs `i18n.init()` at module scope; 420 Devanagari tokens sit in the entry chunk. The portal has its own dictionary in `portal-i18n.ts`. ~20–25 KB gz plus an init per boot.

**S7 — resolve does an uncached `SELECT brandings` even on cache hits**, whenever the config row has a null logo/background URL — which the code's own comment says is the common case. Fold the branding row into the cached payload.

**S8 — a busy café can 429 itself.** `/captive-portal/resolve` is rate-limited on `(client_ip, path)` at 60 req/60 s, and every device behind a venue's single NAT IP shares one bucket. Key it on something other than the shared egress IP.

**S9 — guest login blocks on a router TCP connect.** `_assign_guest_queue` opens a fresh connection to the venue's MikroTik, **awaited inline, 10 s timeout, no pooling**. Exception-swallowed — but a swallowed 10 s timeout still means the guest watches a spinner for 10 s. Move it off the request path. Also `resolve_effective_policy` is called 3× per login against the same table for the same key with no cache, and a 3-iteration quota loop issues one SELECT per period instead of one `IN (…)`.

**S10 — resolve cache robustness.** Unguarded `await` (§0.3), negative results never cached so a misconfigured location pays the full walk forever, no single-flight so each TTL expiry is a small stampede.

**Free wins on the wire:** the backend already returns `pin_login_enabled` and `location_country` on resolve, and `RuntimePortalConfig` picks up neither — so an admin can enable PIN login and the portal still won't offer it. (`portal-locale.ts:10`'s comment claiming there is no venue-country field is stale.)

**Inline the portal's CSS** rather than linking a stylesheet, per §0.1 item 5, and keep the initial document small (§0.2).

---

## Part 6 — Typography — **CLOSED**

### 6.1 Current state

The portal renders on a pure system stack (`PG_FONT_STACK`, `PortalShell.tsx:36-37`) with `"Noto Sans Devanagari"` in the chain. **PR #96 already builds the loading mechanism** — a curated 4-value allowlist, three same-origin `.woff2` at 9.9/11.3/8.8 KB, computed metric overrides, `font-display: optional`, and a `unicode-range` excluding Devanagari/Arabic so `hi`/`ar` headings fall back. Display/title/subtitle only; body, meta, micro and all interactive text stay on the system stack. **v7 must not rebuild this.**

Two defects: **the type scale has no mobile step** (`pg-title` is 26px at 320px and at 1279px alike, so a long venue name wraps to 3+ lines in a 358px column), and **`pg-shell` is applied as a class but has no CSS rule anywhere** — the font actually comes from an inline style, so v6's docs describe a selector that does not exist. Do not rebuild `PortalCustomization.tsx`'s 8-option "Font family" `<Select>`; it is fake — `fontFamily` is in neither the update whitelist nor the backend schema.

### 6.2 Recommendation: Hind 400/600 everywhere, Poppins 600 for headlines only

Both are **Indian Type Foundry**, both with Devanagari drawn in-house — Poppins' Devanagari is by Ninad Kale, Latin by Jonny Pinhorn, **1014 glyphs per font including all conjuncts** for Hindi/Marathi/Nepali. They are stylistically compatible in a way that Inter-plus-anything is not, and Poppins already carries the marketing site, so brand continuity is preserved while Hind fixes Poppins' real weakness (16px UI text).

**Measured byte sizes over the wire, per `unicode-range` slice:**

| Family | Deva 400 | Deva 600 | Latin 400 | Latin 600 | Both scripts, 2 weights |
|---|---|---|---|---|---|
| **Hind** | 38,072 | 37,384 | 8,632 | 8,728 | **~92.8 KB** |
| **Poppins** | 39,384 | 39,504 | 7,992 | 7,900 | ~94.8 KB |
| Mukta | 66,652 | 61,928 | 13,888 | 13,500 | ~156 KB |
| Anek Devanagari (VF) | **257,340** | — | 45,388 | — | ~303 KB |

**~140 KB for all three faces across both scripts — and ~25 KB for an English-only guest**, because Google Fonts ships Devanagari as a **single atomic `unicode-range` slice** that the browser only fetches when a Devanagari codepoint is actually painted. Anek is the best-designed family of the set and is rejected purely on that 257 KB.

**Rules:**
- **Ship static instances, not variable fonts** — variable-font support in the CNA and older Android WebViews is unverifiable, and at three weights you save nothing.
- **Self-host from the portal origin**, per §0.1 item 5. Pre-auth, the gateway may not even resolve `fonts.gstatic.com`.
- Subset the fixed Hindi UI strings you control with `pyftsubset --text`; venue names fall back to the full Devanagari subset, loaded only when a Devanagari name is present.
- **Always keep a system fallback stack** that renders acceptably if the font request is blocked by the gateway.
- **Devanagari needs more line-height than Latin** — it hangs from the *shirorekha* with matras stacking above *and* below, so its vertical envelope is taller at the same font-size, and alignment is organised around the head-stroke rather than a baseline. Set roughly +0.15 line-height via `:lang(hi)`, and consider a 2–4% size bump so letterform heights match optically.
- **Add the missing mobile step to the scale**, and see §7.3 — sizes move to relative units, so the scale must be authored in those units.

---

## Part 7 — Accessibility — **CLOSED. Delete the current control.**

### 7.1 The existing accessibility button is net negative, and this is a correctness argument

**"High contrast" measurably *reduces* contrast on the portal's most important text.** `PortalShell.tsx:297` applies `contrast-125 saturate-150` as a CSS filter on the root. Running the Filter Effects transforms and the WCAG luminance formula over the real tokens, `--pg-ink-faint #94A3B8` on white goes **2.56:1 → 2.30:1**. That token is the placeholder colour in `PG_INPUT` — and per §7.2 the placeholder is the *only* visible labelling on the primary sign-in fields. So the accessibility button degrades the legibility of the only labels on the only form that matters. It fails 4.5:1 in both states.

**"Large text" is inert** — `largeText && "text-[17px]"` on the root cannot cascade into `pg-title`/`pg-body`/`pg-micro`, `text-sm`, `text-xs` or `h-[48px]`, all absolute.

A control that lies about what it does is worse than no control.

**Do not ship a floating accessibility widget.** The evidence is unusually strong:

| Fact | Value |
|---|---|
| Overlay Fact Sheet signatories | **1,029** — including contributors to the WCAG, ARIA and HTML specs, accessibility staff at Google/Microsoft/Apple/BBC/Shopify, contributors to JAWS and NVDA |
| WebAIM practitioner survey | **67%** rate overlays "not at all / not very effective"; **72%** among respondents *with disabilities*; 2.4% rate them very effective |
| US digital accessibility lawsuits, H1 2025 | **2,019** total — of which **659 (32.6%)** were against companies **already running a widget** |
| UsableNet, full-year 2025 | "no meaningful reduction in lawsuits against widget users… widgets do not materially reduce legal risk" |
| FTC v. accessiBe (Jan 2025) | **$1,000,000**, 5-0 vote, over claims its widget could make any site WCAG-compliant |

The fact sheet's core argument applies directly: the features such widgets offer are ones "the end users these features claim to serve will already have on their computer," making the widget "at best redundant."

The founder's instinct was right and the artifact is wrong. The instinct is *"a guest with low vision must be able to get online here."* That is delivered by remediation, not by a button.

### 7.2 The failure nobody caught: the sign-in fields have no labels

`AuthFields.tsx`'s phone/email/country-code inputs have **no `<label>`, no `aria-label`** — only a placeholder. The OTP input renders a visually-transparent `<input>` with **no accessible name**. No field carries `autocomplete`.

This fails **1.3.1**, **1.3.5**, **3.3.2** and **4.1.2**. Concretely: a blind guest reaches an unnamed text field and **cannot complete sign-in at all.** That is total task failure, not degraded comfort, and it is the highest-impact fix in this entire spec per hour of work.

**Also newly in scope and missed by every earlier audit: 3.3.8 Accessible Authentication (Minimum), Level AA.** An OTP portal is an authentication flow, and W3C is explicit that requiring manual transcription of a verification code is non-compliant — the user must at minimum be able to paste it and let the user agent autofill. It currently passes **by accident**, because the `input-otp` dependency defaults `autoComplete` to `"one-time-code"` and implements a real paste handler. That is a fragile place for an AA obligation to live: set `autoComplete="one-time-code"` explicitly at the `OtpCodeInput` call site and add a regression test, or a future hand-rolled replacement silently breaks conformance on the critical path.

### 7.3 The px-lock breaks differently on each platform

- **iPhone / CNA:** iOS Safari does **not** apply Dynamic Type to web text sized in px or rem unless the page opts in with `font: -apple-system-body` on the root. A guest at 235% Larger Text gets **nothing**. Silent 1.4.4 failure.
- **Android WebView:** it **does** apply the system font scale via `textZoom`, and it scales px text too. So text grows **inside `h-[48px]` fixed-height inputs and buttons** and clips. Visible 1.4.4 + 1.4.10 + 1.4.12 failure.

Same root cause, opposite symptom — and only the Android one generates support tickets, which is why it has probably never been filed as an accessibility bug.

Fix: root typography on relative units plus `@supports (font: -apple-system-body) { :root { font: -apple-system-body; font-family: <brand>; } }`, and replace `h-[48px]` with `min-height` + padding so text zoom expands rather than clips.

### 7.4 What ships, in priority order

1. **Delete `contrast-125 saturate-150` and `text-[17px]`; remove the A11yMenu trigger.** Subtraction, and a strict improvement on day one.
2. **Real `<Label htmlFor>` on every primary-path input; accessible name on the OTP input; `autocomplete` on all fields; explicit `autoComplete="one-time-code"`.** (§7.2)
3. **Relative units + Dynamic Type opt-in + `min-height` instead of fixed heights.** (§7.3)
4. **Token contrast pass so the *default* palette passes 4.5:1**, and retire `--pg-ink-faint` from the placeholder role — a placeholder is not a label.
5. **`env(safe-area-inset-*)` on the shell padding.** `viewport-fit=cover` is already set with zero safe-area handling anywhere in `src/`, so on a notched iPhone the footer `Terms` link — a legal-consent control — sits under the home indicator where swipe-up intercepts it. Also a 2.4.11 risk.
6. **`@media (prefers-contrast: more)` and `@media (forced-colors: active)` token blocks.** The reduced-motion handling already in `styles.css` (11 sites) is the right shape — copy it.
7. **Only then, a control** — and a much smaller one.

### 7.5 If a control ships, exactly what it is

- **One thing only: text size.** A three-step segmented control (Default / Large / Largest) mapping to a root scale factor, **seeded from the OS**. No contrast toggle — after items 4 and 6 the default palette is compliant and the OS preference is honoured, so a contrast control could only make things worse. No dyslexia font, no reading guide, no cursor size, no screen-reader mode.
- **Inline, in normal flow, above the form.** Not floating, not fixed, not a Radix `DropdownMenu` — a portalled focus-trapping dropdown is precisely what degrades in the CNA's constrained JS, and a floating element over a page with no safe-area insets is a 2.4.11 hazard. Use `<fieldset>` + three `<input type="radio">` with real `<label>`s: zero JS, 44px targets by construction, announced correctly, and RTL-safe.
- **Three-state, OS-seeded, override-not-replace:** `system` (default) | `on` | `off`. CSS does the work unconditionally; the control's initial rendered state **reflects** the OS, so it never shows "off" while the page is honouring `prefers-contrast: more`. An explicit choice outranks the OS for this page only, via a root data attribute ordered after the media query. Escalation only — an explicit "off" returns to the OS baseline, never below it.
- **Never implement it as a CSS `filter`.** Re-declare the tokens instead. A filter is blind to tokens, blind to `forced-colors`, cannot distinguish text from photo, establishes a containing block for `position: fixed` descendants, and forces a full-page composite over a photographic background on low-end Android.
- **Persistence:** OS-seeding means the correct state needs **no storage at all** for guests who have configured their device. Layer on a `?ts=lg` URL parameter propagated across the portal's internal navigations — which survives the full-page redirects §0.2 requires and needs no storage API — plus a `try`/`catch` `sessionStorage` write as best-effort that is never read without a fallback. Never a cookie synced across venues.
- **Composition with C3:** keep them orthogonal. The server-computed luminance picks scrim **polarity**; the size control changes **metrics only** and must never touch colour. Because the scrim is sized from the content box (C3), scaling text up scales the protected region with it. Under `prefers-contrast: more` or `forced-colors: active`, **drop the photo and scrim entirely** for a flat token background — do not try to compute a "more contrasty scrim."

### 7.6 How to describe this to a customer

Not "we added an accessibility button" but **"the portal now obeys your phone's own accessibility settings."** It is a better line for a hotel sales deck, and unlike the button, it is true.

---

## Part 8 — Sign-in flow, OTP input, and trust

### 8.1 Use one OTP input, not six boxes

GOV.UK's Design System is explicit: when asking users to enter a code they are unlikely to have memorised — "an application reference ID, account number or security code" — **allow them to enter it in a single box.**

Six segmented boxes look modern and are a liability: they break paste, they break `autocomplete="one-time-code"` autofill in webviews, they fragment the accessible name (§7.2), and each box is a separate focus-management bug — in a browser you cannot debug (§0.2), that is exactly the JS-heavy focus choreography that fails silently in a hotel lobby at 11pm.

For the segmented *look*, render a single `<input>` with `letter-spacing` and a repeating dash background. One input, six-box aesthetic, zero JS.

```html
<input type="text" inputmode="numeric" pattern="[0-9]*"
       autocomplete="one-time-code" maxlength="6"
       style="font-size:18px; letter-spacing:.5em">
```

`autocomplete="one-time-code"` needs the SMS to contain the word "code". There is a known reproducible iOS WebView bug where the first autofill succeeds and later attempts offer "Passwords" instead. **Design for autofill never firing; treat it as a bonus.**

Phone entry: `type="tel"` + `inputmode="numeric"`, `+91` as a fixed non-editable prefix (not a country dropdown — this is one country), `maxlength="10"`, and strip spaces, dashes, a leading zero and a pasted `+91` server-side.

### 8.2 Flow and platform rules

- **Every input ≥ 16px font-size**, or iOS auto-zooms and destroys the layout.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` is mandatory — without it iOS renders at 980px and scales down. Note the portal route and `__root.tsx` currently set different viewport metas; the route should win by name-dedup, *but this was not verified at runtime.*
- **Two screens, not one.** Phone → "Get code", then OTP → connected. Each a real page with a real POST. Given §0.2 this is not a style preference — full navigation is how the CNA learns it can close.
- **Authentication must end in a full HTTP redirect, not a JS state update.**
- **Motion: almost none.** No View Transitions (unsupported in these environments), no scroll-driven animation, no `backdrop-filter` transitions. A 150ms card fade and a button press state. Honour `prefers-reduced-motion` (already done at 11 sites).
- **Scale contrast does the premium work.** Headline 28–32px/600, body 16px/400, one full-width primary button. Restraint reads as expensive; heavy glass and gradients read as cheap — and, per §8.3, as suspicious.
- **Show progress honestly** — "Step 1 of 2."
- **Marketing opt-in must be a separate, unchecked-by-default checkbox**, distinct from the T&C acceptance required to connect.

### 8.3 Trust is the actual design problem

Forbes Advisor / OnePoll, n=1,000 public-WiFi users, fielded Oct 2023, MoE ±3.1: **41% had had information compromised** on public WiFi. A companion survey of 2,000 regular users found **43% compromised**, and — the number that matters — **only 23% believe public WiFi is safe, while 51% connect more than five times a month.**

**Guests connect while believing it is unsafe.** They are primed to read anything odd — a stretched logo, a mismatched font, an unexplained data request, unreadable text over a photo — as evidence of a scam. That reframes the founder's complaint: **an illegible headline is not a polish problem, it is a trust problem**, and confirming "you are on *this venue's* network" is the strongest anti-evil-twin signal available. Hence:

1. **Say the venue's name, correctly and prominently.** Legibility here is a security signal.
2. **Explain why the phone number is needed, in one plain sentence, next to the field.** A stated reason converts far better than a bare field.
3. **Ask for nothing you don't need.** No email if you have the phone. No birthday, no full name.
4. **Look institutional, not clever.** Restraint reads as legitimate.
5. **Show the Wyfy mark clearly** (§3, P5).

**Deliberately not used in this spec:** every captive-portal conversion statistic found in research was vendor marketing with no published methodology, sample definition or audit — including widely-repeated claims about per-field drop-off and load-time conversion lift. No independent or academic measurement of captive-portal completion rates was located. The directional claim (fewer fields and faster loads convert better) is consistent with the independent form-friction literature and is safe as a *principle*; the percentages are not quotable. **Build server-side funnel telemetry in v7** — since the CNA has no storage, it must be server-side — and within a month you will have better data than any vendor publishes.

### 8.4 Legal — open, needs counsel

India's **DPDP Act 2023** imposes a free/specific/informed consent standard relevant to the marketing opt-in and to guest-data retention, and TRAI/DoT rules govern public-WiFi user identification. **The current status of the DPDP Rules and of DoT identity requirements as of August 2026 was not verified** and is not a question research can settle. Route to counsel before shipping any change to what data is collected or how consent is captured.

---

## Part 9 — Corrections to earlier audits

Believe this section over any earlier draft of this spec or any audit summary.

1. **WCAG 2.2 target size is 24×24 CSS px at AA, not 44×44.** SC 2.5.8 Target Size (Minimum) is AA at **24px**; 44×44 is SC 2.5.5 Target Size (Enhanced), which is **AAA**, and Apple's HIG. Consequences: the 36×36 language and a11y triggers **pass** AA (they fail AAA/HIG — fix as usability, not conformance); the 16×16 checkbox glyph inside a wrapping `<label>` **likely passes**, because the target is the whole label; the footer `Terms` link is **exempt** under 2.5.8's inline exception. **The only genuine AA target-size failure is the standalone tier-3 "more options" links** at ~18px. An earlier audit called all of these AA failures. Precision matters here — an inflated fix list loses credibility.
2. **SC 2.4.13 Focus Appearance is AAA, not AA.** The AA obligation for focus contrast is 1.4.11 Non-text Contrast, from WCAG 2.1. Separately, the current `focus-visible:ring-…/15` computes to **1.21:1** against white and is decorative only; the real indicator is the 1px border change at **3.62:1**, which passes — on a 1px stroke.
3. **SC 4.1.1 Parsing was removed in WCAG 2.2.** Do not cite it.
4. **`--pg-ink-muted` #64748B at 4.76:1 passes only at ≥16px**, and it is used at `text-xs`/`text-sm`. Treat it as failing wherever it is used below 16px, not as a marginal pass.
5. **The Alembic chain has a single head at `0088`.** An early automated check reported two heads; that was a parsing error — `0061` writes `down_revision: str | None = …`, which a naive regex misses. There is no fork.
6. **`feat/portal-powered-by-footer` is not pending work**, and neither is `merge-fix/portal-charts-chunk-leak`. Both are already-merged or superseded (§0.6).

---

## Open items needing founder sign-off

1. **A character limit on the welcome message** (W2). A restriction on what a customer may write; the alternative is letting a long message bury the sign-in button.
2. **Whether "Powered by" becomes switchable at all** (P4). Only worth building if white-label customers are meant to remove attribution — and note §8.3/P5 argue for keeping it visible.
3. **Deleting the existing accessibility button** (§7.1). This removes a visible feature. The recommendation is to delete it because it measurably harms the legibility of the only labels on the sign-in form, and to replace it with "the portal obeys your phone's accessibility settings." That is a product decision, not an engineering one.

## Explicitly out of scope

Video backgrounds; rebuilding the fake font-family selector; an admin UI for picking the background focal point (the field ships with a sensible default, the picker is separate work); and the RFC 8908/8910 gateway work in §0.5, which should be scoped as its own project.
