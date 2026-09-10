/**
 * What a fleet row's `vendor` says about which console affordances apply.
 *
 * The console-side twin of the backend's
 * `app.domains.router.vendor_capabilities`, and it exists for the same
 * reason: every row in Router Fleet used to be a MikroTik running this
 * platform's own agent, and a good deal of this UI was written on that
 * assumption without ever having to state it -- the "Needs credentials"
 * badge, the health tile, the provisioning actions, the lifecycle stages.
 *
 * A TP-Link Omada controller now appears in that same table (contract
 * §11.3: it is registered as a `Router` row because
 * `guest_sessions.router_id` is NOT NULL, so an Omada venue could not log a
 * guest in without one). Rendered with the old assumptions it reads as a
 * MikroTik that is unprovisioned, has no credentials and has never been
 * seen -- a working venue displayed as a broken one, which is precisely
 * what §11.5 says must not ship.
 *
 * Kept deliberately tiny and dependency-free so any component can ask.
 */

/** Matches the backend's `CONTROLLER_MANAGED_VENDORS`. */
const CONTROLLER_MANAGED_VENDORS = new Set(["tplink_omada"]);

export const ROUTER_VENDOR_LABEL: Record<string, string> = {
  mikrotik: "MikroTik",
  tplink_omada: "TP-Link Omada",
};

/**
 * True if this device is reached only through its vendor's controller, and
 * therefore has no agent, no RouterOS API and no WireGuard peer of its own.
 *
 * Compared lower-cased because this value reaches the console from two
 * places that do not agree on case: the API returns the raw
 * `routers.vendor` column (`"mikrotik"`), while the demo fixtures in
 * `router.service.ts` carry the display spelling (`"MikroTik"`). A
 * case-sensitive compare would answer correctly for real data and wrongly
 * for the demo account, which is the harder of the two to notice.
 */
export function isControllerManaged(vendor: string | null | undefined): boolean {
  return CONTROLLER_MANAGED_VENDORS.has((vendor ?? "").toLowerCase());
}

/** The complement: this platform's own agent runs on the device. */
export function isAgentManaged(vendor: string | null | undefined): boolean {
  return !isControllerManaged(vendor);
}

/** A human label for a vendor string, falling back to the raw value rather
 * than to a guess -- an unrecognised vendor is better shown as itself than
 * relabelled as something it is not. */
export function routerVendorLabel(vendor: string | null | undefined): string {
  if (!vendor) return "—";
  return ROUTER_VENDOR_LABEL[vendor.toLowerCase()] ?? vendor;
}
