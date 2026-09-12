/**
 * What changing a fleet row's `vendor` actually does, and how sure we are
 * that the row is a real device rather than a mislabelled placeholder.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-09-10 the vendor `<select>` on the Master console's router screens
 * wrote straight through on `change`: `api.put('/routers/{id}', { vendor })`,
 * no confirmation and no undo. Looking for the TP-Link option, the platform
 * owner relabelled SEVEN real rows as `tplink_omada` -- including the org's
 * live lab MikroTik hEX lite ("Office Guest"). Nothing about any device
 * changed; what changed was this platform's record of it, and that record is
 * load-bearing:
 *
 *   - `RouterSetupDrilldown` swaps the MikroTik script generator for the
 *     Omada controller panel, so the script the venue was built on vanishes;
 *   - `displayStatus` moves the row out of the Online fleet counter and into
 *     "Via controller";
 *   - `isControllerManaged` disables Reboot and every other agent action;
 *   - `routerLivenessIsMeasured` stops measuring last-seen and health, so the
 *     row's liveness silently stops meaning anything.
 *
 * All four are correct behaviour for an actual controller. On a MikroTik they
 * are silent data corruption of a live fleet row, and the audit trail said
 * only `Router 'X' updated` with `{}` metadata -- the database had to be
 * diffed to work out what had happened.
 *
 * Everything here is a pure function on purpose: `scripts/test-vendor-change-guard.mjs`
 * imports these directly and asserts against the real implementation rather
 * than a copy of the rules, which is the only way a guard means anything.
 */
import type { RouterDevice } from "@/types/router";
import { isControllerManaged, routerVendorLabel } from "@/lib/router-vendors";

/**
 * One fact on the row that only the device itself could have put there.
 *
 * `label` is written to be read inside a sentence ("it has reported ...").
 */
export interface AgentEvidence {
  /** The `RouterDevice` field this came from. */
  field: "routerOsVersion" | "lastSeenAt";
  label: string;
  value: string;
}

/**
 * Evidence that this row has, at some point, actually been a MikroTik
 * running this platform's agent.
 *
 * WHICH FIELDS, AND WHY ONLY THESE TWO.
 *
 * `RouterDevice` carries five fields that look like candidates --
 * `routerOsVersion`, `lastSeenAt`, `managementIpAddress`, `publicIpAddress`
 * and `hasApiCredentials`. Only the first two are written *by the device*:
 *
 *   - `routerOsVersion` is written exclusively by the agent's status push.
 *     `RouterAgentService.report_status` calls `update_router` with
 *     `{"routeros_version": ...}` and nothing else in the product sets that
 *     column. A value here means a RouterOS box authenticated as this row
 *     and told us its version. It is the single strongest signal there is.
 *   - `lastSeenAt` is written by `RouterAgentService.heartbeat`. A timestamp
 *     means the device reported in.
 *
 * The other three are admin-entered, not device-reported:
 * `managementIpAddress`/`publicIpAddress` are typed into the create form (the
 * agent can refresh them, but a human can equally have typed them for a box
 * that never came up), and `hasApiCredentials` reflects credentials an
 * operator saved. Treating those as proof would demand typed confirmation for
 * rows that have never been anything but a placeholder, which is how a guard
 * becomes something people learn to click through.
 *
 * Returned as a list rather than a boolean so the dialog can *show its work*
 * -- "it reported RouterOS 7.15.3" is an argument; "this looks important" is
 * not.
 */
export function routerAgentEvidence(router: RouterDevice): AgentEvidence[] {
  const found: AgentEvidence[] = [];
  const version = (router.routerOsVersion ?? "").trim();
  if (version) {
    found.push({ field: "routerOsVersion", label: "reported RouterOS", value: version });
  }
  if (router.lastSeenAt) {
    found.push({ field: "lastSeenAt", label: "last heartbeat", value: router.lastSeenAt });
  }
  return found;
}

