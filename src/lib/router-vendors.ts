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

// ---------------------------------------------------------------------------
// Which tabs of the fleet detail drawer apply to which vendor.
// ---------------------------------------------------------------------------

/**
 * The tabs `RouterDetailTabs` can render, in display order.
 *
 * This list used to be an anonymous array literal inside the component,
 * which was fine while every row in Router Fleet was a MikroTik running
 * this platform's own agent. It is not fine now: nine of these eleven tabs
 * are, in one way or another, a conversation with that agent or with
 * RouterOS, and a TP-Link Omada controller has neither.
 */
export interface RouterDetailTab {
  key: string;
  label: string;
}

export const ROUTER_DETAIL_TABS: readonly RouterDetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "setup-script", label: "Setup Script" },
  { key: "wireguard", label: "WireGuard" },
  { key: "wifi", label: "Guest WiFi" },
  { key: "devices", label: "Connected Devices" },
  { key: "monitoring", label: "Monitoring" },
  { key: "analytics", label: "Analytics" },
  { key: "config", label: "Configuration" },
  { key: "provisioning", label: "Provisioning" },
  { key: "diagnostics", label: "Diagnostics" },
  { key: "audit", label: "Audit Logs" },
];

/**
 * The tabs that still mean something for a controller-managed row, and why
 * each of the others does not. Written as an allowlist rather than a
 * denylist on purpose: a twelfth tab added later defaults to *hidden* for a
 * controller, which is the safe direction. A new tab that does apply is a
 * one-line addition here; a new agent-shaped tab that silently appeared on
 * an Omada drawer would be this whole defect coming back.
 *
 *  - `overview`  — the `Router` row itself is real: name, MAC, venue, the
 *                  organization it belongs to. Rendered vendor-aware (no
 *                  RouterOS version, no health verdict, no "last seen").
 *  - `audit`     — audit rows about this row are real records of things
 *                  people did in this console. They exist regardless of
 *                  what is at the other end of the row.
 *
 * Everything else is excluded because it cannot work, not because it is
 * merely empty:
 *  - `setup-script`  RouterOS script for an agent that will never run.
 *  - `wireguard`     the backend now refuses this with a 422 — and it must,
 *                    because the hub agent has no delete verb, so a peer
 *                    allocated to a controller leaks an address forever.
 *  - `devices`       populated by the router agent's device sync; an Omada
 *                    venue's clients live on its network integration.
 *  - `monitoring`    CPU/RAM/bandwidth/RADIUS from heartbeats nobody sends.
 *  - `analytics`     per-router breakdowns keyed off the same heartbeats.
 *  - `config`        RouterOS config preview/push/rollback.
 *  - `provisioning`  provisioning tokens, backups, factory reset — all of
 *                    them agent verbs.
 *  - `diagnostics`   ping/traceroute *from the device*, via the agent.
 *  - `wifi`          already an explanatory panel rather than a control
 *                    surface, and the explanation it gives (MikroTik
 *                    hotspot settings live in the customer dashboard) is
 *                    the wrong one for a controller.
 */
export const CONTROLLER_MANAGED_TAB_KEYS: readonly string[] = ["overview", "audit"];

/** The tabs to render for this vendor. */
export function routerDetailTabsFor(vendor: string | null | undefined): RouterDetailTab[] {
  if (!isControllerManaged(vendor)) return [...ROUTER_DETAIL_TABS];
  return ROUTER_DETAIL_TABS.filter((t) => CONTROLLER_MANAGED_TAB_KEYS.includes(t.key));
}

/** The complement, so the drawer can *name* what it is not showing instead
 * of leaving an operator to wonder whether the console is broken. Empty for
 * every agent-managed vendor. */
export function routerDetailTabsNotApplicableFor(
  vendor: string | null | undefined,
): RouterDetailTab[] {
  if (!isControllerManaged(vendor)) return [];
  return ROUTER_DETAIL_TABS.filter((t) => !CONTROLLER_MANAGED_TAB_KEYS.includes(t.key));
}

