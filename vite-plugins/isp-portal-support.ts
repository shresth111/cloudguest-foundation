/**
 * Build-time hook for `src/lib/isp-partner/portal-support.ts` (QA-021).
 *
 * When, and only when, the build has `VITE_ISP_PARTNER_ENABLED=true`, it
 * rewrites exactly one JSX expression in
 * `src/components/portal-runtime/PortalShell.tsx`:
 *
 *   <span>{t("supportAskStaff")}</span>
 *
 * becomes
 *
 *   <span><__IspPortalSupport fallback={t("supportAskStaff")} /></span>
 *
 * plus one import, appended at the end of the module so the source's line
 * numbers are unchanged (ESM imports are hoisted). With the flag off the hook
 * returns null for every module, so the bundle is byte-identical to a build
 * without this plugin. If the expression is not found (the footer changed),
 * the module is left untouched and the build prints a warning: the worst case
 * is the old footer, never a broken build.
 */
import type { Plugin } from "vite";

export const SUPPORT_TARGET = /[\\/]src[\\/]components[\\/]portal-runtime[\\/]PortalShell\.tsx$/;
export const SUPPORT_EXPRESSION = '<span>{t("supportAskStaff")}</span>';
const REPLACEMENT = '<span><__IspPortalSupport fallback={t("supportAskStaff")} /></span>';
const IMPORT =
  '\nimport { IspPortalSupport as __IspPortalSupport } from "@/components/isp-partner/portal/IspPortalSupport";\n';

export function flagOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.VITE_ISP_PARTNER_ENABLED === "true";
}

export function transformPortalSupport(code: string): string | null {
  const first = code.indexOf(SUPPORT_EXPRESSION);
  if (first < 0 || code.indexOf(SUPPORT_EXPRESSION, first + 1) >= 0) return null;
  return code.replace(SUPPORT_EXPRESSION, REPLACEMENT) + IMPORT;
}

export function ispPortalSupport(env: Record<string, string | undefined> = process.env): Plugin {
  const enabled = flagOn(env);
  return {
    name: "isp-portal-support",
    enforce: "pre",
    transform(code, id) {
      if (!enabled) return null;
      if (!SUPPORT_TARGET.test(id.split("?")[0])) return null;
      const out = transformPortalSupport(code);
      if (out === null) {
        this.warn("portal footer support expression not found; ISP support line inactive");
        return null;
      }
      return { code: out, map: null };
    },
  };
}
