import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type {
  RuntimeAuthMethod,
  RuntimeLanguage,
  RuntimePortalConfig,
  RuntimeSession,
} from "@/types/portal-runtime";
import {
  translate,
  loadPersistedLanguage,
  persistLanguage,
  readLanguageFromUrl,
} from "@/lib/portal-i18n";
import {
  GUEST_FONT_FACES,
  GUEST_FONT_UNICODE_RANGE,
  PG_FALLBACK_FONT_STACK,
} from "@/lib/portal-guest-fonts";

/**
 * v4 §2's contrast-safe accent-foreground fix. `PG_PRIMARY_BTN` and the
 * tab-pill's active state used to hardcode white text on `var(--pr-primary)`
 * -- a venue that picks a pale accent color (a light yellow, a pastel) gets
 * the identical legibility failure PR #80 fixed for background photos, just
 * for button text instead. Computed here, alongside the existing
 * `--pr-primary`/`--pr-accent` write, using the real WCAG relative-luminance
 * formula (no new dependency) rather than a rule of thumb -- the same
 * "legible against anything a venue provides" mandate, extended from
 * backgrounds to accent colors.
 */
export function accessibleForeground(hex: string): "#ffffff" | "#0F172A" {
  const clean = hex.replace("#", "");
  // A venue's stored color should always be a real 6-digit hex (validated
  // on the admin side), but this runs inside a `<style>` string built at
  // render time -- fail safe to white (today's existing default) rather
  // than crash the whole portal shell on an unexpected shape.
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contrast of white (L=1) vs this color's luminance, WCAG formula:
  // (1 + 0.05) / (L + 0.05). >= 4.5 is the standard AA text-contrast floor.
  return 1.05 / (L + 0.05) >= 4.5 ? "#ffffff" : "#0F172A";
}

const SESSION_STORAGE_KEY = "cloudguest_portal_session";
const IDENTIFIER_STORAGE_KEY = "cloudguest_portal_identifier";
const RUNTIME_IDS_STORAGE_KEY = "cloudguest_portal_runtime_ids";

/**
 * The only three ways this file is allowed to touch `sessionStorage`.
 *
 * Web Storage *access itself* can throw -- it is not just "returns null
 * when empty". Apple's Captive Network Assistant (the websheet iOS opens
 * for a WiFi login, i.e. the single most common environment this portal
 * actually runs in) behaves like private browsing: reading or writing
 * `window.sessionStorage` raises a SecurityError. Firefox with
 * `dom.storage.enabled=false`, locked-down enterprise WebViews and a full
 * quota all do the same.
 *
 * The `typeof window === "undefined"` checks that used to be the only
 * protection here are SSR guards -- they answer "is there a `window`",
 * which says nothing about whether the storage object on it works. Every
 * unguarded access on the mandatory guest path was therefore a real
 * sign-in blocker: a write throwing inside `setSession`/`setGuestIdentifier`
 * aborts the caller mid-login, and (worst of all) an unguarded *read* in a
 * `useState` initializer throws during render, which white-screens this
 * entire provider and every screen under it.
 *
 * Same shape as `src/lib/portal-returning-guest.ts`: a storage failure
 * degrades to "nothing was persisted" -- the guest may re-see a screen or
 * lose a language preference -- never to an exception on the path between
 * a verified OTP and the NAS gate opening.
 */
function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable (CNA websheet / private browsing / quota).
    // Persistence here is an optimization, never a precondition.
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // As above -- nothing was stored, so nothing needs clearing.
  }
}

/** How long the runtime-ids cookie below lives. A guest's stay at a venue,
 * not a browsing session: long enough to cover an evening at a cafe or a
 * night in a hotel room, short enough that a device carried to a DIFFERENT
 * venue cannot be told about the old one for days. Correctness does not
 * actually depend on the length -- `persistRuntimeIds` overwrites all three
 * IDs together the moment a real link supplies new ones -- so this is a
 * cap on how stale a *last-resort* fallback can be, nothing more. */
const RUNTIME_IDS_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

