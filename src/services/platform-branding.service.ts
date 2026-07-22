import { DEFAULT_PLATFORM_BRANDING } from "@/config/platform-branding.config";
import type { PlatformBrandingConfig } from "@/types/platform-branding";

/**
 * Platform (Super Admin) branding -- reads/writes a local static config
 * today, not a backend. There is no `platform_branding`-shaped backend
 * domain in backend/app/domains to wire this to yet (the closest relative,
 * captive_portal/organization branding, is customer-scoped, not
 * platform-operator-scoped, and is already served for real by the separate
 * White Label console at src/services/branding.service.ts).
 *
 * Kept as an async, service-shaped module on purpose -- the same call
 * signature a real `GET/PUT /platform/branding` would have -- so switching
 * this to a real backend call later is a body-only change inside these two
 * functions; no consumer (PlatformBrandingProvider, BrandingPanel) needs to
 * change.
 */
let current: PlatformBrandingConfig = DEFAULT_PLATFORM_BRANDING;

export const platformBrandingService = {
  async getConfig(): Promise<PlatformBrandingConfig> {
    return current;
  },

  /**
   * Not persisted anywhere (no localStorage, no backend) -- a page refresh
   * reverts to DEFAULT_PLATFORM_BRANDING. This mirrors BrandingPanel.tsx's
   * disabled Save button: editing here is a live in-session preview of the
   * future real flow, not a durable settings change yet.
   */
  async previewConfig(patch: Partial<PlatformBrandingConfig>): Promise<PlatformBrandingConfig> {
    current = { ...current, ...patch };
    return current;
  },
};
