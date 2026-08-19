# Captive Portal v7 — Design Spec

**Status:** Draft. Parts 1–5 are ready for engineering. Parts 6–7 are **OPEN** pending external research that was cut short by an API quota limit — do not start those two.
**Audience:** FE engineer, BE engineer, graphic designer, QA. Parts are self-contained; read Part 0 plus your own part.

## Why v7 exists

Three complaints from the founder, in his words: on a phone, whatever background a customer uploads **ruins the headline**; the **welcome message** should be visible; **"Powered by" should show properly**. Plus: loading still takes time, and the design still isn't good enough.

All three were investigated against the live code before this spec was written. All three are real, and each has a different root cause. Nothing below is designed from an assumption about what the code "probably" does — every claim carries a `file:line`, and the few things that could not be verified are marked as such.

**The captive portal is the business.** That is the quality bar this spec is written to.

---

## Part 0 — Non-negotiables

### 0.1 Settled by v4/v5/v6. Do not re-litigate.

1. **Coverage area, not opacity, was the bug — and it has shipped twice.** v5 §2 records the round trip: PR #80 fixed legibility per-element → PR #81 replaced it with one 92%-opaque wash over the whole column, **shipped, and reduced a real venue's photo to a ghost** → PR #82 reverted. Any v7 proposal that widens what a single panel covers is proposal #3 of a mistake already shipped twice. **v7 solves legibility by making treatment adaptive to the photo, never by covering more of it.**
2. The scrim's transparent 24%–78% band is permanently non-configurable (v6 §4.3, and the clamp inside `buildGuestBackdropScrim`).
3. **No filler subtext.** A venue with no welcome message configured shows no line at all (`useGuestSignIn.ts:100` returns `undefined`, not `""`). v5 §3.2.
4. The v5 sizing scale is settled: `rounded-[20px]`, `p-5`, `h-[48px]`, `min-h-[46px]`, 440px sign-in column, 48/56/64px logo.
5. One merged sign-in card, not stacked header + form (v5 §3.1).
6. **Zero framer-motion on `portal.*`. No webfont that is not same-origin.** A guest often cannot reach `fonts.googleapis.com` before authenticating.
7. Never invent guest-facing copy or a guest-facing control with no backing config field.

### 0.2 Prerequisite — fix PR #36 before it merges

`_config_from_cache_payload` indexes the cache payload unguarded for every name in `_CACHED_CONFIG_SCALAR_FIELDS` (`captive_portal/service.py:356-357`), and the cache-hit call site has no `try`/`except` (`service.py:717-719`).

The moment a deploy adds a field to that list, **every Redis payload written by the previous build raises `KeyError` out of the unauthenticated `GET /captive-portal/resolve`** — a 500 for every guest joining WiFi, for up to the 60 s TTL.

PR #36 adds two such fields. v7 adds more. Two independent audits found this.

**Required fix, in #36, before merge:** version the cache key — `_CACHE_KEY_TEMPLATE` (`cache.py:42`) becomes `"captive_portal:resolve:v2:{organization_id}:{location_id}"`. Bump the version whenever the cached field set changes. Self-invalidating, no silent defaults, no deploy-order choreography. **v7 bumps it to `v3`.**

While in there: #36's migration docstring still reads `Revision ID: 0087…` / `Revises: 0086…` after its rechain, while the actual variables say `0088` / `0087_add_lead_qualification_…`. Alembic reads the variables so runtime is correct, but this is exactly how the next rechain gets botched. Fix the docstring.

### 0.3 Merge order — not negotiable

`origin/main` head migration is `0087_add_lead_qualification_fields_to_demo_requests`. PR #36 is `0088`.

| Order | v7 revision | v7 `down_revision` |
|---|---|---|
| **#36 first (required)** | `0089_…` | `0088_add_guest_font_choice_and_overlay_strength` |
| v7 first | ❌ collision — two Alembic heads, `upgrade head` fails |

**Do not author a v7 migration numbered `0088`.** Merge #36 (BE) first, then #96 (FE), then v7. If v7 must be developed in parallel, **branch it off `origin/add-captive-portal-v6-branding-fields`, not off `main`** — the two branches otherwise conflict textually in `constants.py`, `exceptions.py`, `models.py`, `schemas.py`, `router.py`, `service.py`, `validators.py` and the captive-portal tests, since both append to the same tails.