/** THE SECOND CHANNEL, AND WHY THE FIRST ONE WAS NOT ENOUGH.
 *
 * `sessionStorage` above has two gaps that `IncompletePortalLinkError`
 * (src/routes/portal.tsx) fell straight through, and a guest hits them
 * AFTER a completely successful sign-in:
 *
 *  1. Inside iOS's Captive Network Assistant, Web Storage access THROWS,
 *     so `persistRuntimeIds` never stored anything in the first place --
 *     the fallback is empty in the single environment this portal most
 *     often runs in. Same root cause as PR #121's false "your session has
 *     expired" screen, one level up: there, the recovery was a live
 *     MAC-keyed session lookup; here there is nothing to look up, because
 *     without these three IDs this app does not know which venue it is.
 *  2. `sessionStorage` is scoped to ONE TAB. An OS captive-portal re-probe
 *     that reopens the portal in a fresh tab, or a guest returning via a
 *     remembered/bare URL, starts with an empty store even on a browser
 *     where storage works perfectly.
 *
 * A cookie closes both: it is not Web Storage (so the CNA's private-mode
 * behaviour does not apply to it), and it is scoped to the origin rather
 * than to the tab. It is only ever a FALLBACK -- a real NAS/QR link always
 * carries the IDs on the URL, and the URL always wins (see
 * `PortalRuntimeLayout`).
 *
 * Deliberately limited to these three IDs, not extended to `session` /
 * `guestIdentifier`: those identify a PERSON (a verified phone/email) and
 * have their own live-lookup recovery path; an organization/location/router
 * UUID identifies a venue this device is standing in. `SameSite=Lax` and
 * no `HttpOnly` (this is read by this same page's JS, never by the API),
 * and `Secure` only when the page really is on https -- a local/dev http
 * origin silently drops a `Secure` cookie, which would have made this
 * fallback quietly untestable outside production. */
function safeCookieGet(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const all = document.cookie;
    if (!all) return null;
    for (const part of all.split(";")) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      if (part.slice(0, eq).trim() !== name) continue;
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
    return null;
  } catch {
    // Cookies fully blocked, or a value that is not valid percent-encoding
    // (`decodeURIComponent` throws on a stray `%`). Same contract as
    // `safeGet`: degrade to "nothing was persisted", never to an exception
    // on the guest path.
    return null;
  }
}

