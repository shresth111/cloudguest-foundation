/**
 * Router Fleet (Master): what the fleet list says about a row that is NOT
 * measured by this platform -- its warning tag, its status badge, its Last
 * seen and address text, and which summary tile it counts under -- as pure
 * functions, so the NAS-only (Aruba Instant On) rules are testable without
 * rendering the page.
 *
 * Why this exists (live prod test, 2026-10-02): the Aruba row "Aruba AP21
 * VNV5M1K1M6" rendered "Via controller" + a red "No integration". Both were
 * wrong. An Instant On venue is not reached through a controller, and it has
 * no `network_integrations` row BY DESIGN (API_CONTRACT: "no
 * `network_integrations` row ever"; PM_SPEC §2.1: "Aruba has no integration
 * row ... Don't add a stub"). Telling ops it has "No integration" sends them
 * to connect something that can never exist.
 *
 * Omada (and any other controller-managed vendor) is unchanged: every branch
 * below that is not NAS-only returns exactly what `master.routers.tsx` used
 * to compute inline.
 */
import type { NetworkIntegration } from "@/types/network-integration";
import { deriveIntegrationSetup } from "@/lib/network-integration-readiness";
import { formatAgo } from "@/lib/location-liveness";
import { CONTROLLER_STATE_COPY, isNasOnlyVendor } from "@/lib/router-vendors";

export type FleetControllerWarning = "No integration" | "Authorising nobody";

/**
 * What to say next to a controller row, or null for "nothing to add".
 *
 * `integrationsHere` is that venue's integrations, or `null` when we could
 * not read the list (not knowing is not the same as knowing nothing is
 * wrong). `isControllerRow` is the ROW judgement (`isControllerManagedRow`),
 * not the label -- a mislabelled MikroTik has no integration by definition.
 */
export function fleetControllerWarning(input: {
  vendor: string | null | undefined;
  isControllerRow: boolean;
  integrationsHere: NetworkIntegration[] | null;
}): FleetControllerWarning | null {
  if (!input.isControllerRow) return null;
  // NAS-only: there is no integration to be missing or half-configured.
  // Its real setup state is RADIUS registration, on its setup page.
  if (isNasOnlyVendor(input.vendor)) return null;
  const here = input.integrationsHere;
  if (here === null) return null; // we could not look
  if (here.length === 0) return "No integration";
  return here.every((i) => deriveIntegrationSetup(i).isHalfConfigured)
    ? "Authorising nobody"
    : null;
}

/** The summary tile / badge wording for a NAS-only row: the same words the
 * backend's `no_controller_api` state uses everywhere else. */
export const NAS_ONLY_FLEET_LABEL = CONTROLLER_STATE_COPY.no_controller_api.label;

/** The status badge for a row in the "not measured here" state. Omada keeps
 * "Via controller"; an Instant On row says where it is actually managed. */
export function notMeasuredBadge(vendor: string | null | undefined): {
  label: string;
  tone: string;
} {
  return isNasOnlyVendor(vendor)
    ? { label: NAS_ONLY_FLEET_LABEL, tone: "normal" }
    : { label: "Via controller", tone: "normal" };
}

/**
 * The fleet status badge for a NAS-only row, from `last_radius_at`: the one
 * thing an Instant On site really sends this platform. It says whether RADIUS
 * has reached us, never whether the access point is up. It does not decay with
 * age, because a venue with no guests sends nothing and is not down
 * (PM_SPEC §2.3). `NAS_ONLY_FLEET_LABEL` stays the summary tile's word.
 */
export function nasOnlyRadiusBadge(lastRadiusAt: string | null | undefined): {
  label: string;
  tone: string;
} {
  return lastRadiusAt
    ? { label: "RADIUS received", tone: "normal" }
    : { label: "No RADIUS recorded", tone: "normal" };
}

/** The Last seen cell for a NAS-only row. "Last RADIUS", not "last guest
 * activity": the stamp also moves on a refused sign-in and on the access
 * point's own Accounting-On after a reboot, so it proves a packet arrived and
 * not that a guest got online. */
export function nasOnlyLastSeenLabel(lastRadiusAt: string | null | undefined, now: Date): string {
  if (!lastRadiusAt) return "No RADIUS yet";
  const ago = formatAgo(lastRadiusAt, now);
  return ago === null ? "Last RADIUS time unknown" : `Last RADIUS ${ago}`;
}

/** What an empty or old Last seen means on a NAS-only row. Said in the drawer,
 * where there is room, because the cell alone cannot carry it. Master-only:
 * it names RADIUS and the listener ports. */
export const NAS_ONLY_LAST_SEEN_NOTE =
  "Wyfy has no API to Instant On, so access point up or down is not measured here. " +
  "Last seen is the last RADIUS packet the shared listener (UDP 1912/1913) matched to this " +
  "site. A venue with no guests sends nothing, so an old or empty time means no recent " +
  "RADIUS, not offline. A site on its own 1812 registration is not recorded here.";

/** The address on a fleet row. An Instant On site has no tunnel, so "not yet
 * assigned" would promise an IP that is never coming. */
export function fleetRowAddressLabel(router: {
  vendor: string | null | undefined;
  managementIpAddress: string | null;
  publicIpAddress: string | null;
}): string {
  return (
    router.managementIpAddress ??
    router.publicIpAddress ??
    (isNasOnlyVendor(router.vendor) ? "No tunnel IP" : "IP not yet assigned")
  );
}

/**
 * Which summary tile a row counts under. A NAS-only row is still "not
 * measured here" (PM_SPEC §2.1: never Online/Offline), but it is not a
 * controller, so it gets its own tile rather than inflating "Via controller".
 */
export function fleetSummaryBucket(
  vendor: string | null | undefined,
  status: "online" | "degraded" | "offline" | "controller",
): "online" | "degraded" | "offline" | "controller" | "nas-only" {
  if (status === "controller" && isNasOnlyVendor(vendor)) return "nas-only";
  return status;
}

/** The label of the fleet filter that selects every "not measured here" row. */
export function notMeasuredFilterLabel(controllers: number, nasOnly: number): string {
  if (nasOnly === 0) return "Controllers";
  if (controllers === 0) return "Instant On";
  return "Controllers & Instant On";
}
