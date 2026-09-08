/**
 * The ONE place that decides what a guest sees / where they go after a
 * successful login -- consumed by portal.success.tsx (which picks the NAS
 * `dst`) and portal.session.tsx (which renders the destination or bounces
 * to it), so the two can never disagree about a venue's own post-login
 * choice.
 *
 * WHY THIS EXISTS: the founder's flow review ("after login I'm shown a
 * session-details page, then a 3-2-1 redirect timer, then the URL") was
 * really one question asked twice: what is the guest's single post-login
 * page? The answer is now an explicit three-way decision made here:
 *
 *   - "html"    -> the venue authored a custom post-login page
 *                 (`post_login_html`); it IS the page. A slim "session
 *                 started" strip sits above it, and the guest STAYS
 *                 (portal.session.tsx renders it).
 *   - "redirect"-> the venue set a redirect URL (or the guest had a real
 *                 pre-hotspot destination, `destinationUrl`, which keeps
 *                 precedence exactly as the old session page's Continue
 *                 button gave it). No countdown, no intermediate page:
 *                 portal.success.tsx points the NAS `dst` straight at it
 *                 when a NAS POST is happening, and portal.session.tsx
 *                 bounces to it otherwise.
 *   - "default" -> neither; the built-in connected page on
 *                 /portal/session is the destination (unchanged).
 *
 * The two inputs are genuinely different facts and neither is derived
 * from the other: `postLoginHtml` is venue-authored content to READ,
 * `redirectUrl`/`destinationUrl` is a place to GO. An external URL can't
 * host the session strip, so "html" always outranks "redirect" -- the
 * page is the destination; if a URL is also set the page offers it as a
 * guest-decision "Continue" link (the old redirect page's own rule,
 * moved here).
 */

import type { RuntimePortalConfig } from "@/types/portal-runtime";
import { hasPostLoginHtml } from "@/lib/post-login-html";

export type PostLoginMode = "html" | "redirect" | "default";

/**
 * A real navigation sink guard shared by every surface that ever assigns
 * a URL to `window.location.href` / an anchor's `href` after login.
 * `destinationUrl` is `dst` straight off the portal URL (RouterOS's
 * `$(link-orig)`) and `config.redirectUrl` is admin-entered free text --
 * neither has scheme validation of its own, and a `javascript:`-scheme
 * value in a navigation sink runs script in this page's own origin.
 * http/https only. (Moved here from portal.redirect.tsx so success.tsx
 * and session.tsx apply the identical rule.)
 */
export function isSafeRedirectTarget(candidate: string): boolean {
  try {
    // A real navigation sink resolves against the live page origin; the
    // bundle-test fallback keeps the guard usable (and identically strict)
    // in an environment without `window` -- the protocol check below never
    // depends on which base was used.
    const base = typeof window !== "undefined" ? window.location.origin : "https://portal.invalid";
    return ["http:", "https:"].includes(new URL(candidate, base).protocol);
  } catch {
    return false;
  }
}

export interface PostLoginDestination {
  /** The mode that decides what portal.session.tsx renders. */
  mode: PostLoginMode;
  /** Non-null exactly in "html" mode -- the venue-authored page. */
  html: string | null;
  /**
   * A safe http(s) destination. Present in "redirect" mode (it is the
   * destination); optional in "html" mode (the page offers it as a
   * "Continue" link). Never a `javascript:`-scheme value.
   */
  url: string | undefined;
}

export function resolvePostLoginDestination(
  config: Pick<RuntimePortalConfig, "postLoginHtml" | "redirectUrl"> | null | undefined,
  destinationUrl?: string | null,
): PostLoginDestination {
  const html = hasPostLoginHtml(config?.postLoginHtml) ? config!.postLoginHtml : null;
  const raw = destinationUrl || config?.redirectUrl || null;
  const url = raw && isSafeRedirectTarget(raw) ? raw : undefined;
  const mode: PostLoginMode = html ? "html" : url ? "redirect" : "default";
  return { mode, html, url };
}
