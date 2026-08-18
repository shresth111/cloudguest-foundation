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

export { loadPersistedRuntimeIds, persistRuntimeIds };
export type { PersistedRuntimeIds };

export function usePortalRuntime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortalRuntime must be used inside PortalRuntimeProvider");
  return ctx;
}
