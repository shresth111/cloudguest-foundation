/**
 * Build-time hook for `src/lib/isp-partner/portal-host.ts`.
 *
 * Rewrites exactly one statement in `src/components/routers/RouterDetailTabs.tsx`:
 *
 *   export const GUEST_PORTAL_PUBLIC_BASE = "https://auth.wyfyguest.com";
 *
 * becomes
 *
 *   export const GUEST_PORTAL_PUBLIC_BASE = __ispGuestPortalBase("https://auth.wyfyguest.com");
 *
 * plus one import of `ispGuestPortalBase`, appended at the end of the module so
 * the source's line numbers are unchanged (ESM imports are hoisted). The
 * literal stays the fallback, so the value is unchanged on every host except a
 * test partner host listed in portal-host.ts.
 *
 * If the statement is not found (the constant was renamed or changed), the
 * module is left untouched and the build prints a warning. The worst case is
 * the old behaviour, never a broken build.
 */
import type { Plugin } from "vite";

export const PORTAL_BASE_TARGET = /[\\/]src[\\/]components[\\/]routers[\\/]RouterDetailTabs\.tsx$/;
export const PORTAL_BASE_STATEMENT =
  'export const GUEST_PORTAL_PUBLIC_BASE = "https://auth.wyfyguest.com";';
const REPLACEMENT =
  'export const GUEST_PORTAL_PUBLIC_BASE = __ispGuestPortalBase("https://auth.wyfyguest.com");';
const IMPORT =
  '\nimport { ispGuestPortalBase as __ispGuestPortalBase } from "@/lib/isp-partner/portal-host";\n';

export function transformPortalBase(code: string): string | null {
  if (!code.includes(PORTAL_BASE_STATEMENT)) return null;
  return code.replace(PORTAL_BASE_STATEMENT, REPLACEMENT) + IMPORT;
}

export function ispPortalHost(): Plugin {
  return {
    name: "isp-portal-host",
    enforce: "pre",
    transform(code, id) {
      if (!PORTAL_BASE_TARGET.test(id.split("?")[0])) return null;
      const out = transformPortalBase(code);
      if (out === null) {
        this.warn(
          "GUEST_PORTAL_PUBLIC_BASE statement not found; partner test-portal override inactive",
        );
        return null;
      }
      return { code: out, map: null };
    },
  };
}
