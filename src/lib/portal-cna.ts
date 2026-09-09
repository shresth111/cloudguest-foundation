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