v7 needs **one** migration, not several.

### 0.4 Two branches to delete, not merge

- `feat/portal-powered-by-footer` — its diff is byte-identical to what already merged as #84, and it predates the entire v5 pass.
- `merge-fix/portal-charts-chunk-leak` — the recharts leak was fixed on main as #91; the branch's only remaining diff is deleting a doc file.

---

## Part 1 — Legibility (the core of v7)

### 1.1 What is actually broken

**L1 — 10 of 12 portal routes render an unbacked `<h1>` and subtitle directly on the photo.** `portal.expired`, `.failure`, `.offline`, `.closed`, `.redirect`, `.set-password`, `.team`, `.verify`, `.session`, `.auth.$method`, `.terms`. Each sits in a bare `<div className="text-center">` **outside** `PortalCard`, inside a `justify-center` column — landing squarely in the scrim's fully-transparent 24–78% band. Over a dark photo, `--pg-ink` `#0F172A` has effectively zero contrast. Over a busy photo, no fixed ratio exists at all. Every breakpoint; these routes never get `BrandPanel` either.

**L2 — the sign-in card dissolves on a bright photo.** Text-on-card is 17.85:1 and fine. But the card's only edge is `--pg-border` `#E2E8F0` (1.23:1 on white) plus a faint shadow. Against a bright photo — white lobby, overcast sky, snow — white-card-on-bright-photo is **~1.14:1**. The boundary vanishes and the headline reads as floating text on a photo. **This is the most likely thing the founder is looking at.**

**L3 — the scrim can only lighten.** `GUEST_BACKDROP_SCRIM` is `rgba(255,255,255,…)`, hardcoded (`PortalShell.tsx:132-133`). On a bright photo it is a no-op — white over white. Protection exists in exactly one direction, and it is the wrong one for L2.

**L4 — `--pg-ink-faint` fails WCAG AA everywhere.** `#94A3B8` is 2.45:1 on canvas, 2.56:1 on white, and **1.82:1** on the legibility card over a dark photo. AA needs 4.5:1. It carries the **entire footer at 11px — including "Powered by Wyfy Guest"**. The token's own code comment calls it an "empirically-confirmed legibility floor"; that claim does not survive computation.

**L5 — `--pg-ink-muted` `#64748B` is marginal.** 4.76:1 on white, but **3.37:1** on the card over a dark photo. This is the token on the **welcome message** and on `BrandPanel` body copy.

**L6 — the photo is cropped against document height, not viewport height.** The backdrop is `absolute inset-0` on a container that is `min-h-dvh` *and grows with content*. On a 390px phone where the OTP flow makes the document ~1200px tall, `bg-cover` scales a 1920×1080 photo to ~2133px wide and **crops ~82% of it off-screen**. The venue sees a random vertical sliver of their own building.

**L7 — and therefore `background-position: center 25%` is a no-op on every portrait phone.** A percentage background-position only acts along the axis where the image overflows its box. With `cover` on a tall narrow box the overflow is horizontal, so the vertical `25%` has nothing to act against. v5 §3.4 introduced that value specifically for portrait venue photos on mobile; it has only ever worked on desktop.

### 1.2 The v7 approach

Four changes. None of them widens a panel.

#### C1 — Crop the backdrop against the viewport, not the document

Give the photo layer its own viewport-height stacking context (`fixed` positioning, or a `100dvh`-pinned layer behind the scrolling column) so `bg-cover` resolves against the viewport box instead of the grown document box.

This alone fixes L6, restores L7, and makes the venue's photo actually look like their venue. It is also a prerequisite for the focal point in C4 — a stored focal point is meaningless while the vertical axis has no overflow to position against.

Verify on a page tall enough to scroll (the OTP + terms + more-options state), not just the first paint.

#### C2 — Make the scrim bidirectional, driven by a value computed at upload

The scrim cannot adapt to the photo because nothing knows what the photo looks like. Client-side luminance sampling is the obvious answer and the wrong one here: it needs canvas pixel access on a cross-origin-ish proxied asset, costs main-thread time on exactly the mid-range Android we are trying to speed up, and is unreliable in a restricted captive-portal webview.