/**
 * Whether this change needs the router's name typed out, or only a click.
 *
 * Typed confirmation is reserved for rows with device-reported evidence
 * (above). A row that has never reported in is, as far as anything here can
 * tell, a placeholder someone is still setting up -- correcting its vendor is
 * ordinary work and gets the plain confirm.
 *
 * The typed token is the ROUTER'S OWN NAME rather than a fixed phrase like
 * `DESELECT_PHRASE`'s. That is a deliberate departure, and the incident is
 * the reason: seven rows were relabelled one after another in a single
 * sitting. A constant phrase is muscle memory by the third row; the name
 * changes every time, so the operator has to look at WHICH row they are
 * about to rewrite -- which was the actual thing that went wrong.
 */
export function vendorChangeNeedsTypedName(router: RouterDevice): boolean {
  return routerAgentEvidence(router).length > 0;
}

/**
 * Grades what was typed. Trimmed, and case-folded: the requirement is that
 * they read the name off the row and wrote it, not that they matched a
 * shell's idea of equality.
 *
 * A row with a blank name can never satisfy this, so it returns `false`
 * rather than accepting the empty string -- failing toward "no change" is
 * the safe direction for a guard.
 */
export function typedNameMatches(router: RouterDevice, typed: string): boolean {
  const want = router.name.trim();
  if (!want) return false;
  return typed.trim().toLowerCase() === want.toLowerCase();
}

/** Which of the three genuinely different changes this is. */
export type VendorChangeKind = "to-controller" | "to-agent" | "between-agent";

export function vendorChangeKind(from: string, to: string): VendorChangeKind {
  const wasController = isControllerManaged(from);
  const willBeController = isControllerManaged(to);
  if (!wasController && willBeController) return "to-controller";
  if (wasController && !willBeController) return "to-agent";
  return "between-agent";
}

/**
 * What this platform will do differently, in plain words, once the row says
 * the new vendor.
 *
 * Each line names a consequence that was actually observed in the incident,
 * and each is phrased as a thing that STOPS or STARTS rather than as a
 * warning -- an operator deciding whether to proceed needs the outcome, not
 * an adjective.
 */
export function vendorChangeConsequences(from: string, to: string): string[] {
  const fromLabel = routerVendorLabel(from);
  const toLabel = routerVendorLabel(to);
  switch (vendorChangeKind(from, to)) {
    case "to-controller":
      return [
        `The ${fromLabel} setup script for this router disappears from this screen and is replaced by the ${toLabel} controller panel. The script the venue was built from is no longer offered here.`,
        `Agent actions stop applying. Reboot, provisioning, the WireGuard tunnel and RADIUS are all sent to the router agent, and a controller row is treated as having no agent to send them to.`,
        `It leaves the Online fleet count and is counted under "Via controller" instead.`,
        `Monitoring and liveness stop measuring it. Last seen, health and RouterOS version become permanently blank, because nothing here looks at a controller.`,
        `Nothing about the device itself changes. It keeps running exactly as it is -- this console simply stops managing it.`,
      ];
    case "to-agent":
      return [
        `The ${fromLabel} controller panel disappears and is replaced by the ${toLabel} setup flow.`,
        `This console starts expecting a router agent on the device: reboot, provisioning, the WireGuard tunnel and RADIUS become available and will be sent to it.`,
        `It rejoins the Online/Offline fleet count. A controller sends no heartbeat, so if this really is a controller the row will begin reading as Offline.`,
        `Monitoring and liveness start measuring it, so last seen and health begin making claims about a device that never reports.`,
        `Nothing about the device itself changes. Only this platform's record of it does.`,
      ];
    case "between-agent":
      return [
        `${toLabel} has no setup or provisioning flow yet, so the ${fromLabel} setup script for this router is replaced by a "not supported" panel.`,
        `The row stays agent-managed: it keeps its place in the Online/Offline fleet count, and reboot, provisioning, tunnel and RADIUS still apply.`,
        `Nothing about the device itself changes. Only this platform's record of it does.`,
      ];
  }
}

/** The dialog's one-line statement of the change, old -> new. */
export function vendorChangeSummary(from: string, to: string): string {
  return `${routerVendorLabel(from)} → ${routerVendorLabel(to)}`;
}
