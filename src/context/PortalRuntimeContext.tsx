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
import { RTL_LANGS, translate } from "@/lib/portal-i18n";

const SESSION_STORAGE_KEY = "cloudguest_portal_session";
const IDENTIFIER_STORAGE_KEY = "cloudguest_portal_identifier";
const HOTSPOT_LOGIN_URL_STORAGE_KEY = "cloudguest_portal_hotspot_login_url";

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

function loadPersistedHotspotLoginUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage.getItem(HOTSPOT_LOGIN_URL_STORAGE_KEY) ?? undefined;
}

function persistHotspotLoginUrl(url: string | undefined) {
  if (typeof window === "undefined") return;
  if (url) window.sessionStorage.setItem(HOTSPOT_LOGIN_URL_STORAGE_KEY, url);
  else window.sessionStorage.removeItem(HOTSPOT_LOGIN_URL_STORAGE_KEY);
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
   * RADIUS-authorized device that never reaches this portal at all).
   *
   * Real incident #3: unlike `session`/`guestIdentifier`, this used to be a
   * pure pass-through of the current URL's `link-login-only` search param
   * -- nothing persisted it. A confirmed-live case (OTP verified, a real
   * GuestSession created server-side, yet RouterOS's own hotspot log shows
   * *zero* login attempts for that device) traced back to exactly this: any
   * full top-level reload that lands back on a /portal/* route with a URL
   * missing (or carrying a stale/cached) `link-login-only` -- e.g. macOS's
   * Captive Network Assistant, which is known to cache/reuse a captive
   * portal URL per network and can reissue a request against an earlier,
   * incomplete version of it -- silently drops this value while `session`/
   * `guestIdentifier` (sessionStorage-backed) survive the same reload
   * intact. `portal.success.tsx`'s gate (`if (!hotspotLoginUrl) return`)
   * then no-ops forever: no error, no redirect, just a guest stuck on
   * "Connecting you to the internet…" with a real backend session and zero
   * real network access. Now sessionStorage-backed the same way `session`
   * is: the live URL param always wins when present (a fresh NAS redirect
   * is always the most trustworthy source), and only a *missing* current
   * param falls back to the last-seen value for this tab. */
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

  const [language, setLanguage] = useState<RuntimeLanguage | undefined>();
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
  // See PortalRuntimeState.hotspotLoginUrl's own docstring (real incident
  // #3) -- the `link-login-only` URL search param always wins when
  // present; this is only the last-seen fallback for a reload that lands
  // back here without it.
  const [persistedHotspotLoginUrl, setPersistedHotspotLoginUrl] = useState<string | undefined>(
    () => loadPersistedHotspotLoginUrl(),
  );
  useEffect(() => {
    if (!hotspotLoginUrl) return;
    setPersistedHotspotLoginUrl(hotspotLoginUrl);
    persistHotspotLoginUrl(hotspotLoginUrl);
  }, [hotspotLoginUrl]);
  const resolvedHotspotLoginUrl = hotspotLoginUrl ?? persistedHotspotLoginUrl;

  const setSession = useCallback((s: RuntimeSession | undefined) => {
    setSessionState(s);
    persistSession(s);
  }, []);

  const setGuestIdentifier = useCallback((v: string | undefined) => {
    setGuestIdentifierState(v);
    persistIdentifier(v);
  }, []);

  useEffect(() => {
    if (config && !language) setLanguage(config.defaultLanguage);
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
      hotspotLoginUrl: resolvedHotspotLoginUrl,
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
      resolvedHotspotLoginUrl,
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

export function usePortalRuntime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortalRuntime must be used inside PortalRuntimeProvider");
  return ctx;
}
