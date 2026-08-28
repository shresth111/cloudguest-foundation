/**
 * Builds a real `.rsc` file out of one phase's paste blocks.
 *
 * This is the primary way the operator should get a `oncePerRouter`
 * phase onto the device, for two independent reasons:
 *
 *  1. It is the only durable copy of secrets that are disclosed exactly
 *     once. A clipboard survives until the next copy; a file survives the
 *     tab closing, the laptop sleeping, and a mis-click on "generate
 *     again".
 *  2. A file upload plus `/import` has no terminal-paste step, so there
 *     is nothing for WinBox/WebFig to corrupt on a long paste -- a
 *     corrupted hotspot line drops the guest sign-in page silently.
 */
import { rscSlug } from "@/lib/rsc-filename";
import { stepNumber } from "./progress";
import type { Phase } from "./types";

export function buildPhaseRsc(phase: Phase, routerName: string): string {
  const stamp = new Date().toISOString();
  const lines = [
    `# Wyfy Guided Setup -- step ${stepNumber(phase)}: ${phase.title}`,
    `# Router: ${routerName}`,
    `# Generated: ${stamp}`,
    "# Upload via WebFig > Files, then run:  /import file=<name>.rsc",
    "",
  ];
  phase.paste.forEach((p, i) => {
    lines.push(`# --- ${i + 1}. ${p.label} ---`, p.script, "");
  });
  return lines.join("\n");
}

export function downloadRsc(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Filesystem-safe, recognisable on a laptop full of downloads -- and
 * safe as a bare `/import file=` parameter, which is the part that
 * actually bites: see `@/lib/rsc-filename` for the live failure that
 * shares this slug rule with the Advanced panel. */
export function rscFilename(routerName: string, phase: Phase): string {
  const slug = rscSlug(routerName || "router");
  return `wyfy-${slug || "router"}-${stepNumber(phase)}-${phase.id}.rsc`;
}
