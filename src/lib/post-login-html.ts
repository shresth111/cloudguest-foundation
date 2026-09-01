/**
 * The venue-authored **post-login** page (`captive_portal_configs.post_login_html`
 * / `RuntimePortalConfig.postLoginHtml`) -- the HTML a guest sees on
 * `/portal/redirect` immediately after a successful sign-in, instead of only
 * being bounced to an external `redirect_url`.
 *
 * This module owns the two rules that MUST agree between the authoring
 * surface (Portal -> Design) and the guest render (`/portal/redirect`), because
 * a disagreement between them is exactly how this class of feature breaks:
 *
 *   1. THE SIZE CAP. The backend column is capped at 64 KiB and rejects an
 *      over-cap write with a 400. `postLoginHtmlByteLength` counts what the
 *      backend counts -- UTF-8 BYTES, not characters -- so the editor can
 *      refuse at authoring time with a readable reason instead of letting the
 *      request fail. A `TEXT` column's limit is a byte limit: one emoji is 4
 *      bytes and one Devanagari code point is 3, so a character count would
 *      under-report by 4x on exactly the content our venues actually write.
 *
 *   2. THE SANDBOX. `POST_LOGIN_HTML_SANDBOX` is the single definition of the
 *      `sandbox` attribute every surface that renders this HTML must use.
 *      See its own comment -- it is a security control, not a style choice.
 *
 * NOT A CONTENT MODE. `PortalContentMode` (`login`/`image`/`text`/`redirect`,
 * see `PortalContentBlock`) is the *pre*-login system: what a guest sees
 * before or alongside the sign-in card. This is the *post*-login surface and
 * is deliberately outside that enum -- the two are independent, and a venue
 * can set both.
 */

/** Backend cap on `post_login_html`, in UTF-8 bytes (64 KiB). */
export const POST_LOGIN_HTML_MAX_BYTES = 64 * 1024;

/** Reused so the counter does not allocate a fresh encoder per keystroke.
 * `TextEncoder` is available in every browser this portal supports and in
 * Node >= 11, so no guard is needed -- but see `postLoginHtmlByteLength`. */
const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

/**
 * UTF-8 byte length of `value` -- the exact number the backend compares
 * against `POST_LOGIN_HTML_MAX_BYTES`.
 *
 * Deliberately NOT trimmed, unlike `countSplashLength` in
 * `src/lib/splash-limits.ts`: leading/trailing whitespace in a `TEXT` column
 * is stored, and therefore counted, by the database. Trimming here would let
 * a value the backend rejects read as in-budget in the editor.
 */
export function postLoginHtmlByteLength(value: string): number {
  if (encoder) return encoder.encode(value).length;
  // Environments with no TextEncoder at all (none we ship to). Falling back
  // to the UTF-16 length under-counts, so this branch is only ever a
  // best-effort display value -- the backend stays the real gate.
  return value.length;
}

/** True when this value would be REJECTED by the backend's 64 KiB cap.
 *
 * No grandfathering clause (contrast `splashOverLimitBlocked`): the cap is
 * enforced on write, so a stored row can never already be over it, and there
 * is no existing-over-limit state to be tolerant of. */
export function postLoginHtmlOverLimit(value: string): boolean {
  return postLoginHtmlByteLength(value) > POST_LOGIN_HTML_MAX_BYTES;
}

/** Is there real post-login HTML to render?
 *
 * Whitespace-only is "no" -- an editor left with a stray newline must fall
 * through to the pre-feature behaviour byte-for-byte, not render an empty
 * iframe with a 60vh hole in the middle of the page. This is the single
 * predicate the render path and the editor's preview both use, so they can
 * never disagree about whether a venue "has" a post-login page.
 */
export function hasPostLoginHtml(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The `sandbox` attribute for EVERY iframe that renders venue-authored
 * post-login HTML. Do not inline a different value at a call site, and do not
 * add tokens to this one without understanding all four:
 *
 *   NO `allow-scripts`      -- `/portal/redirect` is same-origin with the
 *                              phone-number entry and OTP verification
 *                              screens. Script running in venue-authored,
 *                              stored HTML on this origin can read the
 *                              session the guest just established and
 *                              exfiltrate the identifier they just typed.
 *                              The server-side sanitizer on write is defence
 *                              in depth; THIS is the primary control, and it
 *                              is the one that still holds if the sanitizer
 *                              is misconfigured, bypassed, or rolled back.
 *   NO `allow-same-origin`  -- keeps the frame in an opaque origin, so even
 *                              a CSS/markup-only payload cannot reach this
 *                              document's cookies, storage or DOM. Note that
 *                              `allow-scripts` + `allow-same-origin`
 *                              together would let the frame remove its own
 *                              sandbox attribute, which is why neither is
 *                              here and why they must never both be added.
 *   `allow-popups`          -- a link in the venue's HTML is the whole point
 *                              of the feature (menu, booking page, wifi
 *                              terms). Without this token a `target="_blank"`
 *                              link is silently blocked.
 *   `allow-popups-to-escape-sandbox`
 *                           -- the tab that link opens is a normal tab, not
 *                              a second sandboxed opaque-origin document.
 *                              Without it the venue's own site would load
 *                              with scripts disabled and appear broken.
 *
 * Notably absent and deliberately so: `allow-top-navigation` (the frame must
 * never be able to move the guest off the portal), `allow-forms` (nothing in
 * a script-less frame can usefully submit, and it is a phishing surface on a
 * page guests have just typed a phone number into), and `allow-modals`.
 */
export const POST_LOGIN_HTML_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

/**
 * Wraps the venue's markup for `srcdoc`.
 *
 * Two additions, both of which have to be here rather than in the venue's own
 * paste, and neither of which can change what their markup means:
 *
 *   - `<base target="_blank">`. A link with no `target` inside the frame
 *      navigates THE FRAME, which on a captive portal is a dead end: the
 *      venue's site would load inside a 60vh box, inside iOS's Captive
 *      Network Assistant websheet, with no back affordance and no address
 *      bar. Defaulting to a new tab is the only outcome that behaves. A
 *      venue that writes an explicit `target` on a link still wins, since a
 *      link's own attribute overrides `<base>`.
 *   - A minimal readable default style. `srcdoc` starts from the UA
 *      stylesheet on a transparent canvas; without this a venue's plain
 *      `<p>` renders at the UA default with an 8px body margin and no
 *      wrapping rules for long unbroken strings. Every rule is on `html`/
 *      `body`/`img` only and every one is overridable by the venue's own
 *      CSS, which is loaded after it.
 *
 * No `<meta charset>` is emitted and none is needed: a `srcdoc` document
 * inherits its character encoding from the parent document (always UTF-8
 * here), and emitting one would let a venue's own leading `<meta charset>`
 * be the second, ignored one.
 */
export function buildPostLoginSrcDoc(html: string): string {
  return `<base target="_blank"><style>html{-webkit-text-size-adjust:100%}body{margin:0;padding:16px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1e1b4b;background:transparent;overflow-wrap:break-word}img,video,iframe{max-width:100%;height:auto}</style>${html}`;
}