/**
 * Clamp a requested tab to one this vendor actually has.
 *
 * `/routers/{id}?tab=wireguard` is a real, linkable URL, and a bookmark or
 * a stale link must not land a controller's drawer on a tab whose trigger
 * is not rendered -- Radix `Tabs` would then show no panel at all, which
 * reads as a broken page rather than as a tab that does not apply.
 */
export function resolveRouterDetailTab(
  vendor: string | null | undefined,
  requested: string | null | undefined,
): string {
  const available = routerDetailTabsFor(vendor);
  const wanted = requested ?? "";
  return available.some((t) => t.key === wanted) ? wanted : available[0].key;
}

/**
 * Whether this platform measures the liveness/health of the device itself.
 *
 * The single predicate behind every "Last seen", "Health" and "Last health
 * check" field. All three read off columns that only a heartbeat writes, so
 * on a controller they are permanently `null` -- and `null` rendered as
 * "Never" is a measurement claim ("we looked and it never has"), where the
 * truth is that nothing here ever looks.
 */
export function routerLivenessIsMeasured(vendor: string | null | undefined): boolean {
  return isAgentManaged(vendor);
}

// ---------------------------------------------------------------------------
// Which customer-dashboard screens apply to a controller-managed venue.
// ---------------------------------------------------------------------------

/**
 * The Network group's five configuration screens, which a venue whose only
 * router is a vendor controller cannot use.
 *
 * The same allowlist-by-exclusion reasoning as `CONTROLLER_MANAGED_TAB_KEYS`
 * above, one dashboard down. Every one of these writes RouterOS through a
 * per-vendor adapter registry that has exactly one vendor in it, so on an
 * Omada venue each ends in a typed refusal from the backend -- e.g.
 * `get_vlan_adapter` raising `UnsupportedVlanVendorError`
 * (`app/domains/vlan/device_adapters.py`). That refusal is correct and must
 * stay; what is wrong is *when* the owner meets it. Failing closed after the
 * form is filled is safe, and it is still the product telling a paying
 * customer to do work that was never going to land.
 *
 *  - `vlans`            "Network Zones". VLAN interfaces on RouterOS.
 *  - `dhcp`             "IP Addresses". DHCP pools/leases on RouterOS.
 *  - `port-forwarding`  dst-nat rules on RouterOS.
 *  - `voip`             "Call Priority". QoS/queue trees on RouterOS.
 *  - `website-blocking`  content-filter rules, pushed to RouterOS.
 *
 * Deliberately NOT in this list, and each for a reason:
 *  - `isp-details`           the venue's ISP/circuit is a record about the
 *                            building, true whoever runs the WiFi.
 *  - `network-integrations`  the screen this whole state is configured on.
 *                            Excluding it would strand the owner.
 *  - everything outside the Network group: guests, sessions, vouchers,
 *    portal, reports and campaigns all run on our side of the wire and are
 *    unaffected by who owns the access points.
 */
export const CONTROLLER_UNSUPPORTED_FEATURE_IDS: readonly string[] = [
  "vlans",
  "dhcp",
  "port-forwarding",
  "voip",
  "website-blocking",
];

export function featureAppliesToControllerVenue(featureId: string): boolean {
  return !CONTROLLER_UNSUPPORTED_FEATURE_IDS.includes(featureId);
}

/**
 * The one sentence a venue owner is owed in place of one of those screens.
 *
 * Written once, here, because it is said in two places that must not drift:
 * the sidebar row's tooltip and the panel the page itself renders. It names
 * the vendor rather than saying "your controller", because the owner bought
 * a box with a brand on it and that is the word they will search for.
 */
export function controllerVenueFeatureReason(vendor: string | null | undefined): string {
  // A missing vendor string is a real case, not a defensive one: this reason
  // is rendered from a venue summary that may have been persisted by an
  // older build of this app, before rows carried a vendor at all. Name the
  // brand when we have it and stay vendor-neutral when we do not, rather
  // than letting `routerVendorLabel`'s "—" fallback reach the sentence.
  const who = vendor ? `a ${routerVendorLabel(vendor)} controller` : "a network controller";
  return (
    `This venue's network is managed by ${who}, not by a WyfyGuest-managed router, ` +
    "so this is configured in that controller rather than here."
  );
}
