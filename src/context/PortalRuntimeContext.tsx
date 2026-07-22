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

interface PortalRuntimeState {
  organizationId: string;
  locationId: string;
  routerId: string;
  config?: RuntimePortalConfig;
  isLoading: boolean;
  error?: Error;
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
}

const Ctx = createContext<PortalRuntimeState | null>(null);

interface Props {
  organizationId: string;
  locationId: string;
  routerId: string;
  children: ReactNode;
}

export function PortalRuntimeProvider({ organizationId, locationId, routerId, children }: Props) {
  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["portal-runtime-config", organizationId, locationId],
    queryFn: () => portalRuntimeService.resolveConfig({ organizationId, locationId }),
    staleTime: 60_000,
    retry: false,
  });

  const [language, setLanguage] = useState<RuntimeLanguage | undefined>();
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<RuntimeAuthMethod | undefined>();
  const [otpTarget, setOtpTarget] = useState<string | undefined>();
  const [session, setSessionState] = useState<RuntimeSession | undefined>(() =>
    loadPersistedSession(),
  );
  const [termsAccepted, setTermsAccepted] = useState(false);

  const setSession = useCallback((s: RuntimeSession | undefined) => {
    setSessionState(s);
    persistSession(s);
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
    }),
    [
      organizationId,
      locationId,
      routerId,
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
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortalRuntime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortalRuntime must be used inside PortalRuntimeProvider");
  return ctx;
}