**Compute it on the backend instead, at upload, where the image is already being decoded** (Part 4 adds a Pillow pass regardless — this is nearly free):

- `background_luminance: int` (0–100) — mean relative luminance of the whole image.
- `background_top_luminance: int` (0–100) — mean of the top 25% band, which is where the heading and the language/a11y row sit.

Store both, return both on resolve, and let the frontend pick **scrim polarity**: a light photo gets a dark scrim, a dark photo gets the current white one. `buildGuestBackdropScrim(strengthPct)` from PR #36 gains a polarity argument; its 24%/78% stops stay non-configurable per §0.1.

Two stored integers, no client-side image work, works identically in a stripped webview, and it is the mechanism that makes "any background the customer uploads" a solvable problem rather than a per-venue tuning exercise.

#### C3 — Every text zone gets its own bounded surface

Extend the existing, already-accepted per-zone pattern to the 10 routes in L1. `GUEST_LEGIBILITY_CARD_CLASS` exists and is already used by `BrandPanel` and the footer; the state routes simply never adopted it.

This is **not** the PR #81 mistake. #81 wrapped one panel around the entire column including the photo's hero band. This gives each heading block its own bounded plate sized to its own text, which is precisely what PR #82 restored as the correct pattern.

Additionally, the sign-in card needs an **adaptive edge** for L2: when `background_luminance` is high, the card gains a visible ring (a darker border and a stronger shadow); when low, today's treatment is already correct.

#### C4 — Per-venue focal point

Add `background_focal_x` / `background_focal_y` (`Integer`, `NOT NULL`), defaulting to `50` / `25` so the rendered result is byte-identical to today's `center 25%` for every existing venue. v5 §3.4 flagged this as a real follow-up and explicitly deferred it *because no backing field existed*. C1 makes it functional; this adds the field.

Per-venue on `captive_portal_configs`, not org-level on `brandings` — the same shared org photo should crop differently for different venues, which is the whole point.

### 1.3 Token fixes (L4, L5)

Both are contrast failures on tokens that carry the two things the founder specifically asked to be visible. Darken `--pg-ink-faint` until it clears 4.5:1 against the worst real composite (the legibility card over a dark photo), and `--pg-ink-muted` likewise. Re-derive every affected ratio after the change rather than eyeballing it — the existing "empirically-confirmed floor" comment is how the current failure survived.

**QA gate:** no guest-facing text may fall below 4.5:1 (or 3:1 for ≥24px) against the *worst-case* composite of its own zone, tested over a pure-white photo, a pure-black photo, and a high-detail photo.

---

## Part 2 — Welcome message

It renders correctly today — `splashWelcomeMessage` → `useGuestSignIn.ts:100` → `GuestSignInCard.tsx:82-84` — with no length gate, no feature flag, no breakpoint condition. Three real problems, none of them "it doesn't show":

**W1 — it fails contrast over a dark photo.** It uses `--pg-ink-muted`, which drops to 3.37:1 on the card over a dark photo. Fixed by §1.3.

**W2 — a long message pushes the sign-in button below the fold.** On a 390×844 phone the message starts around y≈255px; every wrapped line pushes the tab pill, the field, the terms row and the 48px CTA further down. Three or four lines reliably buries the primary action on a 667px device. There is no validation anywhere in the chain.

Fix at the **admin** end, not by truncating the guest's view: a character limit with a live counter on the customer dashboard, and a matching backend validator. Truncating at render would hide copy the venue deliberately wrote; refusing to accept it at authoring time tells them why.

**W3 — the admin preview can never show it.** `preview.portal.$locationId.tsx:210-211` hardcodes `splashHeadline: null, splashWelcomeMessage: null`, while `PortalPage.tsx:258-259`'s live-preview path wires them correctly. **The two preview surfaces disagree**, and the one an admin uses to check their own portal is the broken one. Wire it through.

---

## Part 3 — "Powered by Wyfy Guest"

