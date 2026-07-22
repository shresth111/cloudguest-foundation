import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { platformBrandingService } from "@/services/platform-branding.service";
import { DEFAULT_PLATFORM_BRANDING } from "@/config/platform-branding.config";
import type { PlatformBrandingConfig } from "@/types/platform-branding";

interface PlatformBrandingContextValue {
  branding: PlatformBrandingConfig;
  isLoading: boolean;
  /** Live in-session preview only -- see platform-branding.service.ts's docstring. */
  previewBranding: (patch: Partial<PlatformBrandingConfig>) => Promise<void>;
}

const PlatformBrandingContext = createContext<PlatformBrandingContextValue | undefined>(
  undefined,
);

/**
 * Maps brand colors onto this theme's *existing* CSS custom properties
 * (src/styles.css's --primary/--secondary/--accent/--background/--sidebar)
 * rather than inventing new ones. Every Tailwind utility already consuming
 * those vars (bg-primary buttons, bg-sidebar, bg-background navbars/pages,
 * bg-card cards) re-themes automatically -- satisfying "buttons/navbar/
 * cards should reflect branding" without a second, parallel variable set or
 * touching any component that already uses the theme correctly.
 */
function applyCssVariables(branding: PlatformBrandingConfig) {
  const root = document.documentElement.style;
  root.setProperty("--primary", branding.primaryColor);
  root.setProperty("--secondary", branding.secondaryColor);
  root.setProperty("--accent", branding.accentColor);
}

function applyFavicon(faviconUrl: string | null) {
  if (!faviconUrl) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = faviconUrl;
}

export function PlatformBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<PlatformBrandingConfig>(DEFAULT_PLATFORM_BRANDING);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    platformBrandingService.getConfig().then((config) => {
      if (cancelled) return;
      setBranding(config);
      applyCssVariables(config);
      applyFavicon(config.faviconUrl);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const previewBranding = useCallback(async (patch: Partial<PlatformBrandingConfig>) => {
    const next = await platformBrandingService.previewConfig(patch);
    setBranding(next);
    applyCssVariables(next);
    applyFavicon(next.faviconUrl);
  }, []);

  const value = useMemo(
    () => ({ branding, isLoading, previewBranding }),
    [branding, isLoading, previewBranding],
  );

  return (
    <PlatformBrandingContext.Provider value={value}>{children}</PlatformBrandingContext.Provider>
  );
}

export function usePlatformBranding() {
  const ctx = useContext(PlatformBrandingContext);
  if (!ctx) throw new Error("usePlatformBranding must be used within PlatformBrandingProvider");
  return ctx;
}
