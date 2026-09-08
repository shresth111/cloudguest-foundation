/**
 * iOS/iPadOS Captive Network Assistant detection -- the ONE context that
 * must be handed Apple's own captive-detection URL after login, and the
 * one that must never be auto-redirected to an arbitrary page.
 *
 * HOW TO TELL THE SHEET FROM ORDINARY SAFARI ON THE SAME DEVICE. A user
 * agent cannot: it identifies a DEVICE ("this is an iPhone"), and the CNA
 * websheet and Safari on that iPhone need opposite treatment -- the sheet
 * must be pointed at `captive.apple.com` (whose "Success" body is what
 * makes it dismiss), while Safari must land on the real `/portal/session`
 * page (Android behaviour) instead of a bare one-word page with no way
 * back. The signal that separates them is Web Storage: the CNA treats
 * storage like private browsing and THROWS on access, exactly as the
 * persistence helpers in PortalRuntimeContext already document (the reason
 * the whole CNA storage-safety suite exists). Ordinary Safari reads and
 * writes storage normally. So a storage probe answers the question
 * directly, where the user agent never could.
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

/** Apple's captive-detection success URL. iOS/iPadOS opens its CNA
 * websheet the moment it joins a Wi-Fi it thinks is captive, and it only
 * marks the network "online" -- dismissing the sheet and releasing every
 * non-CNA app's traffic -- once its probe to this exact HTTP URL returns
 * Apple's fixed `...<TITLE>Success</TITLE>...Success...` body. HTTP, never
 * HTTPS: the CNA probes the plain-HTTP endpoint (RouterOS serves that
 * body itself through an open gate). */
export const APPLE_CAPTIVE_SUCCESS_URL = "http://captive.apple.com/hotspot-detect.html";
