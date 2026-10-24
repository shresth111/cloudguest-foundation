/**
 * Build-time hook for `src/lib/isp-partner/setup-extra-chunks.ts`.
 *
 * When, and only when, the build has `VITE_ISP_PARTNER_ENABLED=true`, it
 * rewrites ONE line of `src/components/routers/RouterDetailTabs.tsx`:
 *
 *   export function buildRouterSetupScriptChunks(opts: {
 *
 * becomes (on the same line, so line numbers are kept)
 *
 *   export function buildRouterSetupScriptChunks(...args: Parameters<typeof __cgBuildRouterSetupScriptChunks>): RouterSetupScriptChunk[] { return __ispAppendSetupChunks(__cgBuildRouterSetupScriptChunks(...args)); } function __cgBuildRouterSetupScriptChunks(opts: {
 *
 * plus one import, appended at the end of the module. The generator body is
 * untouched. With the flag off the hook returns null for every module, so the
 * bundle is byte-identical. If the line is not found exactly once, the module
 * is left alone and the build warns: the worst case is today's script.
 */
import type { Plugin } from "vite";

export const CHUNKS_TARGET = /[\\/]src[\\/]components[\\/]routers[\\/]RouterDetailTabs\.tsx$/;
export const CHUNKS_SIGNATURE = "export function buildRouterSetupScriptChunks(opts: {";
const REPLACEMENT =
  "export function buildRouterSetupScriptChunks(...args: Parameters<typeof __cgBuildRouterSetupScriptChunks>): RouterSetupScriptChunk[] { return __ispAppendSetupChunks(__cgBuildRouterSetupScriptChunks(...args)); } function __cgBuildRouterSetupScriptChunks(opts: {";
const IMPORT =
  '\nimport { ispAppendSetupChunks as __ispAppendSetupChunks } from "@/lib/isp-partner/setup-extra-chunks";\n';

export function flagOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.VITE_ISP_PARTNER_ENABLED === "true";
}

export function transformSetupChunks(code: string): string | null {
  const first = code.indexOf(CHUNKS_SIGNATURE);
  if (first < 0 || code.indexOf(CHUNKS_SIGNATURE, first + 1) >= 0) return null;
  return code.replace(CHUNKS_SIGNATURE, REPLACEMENT) + IMPORT;
}

export function ispSetupExtraChunks(env: Record<string, string | undefined> = process.env): Plugin {
  const enabled = flagOn(env);
  return {
    name: "isp-setup-extra-chunks",
    enforce: "pre",
    transform(code, id) {
      if (!enabled) return null;
      if (!CHUNKS_TARGET.test(id.split("?")[0])) return null;
      const out = transformSetupChunks(code);
      if (out === null) {
        this.warn("buildRouterSetupScriptChunks signature not found; partner TR-069 step inactive");
        return null;
      }
      return { code: out, map: null };
    },
  };
}
