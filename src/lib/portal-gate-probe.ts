/**
 * IS THE ROUTEROS HOTSPOT GATE ALREADY OPEN FOR THIS DEVICE? -- asked just
 * before `/portal/success` fires its hotspot-login form POST.
 *
 * ## THE DEFECT THIS EXISTS TO FIX
 *
 * Measured on a real MikroTik, 2026-10-11: a POST to a bypassed host
 * returns 501 from the router's management web server. A device can be let
 * through by a hotspot BYPASS BINDING instead of a hotspot login -- an
 * admin marked it a Trusted Device, or the server pushed a binding a few
 * seconds after sign-in. Once bypassed, RouterOS stops routing that
 * device's requests to the hotspot servlet, so the form POST to
 * `link-login-only` lands on the router's own web server and the guest is
 * left on a bare "Error 501" page while their internet works perfectly.
 * The sequence seen: portal loaded while gated, the binding landed ~30s
 * later, the guest finished OTP, the success page POSTed -> 501.
 *
 * `hspage` (see portal-nas-state.ts) cannot see this: it records which
 * page the router served when the portal was LOADED, and the gate opened
 * afterwards.
 *
 * ## THE SIGNAL
 *
 * One request to an HTTPS host outside the walled garden. For a client
 * the hotspot has not let through, RouterOS refuses non-walled TCP, so the
 * request fails; for a bypassed or authorized client it completes. The
 * answer is deliberately one-sided: only a completed request means
 * anything. A failure, a timeout, a missing `fetch`, anything thrown --
 * all of it is "did not find out", and the caller POSTs exactly as before.
 *
 * ## WHY THE ANSWER IS FENCED IN THREE TIMES
 *
 * A wrong "open" is the dangerous direction: the POST is the only thing on
 * that page that opens the gate, and the page the guest is sent to instead
 * (`/portal/session`) is on the portal's own walled host, so the NAS does
 * NOT intercept that load and correct the mistake -- a gated guest would
 * be shown "connected". Ways it could be wrong: a venue that has walled
 * this host's address by hand, or a device answering over another path
 * (iOS Wi-Fi Assist falling back to cellular). So:
 *
 *  1. Never inside iOS's Captive Network Assistant. Whether a third-party
 *     request behaves there is not established, and this repo already has
 *     one incident of a request hanging that sheet (see
 *     `authorizeRadiusOnBackend` in portal.success.tsx).
 *  2. Only for a session that has JUST started. This is the bound that
 *     needs no storage at all: a guest who was wrongly skipped and comes
 *     back later -- any tab, any webview, cookies wiped or not -- is past
 *     the window and gets the POST.
 *  3. Once per browser. Taking the skip writes a marker and reads it back;
 *     a marker that cannot be read back means no skip, and a marker that
 *     is already there means no probe. So a second arrival POSTs.
 *
 * Pure (everything it touches is passed in) so
 * `scripts/test-portal-gate-probe.mjs` drives the real decision.
 */

/**
 * The probe target. THIS HOST MUST NEVER BE REACHABLE THROUGH A SHUT GATE.
 *
 * The constraint, for whoever changes it:
 *  - never the portal's or the API's own host, nor anything sharing their
 *    address: those are the only two ADDRESS-based walled-garden rows the
 *    platform writes (`cloudguest-portal-https`, `cloudguest-api-https`),
 *    and address-based rows are the only kind that pass HTTPS
 *    (`buildWalledGardenLines` in RouterDetailTabs.tsx);
 *  - never an OS captive-detection host (`CAPTIVE_DETECTION_HOST_PATTERN`
 *    there): venues do allow those by hand;
 *  - never a public DoH resolver address: the setup script drops those on
 *    port 443 for `hotspot=!auth`, which would make every answer "shut";
 *  - HTTPS, so an intercepting hotspot cannot answer in its place (the
 *    certificate would not match), and an image, so the response is one no
 *    browser's opaque-response blocking turns into a network error. It
 *    must not send `Cross-Origin-Resource-Policy: same-origin`.
 *
 * A third party's favicon is a dependency on that third party. If it ever
 * moves or starts failing, every probe reads "did not find out" and the
 * page goes back to POSTing -- the safe direction.
 */