function safeCookieSet(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  try {
    const secure =
      typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}` +
      `; Path=/; SameSite=Lax${secure}`;
  } catch {
    // As above -- persistence here is an optimization, never a
    // precondition.
  }
}

/** The three IDs `src/routes/portal.tsx`'s search schema treats as required
 * (organizationId/locationId/routerId) -- see that file's own
 * `IncompletePortalLinkError` doc comment for the full "why". Unlike that
 * schema's other, genuinely-optional fields, these were never given the
 * same sessionStorage-backing `session`/`guestIdentifier` got above: they
 * were assumed to always ride along on the current URL's search params.
 * That's true for the very first NAS-redirected load, but NOT for every
 * later one -- a plain browser reload of `/portal/session` while already
 * connected, an OS's own periodic captive-portal-detection re-probe
 * reopening a bare/remembered URL, browser back/forward navigation -- none
 * of those are guaranteed to carry this app's own query string forward,
 * and any one of them landing on a bare URL hit `IncompletePortalLinkError`
 * immediately, even for a guest who already has a perfectly valid,
 * persisted `session`. Confirmed live: a guest saw exactly this, right
 * after their connection had already fully succeeded.
 *
 * Persisted once genuinely present (a real link/redirect always supplies
 * all three), then used as a fallback on a later load that's missing them
 * -- same pattern as `loadPersistedSession`/`persistSession` above. Safe
 * to persist for the lifetime of a browsing session, unlike the
 * `hotspotLoginUrl` persistence attempted and later reverted earlier
 * today: these three identify the same organization/location/router for
 * as long as this guest is on this network, they don't carry a one-time
 * NAS login token that can go stale. */
interface PersistedRuntimeIds {
  organizationId: string;
  locationId: string;
  routerId: string;
}

function parsePersistedRuntimeIds(raw: string | null): PersistedRuntimeIds | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  // All three or none. A partial value is worse than no value here: two
  // real IDs and one missing renders the same "this link looks incomplete"
  // screen as an empty URL, while *looking* like the fallback worked.
  const ids = parsed as Partial<PersistedRuntimeIds> | null;
  if (!ids || !ids.organizationId || !ids.locationId || !ids.routerId) return undefined;
  return {
    organizationId: ids.organizationId,
    locationId: ids.locationId,
    routerId: ids.routerId,
  };
}

function loadPersistedRuntimeIds(): PersistedRuntimeIds | undefined {
  // sessionStorage first purely because it is the tighter scope (this tab,
  // this browsing session) and therefore the more recent of the two when
  // both are readable; the cookie is what survives the two cases
  // sessionStorage cannot -- see `safeCookieGet`'s docstring.
  return (
    parsePersistedRuntimeIds(safeGet(RUNTIME_IDS_STORAGE_KEY)) ??
    parsePersistedRuntimeIds(safeCookieGet(RUNTIME_IDS_STORAGE_KEY))
  );
}

function persistRuntimeIds(ids: PersistedRuntimeIds) {
  const raw = JSON.stringify(ids);
  // Both channels, unconditionally: neither can report whether the other
  // worked, and on the browsers that matter most exactly one of them does.
  safeSet(RUNTIME_IDS_STORAGE_KEY, raw);
  safeCookieSet(RUNTIME_IDS_STORAGE_KEY, raw, RUNTIME_IDS_COOKIE_MAX_AGE_SECONDS);
}

function loadPersistedSession(): RuntimeSession | undefined {
  const raw = safeGet(SESSION_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as RuntimeSession;
  } catch {
    return undefined;
  }
}

function persistSession(session: RuntimeSession | undefined) {
  if (session) safeSet(SESSION_STORAGE_KEY, JSON.stringify(session));
  else safeRemove(SESSION_STORAGE_KEY);
}

function loadPersistedIdentifier(): string | undefined {
  return safeGet(IDENTIFIER_STORAGE_KEY) ?? undefined;
}

function persistIdentifier(identifier: string | undefined) {
  if (identifier) safeSet(IDENTIFIER_STORAGE_KEY, identifier);
  else safeRemove(IDENTIFIER_STORAGE_KEY);
}

const HOTSPOT_SUBMIT_STORAGE_KEY = "cloudguest_portal_hotspot_submit";

/** Real incident, live captive-portal "flick flick" flash right after a
 * successful OTP login: a captured diagnostic beacon (since removed) showed
 * `/portal/` and `/portal/success` remounting 3 times in ~600ms around a
 * SINGLE already-successful RADIUS login -- the login itself succeeded on
 * the first cycle; the remounts kept happening afterward regardless,
 * re-firing `/portal/success`'s real top-level hotspot-login POST every
 * time (a harmless no-op to RouterOS for an already-authorized session, but
 * each one is itself a real full-page navigation away and back -- the
 * actual visible flash). Leading cause: iOS/Android's own
 * captive-portal-detection mini-browser periodically re-probes connectivity
 * mid-flow and can reload itself straight back to the original portal URL,
 * outside this app's control.
 *
 * This records *when* (and for which identifier) that POST was last
 * actually submitted, sessionStorage-backed like `session`/`guestIdentifier`
 * above -- a plain `useRef`/module-level flag does NOT survive a real full
 * document reload, exactly what these OS-triggered remounts can be. Read by
 * `portal.success.tsx` as a short cooldown: a remount landing back there
 * within a few seconds of the last real submit skips the redundant POST
 * entirely and goes straight to `/portal/session` instead, rather than
 * firing another one. Deliberately a cooldown, not a permanent flag -- a
 * real WiFi reconnect (real incident #4/#5, see portal.index.tsx) needs
 * this POST to genuinely re-fire, and that happens on the timescale of a
 * guest physically reconnecting, not a sub-10-second OS bounce. */
interface PersistedHotspotSubmit {
  identifier: string;
  at: number;
}

function loadPersistedHotspotSubmit(): PersistedHotspotSubmit | undefined {
  const raw = safeGet(HOTSPOT_SUBMIT_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PersistedHotspotSubmit;
  } catch {
    return undefined;
  }
}

/** Best-effort: when storage is unavailable (see `safeSet`) the cooldown
 * simply never triggers, so an OS-triggered remount re-fires a harmless
 * duplicate hotspot POST. That is strictly better than the alternative
 * this function used to cause -- throwing on the line before
 * `submitHotspotLogin`, so the gate-opening POST never fired at all. */
function persistHotspotSubmit(v: PersistedHotspotSubmit) {
  safeSet(HOTSPOT_SUBMIT_STORAGE_KEY, JSON.stringify(v));
}

interface PortalRuntimeState {
  organizationId: string;
  locationId: string;
  routerId: string;
  deviceMac?: string;
  /** RouterOS's `$(ip)` substitution -- the guest's real LAN IP, threaded
   * through to the login calls as `ip_address` so a dynamic bandwidth
   * queue targets an address that actually exists on this router. See
   * `routes/portal.tsx`'s `searchSchema.ip` doc comment for the full
   * "why" (a queue rule bound to the wrong address enforces nothing). */
  deviceIp?: string;
  destinationUrl?: string;
  /** RouterOS's `$(link-login-only)` substitution -- the URL this guest's
   * browser must POST username/password to for the NAS itself to actually
   * grant network access. Our own backend login (OTP/password/voucher)
   * only ever creates a GuestSession in this platform's own database; it
   * never told the router anything, so the hotspot's own gate stayed shut
   * even after a "successful" login here (confirmed live). Optional --
   * absent for any NAS/flow that doesn't use this mechanism (e.g. a
   * RADIUS-authorized device that never reaches this portal at all). */
  hotspotLoginUrl?: string;
  config?: RuntimePortalConfig;
  isLoading: boolean;
  error?: Error;
  /** True only for the admin-facing Portal Preview
   * (src/routes/preview.portal.$locationId.tsx), which renders the exact
   * real GuestSignInCard/PortalShell for visual fidelity but has no real
   * router/device behind it -- GuestSignInCard checks this before calling
   * any real login endpoint, showing a "preview mode" notice instead. */
  previewMode: boolean;
  /** True only for the prospect-facing DEMO portal
   * (src/routes/preview.portal.demo.tsx). Distinct from `previewMode`: where
   * `previewMode` short-circuits every sign-in action with a "connect a real
   * device" notice (an operator confirming visuals, no working flow), a
   * `demoMode` sign-in runs a believable DUMMY end-to-end flow entirely
   * client-side -- identifier -> OTP -> a fake in-memory RuntimeSession set
   * via `setSession`, landing on a self-contained "You're connected" screen.
   * No network, no SMS/RADIUS, no NAS POST, no navigation. `useGuestSignIn`
   * checks this BEFORE the `previewMode` guards so a demo advances the state
   * machine instead of toasting. The two flags are never set together. */
  demoMode: boolean;
  language: RuntimeLanguage;
  setLanguage: (l: RuntimeLanguage) => void;
  t: (key: string) => string;
  highContrast: boolean;
  largeText: boolean;
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
  selectedMethod?: RuntimeAuthMethod;
  setSelectedMethod: (m?: RuntimeAuthMethod) => void;
  otpTarget?: string;
  setOtpTarget: (v?: string) => void;
  session?: RuntimeSession;
  setSession: (s?: RuntimeSession) => void;
  /** The real identifier (phone/email, normalized the same way the login
   * call itself sent it) this guest just proved ownership of via OTP/
   * password/voucher -- NOT the same thing as `session.guestId` (an
   * internal UUID). Real incident: the hotspot login POST
   * (portal.success.tsx) used to send a hardcoded shared username
   * ("guest") regardless of who actually logged in -- harmless against a
   * hotspot profile with `use-radius=no` (checks a local user list), but
   * every `use-radius=yes` profile's RADIUS Authorize
   * (`RadiusService.authorize`) checks whether *this exact username* has
   * a currently-active GuestSession, so a hardcoded "guest" that has no
   * session of its own always got rejected -- silently, since RADIUS has
   * no "why" in its reply, just accept/reject. Persisted the same way
   * `session` is (survives the real top-level navigation to the NAS and
   * back), since that's exactly when it's needed. */
  guestIdentifier?: string;
  setGuestIdentifier: (v?: string) => void;

  /** DPDP Act 2023 §6-driven, and distinct from `requiresTermsLink`'s
   * implied-consent sentence: that sentence covers accepting the Terms &
   * Acceptable Use Policy (contract formation, where a "by continuing you
   * agree" clickwrap tied to a real submit action is standard practice),
   * NOT consent to the personal-data collection this same submit is about
   * to trigger (phone/email for OTP delivery, MAC/IP, session data --
   * DEFAULT_SECTIONS in portal.terms.tsx names exactly this set). DPDP's
   * consent standard is "free, specific, informed, unconditional,
   * unambiguous, given through clear affirmative action" and explicitly
   * rejects inferring it from inaction or from a bundled acceptance of
   * general terms -- so this is a real, separate, unticked-by-default
   * checkbox a guest must actively tap, not folded into the terms text.
   * Plain component state, not sessionStorage-backed: unlike `session`/
   * `guestIdentifier` this never needs to survive the real top-level
   * navigation to the NAS, and a guest returning to this screen on a new
   * visit should see it unticked again rather than a stale prior answer. */
  dataConsentAccepted: boolean;
  setDataConsentAccepted: (v: boolean) => void;
  /** Which kind of contact detail the guest was refused on, set only on
   * the way to `/portal/not-listed` (whitelist-only refusal).
   *
   * That screen has to name the thing the guest typed -- "try a different
   * number" is simply wrong for someone who signed in with email OTP, and
   * a refusal screen is the last place to be vague about what to do next.
   * The kind is known at the moment of refusal (`useGuestSignIn`'s
   * `otpChannel`) and nowhere afterwards, because a refused guest never
   * gets a session or a `guestIdentifier` to infer it from.
   *
   * Plain component state, not sessionStorage-backed, for the same reason
   * `dataConsentAccepted` above is: it never needs to survive the
   * top-level navigation to the NAS, and a guest coming back for a fresh
   * attempt should not inherit a stale answer. Undefined -- the state on
   * any direct hit of the URL -- makes the screen fall back to "number",
   * which is the overwhelmingly common case (`otp_sms_enabled`). */
  refusedContactKind?: "phone" | "email";
  setRefusedContactKind: (v?: "phone" | "email") => void;
}

const Ctx = createContext<PortalRuntimeState | null>(null);

interface Props {
  organizationId: string;
  locationId: string;
  routerId: string;
  deviceMac?: string;
  /** RouterOS's `$(ip)` substitution -- the guest's real LAN IP, threaded
   * through to the login calls as `ip_address` so a dynamic bandwidth
   * queue targets an address that actually exists on this router. See
   * `routes/portal.tsx`'s `searchSchema.ip` doc comment for the full
   * "why" (a queue rule bound to the wrong address enforces nothing). */
  deviceIp?: string;
  destinationUrl?: string;
  hotspotLoginUrl?: string;
  children: ReactNode;
  /** Preview-mode support (src/routes/preview.portal.$locationId.tsx) --
   * see PortalRuntimeState.previewMode's own docstring. */
  previewMode?: boolean;
  /** Demo-mode support (src/routes/preview.portal.demo.tsx) -- see
   * PortalRuntimeState.demoMode's own docstring. Distinct from `previewMode`
   * and never set alongside it. */
  demoMode?: boolean;
  /** When provided (even `null`), used as the resolved config directly
   * instead of this provider's own `GET /captive-portal/resolve` fetch --
   * lets a caller that already has a richer, org-branding-merged version
   * (usePortalPreview) feed it in without a redundant, less complete
   * second fetch. `presetConfigLoading` mirrors that caller's own loading
   * state while its fetch is still in flight. */
  presetConfig?: RuntimePortalConfig | null;
  presetConfigLoading?: boolean;
}

export function PortalRuntimeProvider({
  organizationId,
  locationId,
  routerId,
  deviceMac,
  deviceIp,
  destinationUrl,
  hotspotLoginUrl,
  previewMode = false,
  demoMode = false,
  presetConfig,
  presetConfigLoading,
  children,
}: Props) {
  const hasPreset = presetConfig !== undefined;
  const {
    data: fetchedConfig,
    isLoading: fetchIsLoading,
    error,
  } = useQuery({
    queryKey: ["portal-runtime-config", organizationId, locationId],
    queryFn: () => portalRuntimeService.resolveConfig({ organizationId, locationId }),
    staleTime: 60_000,
    retry: false,
    enabled: !hasPreset,
  });
  const config = hasPreset ? (presetConfig ?? undefined) : fetchedConfig;
  const isLoading = hasPreset ? !!presetConfigLoading : fetchIsLoading;

  // Deliberately NOT seeded from localStorage in the initial state (that
  // used to be `useState(() => loadPersistedLanguage())`). A lazy
  // `useState` initializer runs during the very first render on BOTH sides
  // -- server (no `window`, so `loadPersistedLanguage()` always returned
  // `undefined` there -> "en") and the client's own first hydration render
  // (real `window`, so it read the guest's actual persisted value straight
  // away, in-render). Those two first renders producing different text
  // for every `t(...)` call is a textbook SSR/CSR hydration mismatch
  // (React error #418) -- confirmed live on `/portal/expired`, reproduced
  // intermittently there (only on the loads where a persisted language
  // happened to differ from the server's unconditional "en" fallback) even
  // with `cg_portal_lang` cleared for one repro pass, which just meant that
  // pass's SSR default itself matched, not that this code path was clean.
  // Same root cause the earlier build-time audit flagged separately as "a
  // pre-existing SSR/hydration-mismatch in the language-persistence
  // mechanism" -- not a distinct bug. Starting `undefined` here keeps the
  // client's first hydration render identical to the server's (both fall
  // through to the "en" default below), then the effect further down
  // applies the real persisted value (or `config.defaultLanguage` on a
  // first-ever visit) immediately after mount -- same standard fix as
  // React's own hydration-mismatch guidance for browser-only storage reads.
  const [language, setLanguageState] = useState<RuntimeLanguage | undefined>(undefined);

  const setLanguage = useCallback((l: RuntimeLanguage) => {
    setLanguageState(l);
    persistLanguage(l);
  }, []);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<RuntimeAuthMethod | undefined>();
  const [otpTarget, setOtpTarget] = useState<string | undefined>();
  const [session, setSessionState] = useState<RuntimeSession | undefined>(() =>
    loadPersistedSession(),
  );
  const [guestIdentifier, setGuestIdentifierState] = useState<string | undefined>(() =>
    loadPersistedIdentifier(),
  );
  const [dataConsentAccepted, setDataConsentAccepted] = useState(false);
  const [refusedContactKind, setRefusedContactKind] = useState<"phone" | "email" | undefined>();

  const setSession = useCallback((s: RuntimeSession | undefined) => {
    setSessionState(s);
    persistSession(s);
  }, []);

  const setGuestIdentifier = useCallback((v: string | undefined) => {
    setGuestIdentifierState(v);
    persistIdentifier(v);
  }, []);

  // Applies a returning guest's persisted language choice right after
  // mount -- see the `useState` above for why this can't happen during
  // the initial render itself. Runs once; a real language *switch* still
  // goes through `setLanguage` (state + persist together), this only ever
  // reads. See the effect right below for how this stays race-free against
  // the config-default effect regardless of which one actually runs first.
  useEffect(() => {
    // URL first, storage second. A `?lang=` is THIS session's own explicit
    // choice, put there moments ago by `buildSessionUrl` and carried across
    // the NAS redirect by the navigation itself; a stored value may be from
    // a visit months back. It is also the only one of the two that exists at
    // all on iOS's CNA, where `loadPersistedLanguage` can only ever return
    // `undefined` because the write that would have populated it threw.
    // Re-persisted best-effort so the choice survives later reloads on every
    // browser where storage does work.
    const fromUrl = readLanguageFromUrl();
    if (fromUrl) {
      setLanguageState(fromUrl);
      persistLanguage(fromUrl);
      return;
    }
    const persisted = loadPersistedLanguage();
    if (persisted) setLanguageState(persisted);
  }, []);

  useEffect(() => {
    // Also re-checks localStorage directly (not just the `language` state)
    // so this can never race the persisted-language effect above and stomp
    // a returning guest's real choice with the location's default -- both
    // effects can fire in the same commit (e.g. `presetConfig` supplies a
    // config synchronously on the very first render), and effects in one
    // commit see each other's *pre-update* closure values, not each
    // other's dispatched updates.
    // `readLanguageFromUrl()` is re-checked here for the same reason
    // `loadPersistedLanguage()` is: both effects can fire in the same commit
    // and would otherwise see each other's pre-update closure values.
    if (config && !language && !readLanguageFromUrl() && !loadPersistedLanguage())
      setLanguage(config.defaultLanguage);
  }, [config, language]);

  /* Clamps the resolved language to what this venue actually offers.
   *
   * Both inputs above outlive the config they were chosen under: a stored
   * `cg_portal_lang` can be months old, and a `?lang=` can be hand-edited or
   * come from a bookmarked link to a different venue. Without this, a guest
   * carrying `hi` into an English-only venue got a Hindi portal whose
   * switcher listed only "English" -- so the one control that sets the
   * language could not undo it. Runs only once `config` is present, and only
   * when the current language is genuinely absent from the supported set, so
   * it never fights the two effects above in the normal case.
   *
   * `supportedLanguages` is guaranteed non-empty and duplicate-free by
   * `resolveLanguageSelection` (types/portal-runtime.ts), so `[0]` is always
   * a real language -- this does not need its own "en" fallback. */
  useEffect(() => {
    if (!config || !language) return;
    if (config.supportedLanguages.includes(language)) return;
    setLanguage(config.defaultLanguage);
  }, [config, language, setLanguage]);

  const resolvedLanguage = language ?? "en";

  // `<html lang>` only. The `dir` toggle that used to sit here went with
  // Arabic -- all ten languages the portal now ships are LTR, so the
  // assignment could only ever have written "ltr"; see portal-i18n.ts's
  // "RTL SUPPORT WAS REMOVED HERE" note for the full argument and for what
  // to reinstate if an RTL language is ever added. `lang` still matters and
  // still updates on every switch: it is what tells a screen reader which
  // pronunciation rules to use, and what lets the browser pick the correct
  // script-specific face out of PG_FONT_STACK's Noto families for the
  // several scripts (e.g. Devanagari shared by hi and mr) where more than
  // one language maps to the same block.
  useEffect(() => {
    document.documentElement.lang = resolvedLanguage;
  }, [resolvedLanguage]);

  useEffect(() => {
    if (!config) return;

    // captive-portal-v6-design-spec.md §3.3.5 -- extends this same effect
    // (not a new Context/Provider, not a second effect) to also load the
    // curated heading font, conditionally: a `system`-choice venue (still
    // the default, and every venue until an admin picks otherwise) hits
    // neither branch below, so it downloads zero extra bytes and injects
    // zero extra tags -- §3.4's "no venue pays for a font it didn't choose"
    // stays literally true, not just true in the common case.
    const face =
      config.guestFontChoice !== "system" ? GUEST_FONT_FACES[config.guestFontChoice] : null;

    let link: HTMLLinkElement | null = null;
    if (face) {
      // Same-origin only (§3.3.1) -- `face.woff2Path` is always this app's
      // own `/fonts/portal/*.woff2` static asset, never a third-party CDN
      // URL. `crossOrigin` is required for a font `<link rel=preload>`
      // regardless of same-origin-ness (fonts are always fetched in CORS
      // mode) -- omitting it silently makes the preload not match the
      // actual @font-face fetch, defeating the whole point of preloading.
      link = document.createElement("link");
      link.rel = "preload";
      link.as = "font";
      link.type = "font/woff2";
      link.crossOrigin = "anonymous";
      link.href = face.woff2Path;
      link.setAttribute("data-portal-runtime-font", "1");
      document.head.appendChild(link);
    }

    const style = document.createElement("style");
    style.setAttribute("data-portal-runtime", "1");
    style.textContent = `
      .portal-runtime {
        --pr-primary: ${config.primaryColor};
        --pr-accent: ${config.secondaryColor};
        --pr-bg-from: ${config.primaryColor};
        --pr-bg-to: ${config.secondaryColor};
        --pr-primary-foreground: ${accessibleForeground(config.primaryColor)};
        --pr-radius: 18px;
      }
      ${
        face
          ? `
      @font-face {
        font-family: "${face.fontFamily}";
        src: url("${face.woff2Path}") format("woff2");
        font-weight: 700;
        font-style: normal;
        /* §3.3.3 -- optional, not swap: on this surface's actual operating
         * environment (a flaky pre-auth connection), a font that isn't
         * ready within the browser's short block period simply never
         * swaps in for that render. No FOIT, no jank, no dependency on the
         * network cooperating -- the fallback (PG_FONT_STACK) is not a
         * degraded state, it's today's already-shipped visual. */
        font-display: optional;
        /* §3.3.4 -- metric-matched overrides so the heading's box
         * height/baseline are identical whether or not the swap happens;
         * see src/lib/portal-guest-fonts.ts's own doc comment for how
         * these were computed (real font metrics, not eyeballed). */
        ascent-override: ${face.ascentOverride};
        descent-override: ${face.descentOverride};
        line-gap-override: ${face.lineGapOverride};
        size-adjust: ${face.sizeAdjust};
        /* §3.2 -- an Indic heading's codepoints aren't in this range,
         * so the browser's own per-character fallback sends them straight
         * to the Noto Sans <script> / "Nirmala UI" entries of
         * PG_FALLBACK_FONT_STACK below instead of this curated face, by
         * design, not by accident. This holds unchanged for all nine
         * non-English languages: the range is Latin + typographic
         * punctuation only, and Devanagari (hi, mr), Bengali (bn),
         * Gujarati (gu), Gurmukhi (pa), Kannada (kn), Malayalam (ml),
         * Tamil (ta) and Telugu (te) are each entirely outside it, so a
         * venue that picks a curated heading face still gets a correct
         * -- just not curated -- heading in every one of them. */
        unicode-range: ${GUEST_FONT_UNICODE_RANGE};
      }
      .portal-runtime {
        --pg-display-font-family: "${face.fontFamily}", ${PG_FALLBACK_FONT_STACK};
      }
      `
          : ""
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
      link?.remove();
    };
  }, [config]);

  const t = useCallback((key: string) => translate(resolvedLanguage, key), [resolvedLanguage]);

  const value = useMemo<PortalRuntimeState>(
    () => ({
      organizationId,
      locationId,
      routerId,
      deviceMac,
      deviceIp,
      destinationUrl,
      hotspotLoginUrl,
      previewMode,
      demoMode,
      config,
      isLoading,
      error: error as Error | undefined,
      language: resolvedLanguage,
      setLanguage,
      t,
      highContrast,
      largeText,
      toggleHighContrast: () => setHighContrast((v) => !v),
      toggleLargeText: () => setLargeText((v) => !v),
      selectedMethod,
      setSelectedMethod,
      otpTarget,
      setOtpTarget,
      session,
      setSession,
      guestIdentifier,
      setGuestIdentifier,
      dataConsentAccepted,
      setDataConsentAccepted,
      refusedContactKind,
      setRefusedContactKind,
    }),
    [
      organizationId,
      locationId,
      routerId,
      deviceMac,
      deviceIp,
      destinationUrl,
      hotspotLoginUrl,
      previewMode,
      demoMode,
      config,
      isLoading,
      error,
      resolvedLanguage,
      t,
      highContrast,
      largeText,
      selectedMethod,
      otpTarget,
      session,
      setSession,
      guestIdentifier,
      setGuestIdentifier,
      dataConsentAccepted,
      refusedContactKind,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export {
  loadPersistedRuntimeIds,
  persistRuntimeIds,
  loadPersistedHotspotSubmit,
  persistHotspotSubmit,
};
export type { PersistedRuntimeIds, PersistedHotspotSubmit };

export function usePortalRuntime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortalRuntime must be used inside PortalRuntimeProvider");
  return ctx;
}

/** Same context, but `null` instead of a throw when there is no provider
 * above -- for the shared guest-flow *presentation* components, which are
 * deliberately reusable outside a mounted runtime.
 *
 * This is not hypothetical. `portal.tsx`'s `IncompletePortalLinkError`
 * renders `<PortalCard>` from a route that has not resolved an organization
 * or location yet, so it is genuinely outside `PortalRuntimeProvider`; the
 * comment above that component even calls out that `PortalCard` "has no such
 * dependency" as the reason it is safe to reuse there. When `PortalCard`
 * gained its v7 adaptive card edge it needed to read the resolved config,
 * and reading it through the throwing hook would have turned that error
 * screen into a blank crash -- a strictly worse failure than the one it
 * exists to report. A presentation component asking "is there a runtime, and
 * if so what does it say?" is a real question with a real `null` answer;
 * `usePortalRuntime` stays throwing for everything that genuinely requires
 * the provider. */
export function usePortalRuntimeOptional() {
  return useContext(Ctx);
}
