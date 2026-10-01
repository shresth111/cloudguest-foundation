/**
 * Block Websites -> Apps, the pure half: what one app toggle shows, from the
 * backend's per-app state. No React, no requests -- executed directly by
 * `scripts/test-app-and-harmful-blocking.mjs`.
 *
 * The backend (`content_filtering.app_catalogue`) blocks an app by blocking
 * the website names it uses, through the same per-name push a hand-blocked
 * website gets. So "switched off" is a claim about names, and a toggle is
 * only drawn as off when every name is blocked AND on the router.
 */
import type { ContentFilterApp } from "@/types/contentFilter";

/** What the toggle and its one-line status say.
 *
 *  - `allowed`: nothing of this app is blocked.
 *  - `blocked`: every name is blocked and on the router.
 *  - `sending`: blocked, but some names have not reached the router yet.
 *  - `failed`: some names didn't reach the router; the owner can try again.
 *  - `partial`: only some names are blocked (one blocked by hand, say).
 */
export type AppToggleView = "allowed" | "blocked" | "sending" | "failed" | "partial";

export function appToggleView(app: Pick<ContentFilterApp, "state" | "pushStatus">): AppToggleView {
  if (app.state === "not_blocked") return "allowed";
  if (app.pushStatus === "failed") return "failed";
  if (app.state === "partly_blocked") return "partial";
  return app.pushStatus === "active" ? "blocked" : "sending";
}

/** Whether the switch is drawn as "blocked". Anything with a block on it
 * reads as blocked, so switching it the other way means "remove", which is
 * what the owner of a half-applied block wants to be able to do. */
export function appSwitchBlocked(view: AppToggleView): boolean {
  return view !== "allowed";
}

/** Names of this app that did not reach the router, for the retry line. */
export function appFailedNames(app: Pick<ContentFilterApp, "targets">): string[] {
  return app.targets.filter((t) => t.devicePushStatus === "failed").map((t) => t.value);
}

/** Names already blocked by hand: the app toggle counts them and never
 * removes them, and the owner should know that switching the app back on
 * leaves them blocked. */
export function appHandBlockedNames(app: Pick<ContentFilterApp, "targets">): string[] {
  return app.targets.filter((t) => t.ruleId && !t.owned).map((t) => t.value);
}
