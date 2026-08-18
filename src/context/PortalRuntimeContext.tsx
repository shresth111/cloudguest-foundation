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
import { RTL_LANGS, translate, loadPersistedLanguage, persistLanguage } from "@/lib/portal-i18n";

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

function loadPersistedRuntimeIds(): PersistedRuntimeIds | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(RUNTIME_IDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedRuntimeIds) : undefined;
  } catch {
    return undefined;
  }
}

function persistRuntimeIds(ids: PersistedRuntimeIds) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(RUNTIME_IDS_STORAGE_KEY, JSON.stringify(ids));
}

function loadPersistedSession(): RuntimeSession | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RuntimeSession) : undefined;
  } catch {
    return undefined;
  }
}

function persistSession(session: RuntimeSession | undefined) {
  if (typeof window === "undefined") return;
  if (session) window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function loadPersistedIdentifier(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage.getItem(IDENTIFIER_STORAGE_KEY) ?? undefined;
}

function persistIdentifier(identifier: string | undefined) {
  if (typeof window === "undefined") return;
  if (identifier) window.sessionStorage.setItem(IDENTIFIER_STORAGE_KEY, identifier);
  else window.sessionStorage.removeItem(IDENTIFIER_STORAGE_KEY);
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
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(HOTSPOT_SUBMIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedHotspotSubmit) : undefined;
  } catch {
    return undefined;
  }
}

function persistHotspotSubmit(v: PersistedHotspotSubmit) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(HOTSPOT_SUBMIT_STORAGE_KEY, JSON.stringify(v));
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
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [guestIdentifier, setGuestIdentifierState] = useState<string | undefined>(() =>
    loadPersistedIdentifier(),
  );

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
    if (config && !language && !loadPersistedLanguage()) setLanguage(config.defaultLanguage);
  }, [config, language]);

  const resolvedLanguage = language ?? "en";

  useEffect(() => {
    const root = document.documentElement;
    root.dir = RTL_LANGS.includes(resolvedLanguage) ? "rtl" : "ltr";
    root.lang = resolvedLanguage;
    return () => {
      root.dir = "ltr";
    };
  }, [resolvedLanguage]);

  useEffect(() => {
    if (!config) return;
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
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
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
      termsAccepted,
      setTermsAccepted,
      guestIdentifier,
      setGuestIdentifier,
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
      termsAccepted,
      guestIdentifier,
      setGuestIdentifier,
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
