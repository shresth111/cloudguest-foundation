import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type {
  RuntimeAuthMethod,
  RuntimeLanguage,
  RuntimePortalConfig,
  RuntimeSession,
} from "@/types/portal-runtime";
import { RTL_LANGS, translate } from "@/lib/portal-i18n";

interface PortalRuntimeState {
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

export function PortalRuntimeProvider({ children }: { children: ReactNode }) {
  const { data: config, isLoading, error } = useQuery({
    queryKey: ["portal-runtime-config"],
    queryFn: () => portalRuntimeService.getConfig(),
    staleTime: Infinity,
  });

  const [language, setLanguage] = useState<RuntimeLanguage>("en");
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<RuntimeAuthMethod | undefined>();
  const [otpTarget, setOtpTarget] = useState<string | undefined>();
  const [session, setSession] = useState<RuntimeSession | undefined>();
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (config && !language) setLanguage(config.defaultLanguage);
  }, [config, language]);

  useEffect(() => {
    const root = document.documentElement;
    root.dir = RTL_LANGS.includes(language) ? "rtl" : "ltr";
    root.lang = language;
    return () => {
      root.dir = "ltr";
    };
  }, [language]);

  useEffect(() => {
    if (!config) return;
    const style = document.createElement("style");
    style.setAttribute("data-portal-runtime", "1");
    style.textContent = `
      .portal-runtime {
        --pr-primary: ${config.brand.primaryColor};
        --pr-accent: ${config.brand.accentColor};
        --pr-bg-from: ${config.brand.backgroundFrom};
        --pr-bg-to: ${config.brand.backgroundTo};
        --pr-radius: ${config.brand.radius}px;
        font-family: ${config.brand.fontFamily};
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [config]);

  const t = useCallback((key: string) => translate(language, key), [language]);

  const value = useMemo<PortalRuntimeState>(
    () => ({
      config,
      isLoading,
      error: error as Error | undefined,
      language,
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
    [config, isLoading, error, language, t, highContrast, largeText, selectedMethod, otpTarget, session, termsAccepted],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortalRuntime() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortalRuntime must be used inside PortalRuntimeProvider");
  return ctx;
}
