/**
 * Founder ask (2026-10-24): the partner console's router setup script carries
 * the TR-069 step at its END when that location's TR-069 is on, so one paste
 * does both. The step installs tr069-client itself, and the router may
 * reboot as the very last thing. It comes from `GET /isp/tr069/routers/{id}/script`.
 *
 * `vite-plugins/isp-setup-extra-chunks.ts` wraps the old generator's
 * `buildRouterSetupScriptChunks` at build time, only with
 * VITE_ISP_PARTNER_ENABLED=true, so that its result passes through
 * `ispAppendSetupChunks` below. The old file is not edited. Nothing is
 * appended unless the partner router page registered a chunk on the partner
 * host. With nothing registered, the very same array comes back, so the
 * script, the copy text and the .rsc are byte-identical to today's.
 */
import { isNetworkHost } from "./network-host";

export interface ExtraSetupChunk {
  label: string;
  script: string;
}

export const TR069_CHUNK_LABEL =
  "TR-069 management (installs tr069-client if missing; the router may reboot at the end)";

let registered: readonly ExtraSetupChunk[] = [];

/** Called by the partner router page; [] clears it (on unmount, or when the
 * location's TR-069 is off). */
export function setPartnerSetupExtraChunks(chunks: readonly ExtraSetupChunk[]): void {
  registered = chunks.filter((c) => c.script.trim().length > 0);
}

export function partnerSetupExtraChunks(): readonly ExtraSetupChunk[] {
  return registered;
}

function currentHostname(): string {
  return typeof window !== "undefined" && window.location ? window.location.hostname : "";
}

/** The generator's chunks, plus the registered ones at the END, on the
 * partner host only. Identity (same array) otherwise. */
export function ispAppendSetupChunks<T extends ExtraSetupChunk>(
  chunks: T[],
  hostname: string = currentHostname(),
): T[] {
  if (registered.length === 0 || !hostname || !isNetworkHost(hostname)) return chunks;
  return [...chunks, ...(registered as T[])];
}
