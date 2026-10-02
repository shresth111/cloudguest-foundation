/**
 * Router Fleet (Master): the three things the fleet list says about a row
 * that is NOT measured by this platform -- its warning tag, its status badge
 * and which summary tile it counts under -- as pure functions, so the
 * NAS-only (Aruba Instant On) rules are testable without rendering the page.
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