export const HOTSPOT_GATE_PROBE_URL = "https://www.cloudflare.com/favicon.ico";

/** The most this can ever add in front of the POST. Well under the page's
 * own 4s "taking longer than expected" notice. */
export const HOTSPOT_GATE_PROBE_TIMEOUT_MS = 1_500;

/** Fence 2 above: how recently the session must have started. The incident
 * is a guest arriving straight from OTP (seconds); two minutes covers the
 * required-name screen in between. */
export const HOTSPOT_GATE_PROBE_SESSION_WINDOW_MS = 120_000;

export type GateProbeFetch = (input: string, init: RequestInit) => Promise<unknown>;

export interface HotspotGateProbeEnv {
  /** `isCaptiveNetworkAssistant()` -- Web Storage throws. */
  captiveSheet: boolean;
  /** The session's own server-stamped start, ISO 8601. */
  sessionStartedAt: string | null | undefined;
  now: number;
  /** A skip was already taken on this browser. */
  skippedBefore: () => boolean;
  /** Records the skip; `true` ONLY if it read the marker back. */
  recordSkip: () => boolean;
  fetchImpl: GateProbeFetch | undefined;
  timeoutMs?: number;
}

/**
 * The synchronous half: may this attempt probe at all? `false` means the
 * caller POSTs immediately, on the same tick it always did -- which keeps
 * the CNA path byte-for-byte what it was.
 */
export function hotspotGateProbeAllowed(
  env: Omit<HotspotGateProbeEnv, "recordSkip" | "timeoutMs">,
): boolean {
  try {
    if (env.captiveSheet) return false;
    if (typeof env.fetchImpl !== "function") return false;
    const startedAt = env.sessionStartedAt ? Date.parse(env.sessionStartedAt) : NaN;
    const age = env.now - startedAt;
    // NaN (no/unparseable start) fails both comparisons. A negative age is
    // a device clock behind the server's: refuse rather than guess.
    if (!(age >= 0 && age <= HOTSPOT_GATE_PROBE_SESSION_WINDOW_MS)) return false;
    return !env.skippedBefore();
  } catch {
    return false;
  }
}

/**
 * The request itself. Resolves `true` only if it completed inside the
 * timeout; never rejects. The timer races the request rather than relying
 * on the abort alone, so a `fetch` that ignores its signal still cannot
 * hold the POST back.
 */
export function probeHotspotGateOpen(
  fetchImpl: GateProbeFetch,
  timeoutMs: number = HOTSPOT_GATE_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const controller = typeof AbortController === "function" ? new AbortController() : undefined;
    const settle = (open: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(open);
    };
    const timer = setTimeout(() => {
      settle(false);
      try {
        controller?.abort();
      } catch {
        // Nothing depends on the abort landing.
      }
    }, timeoutMs);
    try {
      // `no-cors`: the response is opaque and that is all that is needed --
      // that one arrived. No credentials and no referrer: the third party
      // learns that a request happened and nothing about who or where.
      Promise.resolve(
        fetchImpl(HOTSPOT_GATE_PROBE_URL, {
          mode: "no-cors",
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          signal: controller?.signal,
        }),
      ).then(
        () => settle(true),
        () => settle(false),
      );
    } catch {
      settle(false);
    }
  });
}

/**
 * The whole decision. `true` -- skip the POST -- only when every fence
 * passed, the request completed, AND the skip was durably recorded. Never
 * rejects.
 */
export async function hotspotGateAlreadyOpen(env: HotspotGateProbeEnv): Promise<boolean> {
  try {
    if (!hotspotGateProbeAllowed(env) || !env.fetchImpl) return false;
    if (!(await probeHotspotGateOpen(env.fetchImpl, env.timeoutMs))) return false;
    // Recorded BEFORE the answer is acted on, and believed only if it read
    // back: without the marker a wrong "open" could repeat.
    return env.recordSkip() === true;
  } catch {
    return false;
  }
}
