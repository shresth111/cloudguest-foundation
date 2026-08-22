import type { Phase } from "./types";

/**
 * Which Master-console chunks a phase needs pasted BEFORE its own
 * universal blocks, keyed by phase id.
 *
 * The content file's `paste` arrays are deliberately universal -- no
 * per-router values -- which is what makes every one of them safe to
 * re-run, and what makes the "Nahi -> fix -> check again" loop work
 * without ever regenerating anything. The per-router half (the three IDs
 * baked into the portal redirect URL, the WireGuard keypair, the RADIUS
 * secret) can only come from the generator, so these three phases are
 * gap-fillers sitting on top of a generated chunk.
 *
 * This mapping lives here, in the UI, rather than in the content file:
 * it is a fact about the Master console's own chunk labels, and those
 * labels belong to `buildRouterSetupScriptChunks`, not to the guided
 * script text. Labels are matched by eye by the operator, so they are
 * written here exactly as that generator emits them.
 */
export const GENERATED_CHUNKS: Record<string, { labels: string[]; carriesSecrets: boolean }> = {
  hotspot: {
    labels: ["LAN IP + DNS", "Hotspot"],
    carriesSecrets: false,
  },
  portal: {
    labels: [
      "Walled Garden (let unauthenticated guests reach the portal)",
      "Walled Garden IP (let unauthenticated guests reach the portal over HTTPS)",
      "Portal Redirect Page (login.html)",
      "Portal Redirect Page (rlogin.html)",
      "Portal Redirect Page (alogin.html)",
      "Portal Redirect Page (status.html)",
      "Portal Redirect Page (logout.html)",
    ],
    carriesSecrets: false,
  },
  tunnel: {
    labels: [
      "WireGuard Tunnel",
      "RADIUS",
      "API Access (unlocks Device Console)",
      "Heartbeat (reports management + WAN1 IP)",
    ],
    carriesSecrets: true,
  },
};

/** Phases whose own `paste` array is only half the story -- see
 * `GENERATED_CHUNKS`. Kept in this plain module rather than beside the
 * component so that file exports components only (react-refresh keeps
 * working across edits). */
export function phaseNeedsGeneratedChunk(phaseId: Phase["id"]): boolean {
  return phaseId in GENERATED_CHUNKS;
}
