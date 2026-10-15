/**
 * The decisions behind `/portal/review` (the "Rate us on Google" page),
 * kept out of the route so `scripts/test-portal-review-page.mjs` can bundle
 * and test the real rules without a browser.
 *
 * Touches no Web Storage: Apple's Captive Network Assistant throws on
 * access, and this page is reached from a captive sheet as often as from a
 * browser.
 */
import type { RuntimePortalConfig } from "@/types/portal-runtime";
import { resolvePostLoginDestination, reviewPageEligible } from "@/lib/portal-post-login";

export type ReviewPageDecision = "show" | "continue";

/**
 * Show the page, or continue straight on. Continues -- rendering no CTA --
 * whenever anything is off: the switch, the link, the server's
 * `reviewPromptDue`, or the `sid` on the URL not being the guest's live
 * session. A stale, bookmarked or forwarded `/portal/review` link can
 * therefore never strand a guest or ask the wrong one.
 */
export function reviewPageDecision(input: {
  config: Pick<RuntimePortalConfig, "reviewCardEnabled" | "reviewUrl"> | null | undefined;
  session: { sessionId: string; reviewPromptDue?: boolean } | null | undefined;
  sid: string | null | undefined;
}): ReviewPageDecision {
  const { config, session, sid } = input;
  if (!session || !sid || sid !== session.sessionId) return "continue";
  return reviewPageEligible(config, session) ? "show" : "continue";
}

/**
 * Where "Continue to internet" goes. Derived from the venue's own config,
 * NEVER from the URL: there is no `next=` parameter, because one would be
 * an open redirect on the portal host.
 *
 *   - redirect mode, outside a captive sheet -> the venue's redirect URL
 *     (already through `isSafeRedirectTarget`). The guest's own pre-hotspot
 *     destination is not used on this path (SPEC R6).
 *   - otherwise -> `/portal/session` with `review=<sid>`, which renders the
 *     venue's html page or the connected page, and keeps the star-feedback
 *     card out of this visit.
 */
export function reviewContinueTarget(input: {
  config: Pick<RuntimePortalConfig, "postLoginHtml" | "redirectUrl"> | null | undefined;
  inCaptiveSheet: boolean;
  sessionUrl: string;
  sessionId: string | null | undefined;
}): string {
  const destination = resolvePostLoginDestination(input.config, null);
  if (!input.inCaptiveSheet && destination.mode === "redirect" && destination.url) {
    return destination.url;
  }
  if (!input.sessionId) return input.sessionUrl;
  const url = new URL(input.sessionUrl);
  url.searchParams.set("review", input.sessionId);
  return url.toString();
}

/** Resolves with `fallback` if `promise` has not settled within `ms`, and
 * never rejects -- the review tap must not wait on, or fail because of,
 * the analytics call. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** The reachability probe: Google's favicon. Before the gate opens the
 * NAS intercepts it, and it fails; after, it loads. */
export const GOOGLE_REACHABILITY_PROBE_URL = "https://www.google.com/favicon.ico";
export const GOOGLE_REACHABILITY_TIMEOUT_MS = 2_000;

/**
 * Can this device reach Google yet? Omada and Aruba open the gate a second
 * or two after the portal moves on, and a review link tapped into a still
 * shut gate would land on the portal again. Loading an image is the
 * cheapest check that works cross-origin without CORS.
 *
 * `makeImage` is injectable so the rule is testable without a DOM.
 */
/** The slice of `HTMLImageElement` the probe uses -- structural, so a test
 * can pass a plain object. */
export interface ProbeImage {
  onload: ((ev: Event) => unknown) | null;
  onerror: ((ev: Event | string) => unknown) | null;
  src: string;
}

export function probeGoogleReachable(
  makeImage: () => ProbeImage,
  timeoutMs = GOOGLE_REACHABILITY_TIMEOUT_MS,
  now: () => number = Date.now,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    const img = makeImage();
    img.onload = () => {
      clearTimeout(timer);
      done(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(false);
    };
    // Cache-busted, so a favicon cached before the gate opened cannot
    // answer for a network that is shut now.
    img.src = `${GOOGLE_REACHABILITY_PROBE_URL}?_=${now()}`;
  });
}
