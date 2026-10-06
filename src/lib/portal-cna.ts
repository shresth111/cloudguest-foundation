/**
 * iOS/iPadOS Captive Network Assistant detection -- the ONE context whose
 * Web Storage THROWS on access (the CNA treats storage like private
 * browsing), which is what tells the CNA websheet apart from ordinary
 * Safari on the same device.
 *
 * WHO STILL NEEDS THIS NOW THAT THE PORTAL NO LONGER HANDS ANYONE TO
 * `captive.apple.com`. The distinction still matters in two places:
 *
 *   - `/portal/success` -- a redirect-mode venue must not bounce the
 *     websheet to an arbitrary external URL (meaningless inside the sheet,
 *     and it reads as a broken redirect); the session page is the honest
 *     resting place there too.
 *   - `/portal/session` -- never auto-redirect inside the sheet, for the
 *     same reason.
 *
 * WHAT CLOSES THE SHEET, AND WHY THIS FILE NO LONGER EXPORTS THE APPLE URL.
 * The sheet used to be handed Apple's captive-detection URL
 * (`http://captive.apple.com/hotspot-detect.html`, whose entire body is
 * the word "Success") after login, on the theory that the portal had to
 * navigate the sheet there. That redirect is exactly what a guest SAW as a
 * bare one-word page after login (Android never shows it). Closing the
 * sheet does not need the portal to navigate anywhere: once the NAS gate
 * is open, iOS's own captive re-probe reaches `captive.apple.com` through
 * the open gate and gets Apple's Success body by itself, which is what
 * dismisses the sheet. The portal therefore points no client at
 * captive.apple.com, and the constant that used to live here is gone.
 */

/** True only when this browser context is the CNA websheet. */
export function isCaptiveNetworkAssistant(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.getItem("__cna_probe__");
    return false;
  } catch {
    return true;
  }
}

/**
 * ANDROID'S SIGN-IN SHEET IS NOT DETECTED BY THE PROBE ABOVE.
 *
 * AOSP `CaptivePortalLoginActivity` calls `setDomStorageEnabled(true)` on
 * its WebView (android11-release through main), so Web Storage works there
 * and `isCaptiveNetworkAssistant()` returns false on every Android phone.
 * What does identify it is the WebView user agent: Android WebView appends
 * `; wv)` to the platform token, which Chrome itself never does. The
 * sheet does not override the WebView's UA (its `EXTRA_CAPTIVE_PORTAL_
 * USER_AGENT` is only used for downloads).
 *
 * A heuristic, and deliberately used only where a false positive is
 * harmless: any Android in-app WebView matches. Nothing gates access on
 * it. A false NEGATIVE is also possible -- an OEM sheet, or AOSP's
 * Custom Tabs experiment (`captive_portal_custom_tabs`, off by default),
 * runs in a real browser -- which is why the offer/survey timing fix does
 * not depend on detection at all: the pre-gate phase (@/lib/portal-pre-gate)
 * runs for every client.
 */
export function isAndroidCaptivePortalWebView(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? (navigator.userAgent ?? "") : "");
  return /Android/i.test(ua) && /;\s*wv\)/.test(ua);
}

/** True inside either OS's captive sign-in sheet (as far as it can be
 * told): a context the OS closes on its own once the gate is open, so it
 * must never be sent to an arbitrary external URL. */
export function isCaptiveSheet(): boolean {
  return isCaptiveNetworkAssistant() || isAndroidCaptivePortalWebView();
}