Already shipped and rendering (`PortalShell.tsx:400`, strings at `portal-i18n.ts:101` / `:259`, merged as #84). The complaint is not that it is missing — it is that **it is not legible, in every single case**: 11px on `--pg-ink-faint`, giving 2.45:1 with no photo, 2.56:1 over a bright photo, **1.82:1** over a dark one.

**P1** — fixed by the §1.3 token change plus the C2 polarity switch.

**P2 — the footer row has no `flex-wrap` and no `min-w-0`** (`PortalShell.tsx:365`). Four items inside a ~358px column, with longer strings in Hindi, inside a `rounded-full` pill. Structurally this is the classic setup for the pill's rounded background to break awkwardly across lines. *Not visually confirmed — no browser run was possible. QA must verify this specific case in Hindi on a 360px viewport before it is called fixed.*

**P3 — the toggle is a white-label entitlement, and needs an explicit gate.** Turning platform attribution off is `PlanFeatureKey.WHITE_LABEL` behaviour, but `captive_portal_configs` is gated only by `captive_portal.*` permissions, and `captive_portal.update` is granted to roles holding no `white_label.*` at all. Add `powered_by_enabled: Boolean NOT NULL DEFAULT true` on the captive-portal config, with a service-layer entitlement check in `update_config` that fires **only** when the value is being set to `false`, raising 402.

Do **not** add `RequireFeature` as a router dependency — it would gate the entire `PUT` including every non-white-label field. Do **not** gate the read path: `GET /captive-portal/resolve` is unauthenticated, and a 402 there breaks the portal outright for any non-entitled tenant.

---

## Part 4 — Backend image pipeline

Today there is **no image processing for backgrounds at all** — `branding/service.py:30-33` says so in its own comment. Content-type and a 5 MiB cap are validated; raw bytes are stored and served. That is why customer photos look soft: a heavily-compressed upload gets upscaled by `bg-cover` to fill a phone.

Add `_process_background_image(content) -> tuple[bytes, str, str] | None`, mirroring `_process_logo`'s exact contract including its graceful "return `None`, store the original unchanged" fallback.

Order of operations matters:

1. **Decode**, reusing `_process_logo`'s hard-won `except` list — and add **`Image.DecompressionBombError`**, which it currently misses. That is a live bug today, not a v7 one: the class subclasses bare `Exception`, and the `4096` dimension guard runs *after* `img.load()`, so a ~20000×20000 PNG well under 5 MiB **500s the logo upload right now**. Do not widen to bare `except Exception` — the enumerated list is what makes it auditable.
2. **Size guards** before any pixel work — per-edge ceiling **and** a total-pixel ceiling, since a 1×200000000 aspect passes a per-edge check. Set the background ceiling far above the logo's 4096: a 24MP phone photo is 6000×4000, and reusing 4096 would make the fallback fire on exactly the uploads that most need downscaling.
3. **`ImageOps.exif_transpose` — mandatory.** Browsers auto-rotate JPEGs by their EXIF `Orientation` tag; Pillow does not, and re-encoding drops the tag. Without this, **every portrait phone photo comes out sideways after v7 ships** — a regression that does not exist today precisely because bytes are currently served untouched.
4. **Compute the two luminance values for C2** here, while the image is decoded.
5. **Downscale** to 2560px on the long edge (LANCZOS), preserving aspect.
6. **Re-encode WebP** at q≈82. A 5 MiB GIF becomes ~90 KB.

Hook it into `upload_background_image` **after** the 5 MiB check — the cap must apply to ingress bytes, not post-compression bytes.

**WebP is safe.** `BACKGROUND_IMAGE_ALLOWED_CONTENT_TYPES` already contains `"image/webp": "webp"`, and the served content-type is derived from the key's extension, so a `.webp` key serves correctly with **zero** changes to the serving path. The URL carries no extension, so nothing downstream can branch on format. Support is Safari 14 / iOS 14 and every Android WebView.

**Two traps:**

- **Do not simply delete `image/gif` from the allowlist.** `_EXTENSION_TO_CONTENT_TYPE` is *derived* from that dict, so removing GIF would also remove it from the **serving** map, and every already-stored `.gif` would start serving as `application/octet-stream` and stop rendering. Decouple the two dicts first.
- An animated GIF flattens to frame 0. Correct for a full-bleed background, but log it explicitly rather than leaving it a mystery.

**Existing images:** no migration — the extension lives inside the `String(1024)` key. A one-off idempotent `scripts/backfill_background_images.py` with `--dry-run`, skipping keys already ending `.webp`, writing to a **new** key and leaving the old object in place so rollback is one `UPDATE`. **Do not** re-process lazily on read: that would put an object-storage write and a DB write on an unauthenticated guest-facing path reachable by org-UUID enumeration.

**Existing tests keep passing unchanged** — `test_branding.py:193`'s `PNG_BYTES` is an 8-byte magic plus garbage that Pillow cannot decode, so every current background test takes the `return None` path and its `.png`/`.jpg` assertions still hold. New happy-path tests must build a real image via `Image.new(...)`.

---

## Part 5 — Load speed

Measured from a real production build. Bundle bytes are measured; **network and CPU timings are modeled** — no browser trace or Lighthouse run was possible.

Already fixed, do not redo: the recharts leak (#91), `ssr: false` removal, and branding `Cache-Control`/ETag/304 (#34).

In order of leverage:

**S1 — the sign-in card is never server-rendered.** SSR is on, but the config comes from a plain `useQuery` in a React context with **no route `loader`, no `ensureQueryData`, no dehydration** anywhere in the portal routes. The guest's chain is: HTML spinner → 365 KB gz download → 1.22 MB parse → hydrate → cross-origin resolve → client redirect → card. Add a route loader that resolves server-side so the card ships in the first HTML. Biggest structural win.

**S2 — 39 KB gz of framer-motion ships to every guest, for admin login pages.** `login.tsx`, `forgot-password.tsx` and `master-login.tsx` each export a named component *beside* `Route`, dragging the whole module and its imports into the entry chunk. This is the identical bug class #91 already fixed once; three instances remain. The portal itself has zero framer-motion — it was deliberately removed. Move the three components into non-route-registered files under `src/components/`. Mechanical, low risk, do it first.

**S3 — `preconnect`.** The API is a separate origin in production and `__root.tsx:108-113` has no `preconnect` or `dns-prefetch`. The guest pays cold DNS + TCP + TLS at the exact moment resolve fires, on a pre-auth walled-garden path. One line, ~200–400 ms.

**S4 — the image pipeline** (Part 4). A gallery photo is 1–5 MB; a correctly sized WebP for a 1170×2532 viewport is 80–150 KB. **10–40× overhead** on the venue's own uplink.

**S5 — cache-bust the asset URLs.** ETag and `Cache-Control` exist, but asset URLs are stable and not content-addressed, so a re-upload (or the Part 4 backfill) stays invisible to a guest device for up to an hour. The stored key already contains a fresh `uuid4()` per upload — append a token derived from it to the URL resolve hands out, then serve `public, max-age=31536000, immutable`. Instant invalidation *and* a far longer TTL.

**S6 — i18next and the admin dashboard's locale bundles ship to the portal for nothing.** `__root.tsx` eagerly imports all 8 locale JSONs and runs `i18n.init()` at module scope; 420 Devanagari tokens sit in the entry chunk. The portal doesn't use i18next at all — it has its own dictionary in `portal-i18n.ts`. ~20–25 KB gz plus an init on every portal boot.

**S7 — resolve does an uncached `SELECT brandings` even on cache hits**, whenever the config row has a null logo/background URL, which the code's own comment says is the common case. Fold the branding row into the cached payload.

**S8 — a busy café can 429 itself.** `/captive-portal/resolve` is rate-limited on `(client_ip, path)` at 60 req/60 s, and every device behind a venue's single NAT IP shares one bucket. Key it on something that is not the shared egress IP.

**S9 — guest login blocks on a router TCP connect.** `_assign_guest_queue` opens a fresh connection to the venue's MikroTik, **awaited inline, 10 s timeout, no pooling**. It is exception-swallowed, but a swallowed 10 s timeout still means the guest watches a spinner for 10 s. Move it off the request path. Also: `resolve_effective_policy` is called 3× per login against the same table for the same key with no cache, and a 3-iteration quota loop issues one SELECT per period instead of one `IN (…)`.

**S10 — resolve cache robustness.** Unguarded `await` (see §0.2), negative results never cached so a misconfigured location pays the full walk forever, and no single-flight so every 60 s TTL expiry is a small stampede.

**Free wins already on the wire:** the backend already returns `pin_login_enabled` and `location_country` on resolve, and `RuntimePortalConfig` picks up neither. So an admin can enable PIN login and the portal still won't offer it. (`portal-locale.ts:10`'s comment saying there is no venue-country field is now stale.)

---

## Part 6 — Typography — **OPEN, DO NOT START**

The research that would decide this was cut short by an API quota limit. What is already established:

- The portal renders on a pure system stack (`PG_FONT_STACK`, `PortalShell.tsx:36-37`) with `"Noto Sans Devanagari"` in the chain. No self-hosted fonts exist on `main`.
- **PR #96 already builds the font-choice mechanism**: a curated 4-value allowlist, three same-origin `.woff2` files at 9.9/11.3/8.8 KB, real computed metric overrides, `font-display: optional`, and a `unicode-range` that excludes Devanagari and Arabic so `hi`/`ar` headings always fall back. It applies to display/title/subtitle only — body, meta, micro and all interactive text stay on the system stack permanently. **v7 must not rebuild this.**
- **The type scale has no mobile step.** `pg-title` is 26px at 320px and at 1279px alike. A long venue name wraps to 3+ lines in a 358px column with nothing to reduce it.
- **Every size is absolute `px`, so the existing "Large text" toggle is inert.** The root `text-[17px]` never cascades into `pg-title`/`pg-body`/`pg-micro`. The guest's own browser font-size preference is also ignored.
- `pg-shell` is applied as a class but **has no CSS rule anywhere** — the font actually comes from an inline style. v6's docs describe the mechanism against a selector that does not exist.
- Known bug not to rebuild: `PortalCustomization.tsx`'s 8-option "Font family" `<Select>` is fake — `fontFamily` is in neither the update whitelist nor the backend schema.

**Still needed:** a Devanagari-first type recommendation where Hindi is a first-class citizen with matching weight and rhythm rather than a fallback, self-hostable and small enough for the same-origin budget.

---

## Part 7 — Accessibility control — **OPEN, DO NOT START**

Same quota cutoff. Established:

- An `A11yMenu` already exists, and its "Large text" option is **effectively inert** for essentially all guest-facing text (see Part 6). Shipping a redesigned button on top of a control that does nothing would make the problem worse, not better.
- **Tap targets below the 44px floor:** language and a11y triggers at 36×36, the terms checkbox glyph at 16×16 (the wrapping `<label>` mitigates but does not fix), the tier-3 "more options" links at ~18px, the footer `Terms` link at ~15px.
- **`viewport-fit=cover` is set with zero safe-area padding anywhere in `src/`.** On a notched iPhone the footer's `Terms` link — the only interactive element down there — lands under the home indicator, where swipe-up intercepts it. In landscape, the language/a11y row sits inside the notch exclusion zone.
- Arabic is a supported locale, so RTL is in scope.

**Still needed:** the actual recommendation. The open question is whether a visible control is the right investment at all, or whether the baseline fixes above plus honouring the OS-level `prefers-contrast` / `prefers-reduced-motion` / Dynamic Type settings deliver more for the same effort. There is substantial published criticism of overlay-style accessibility widgets that must inform this before anything is built.

---

## Open items needing founder sign-off

1. **Two new stored luminance values per background** (C2). This is the mechanism the whole "any background works" guarantee rests on. It means a re-upload changes portal appearance slightly and automatically, which is the intent — confirm that is wanted.
2. **A character limit on the welcome message** (W2). It is a restriction on what a customer can write. The alternative is letting long messages bury the sign-in button.
3. **Whether "Powered by" becomes switchable at all** (P3). Adding the toggle is only worth doing if white-label customers are meant to remove attribution.

## Explicitly out of scope

Anything not listed above — including a per-location background *cropping UI*, video backgrounds, and rebuilding the fake font-family selector. The focal point ships as a stored field with a sensible default; an admin picker for it is a separate piece of work.
