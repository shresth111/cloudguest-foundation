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
 *  - `network-integrations`  RETIRED from the customer dashboard entirely
 *                            (FIX-PLAN FE-0) -- its route, nav row and
 *                            catalog entry are gone, because backend
 *                            `074d719` made every one of its endpoints
 *                            GLOBAL-scoped. It is listed here only so this
 *                            list is not read as a claim that it still
 *                            renders.
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

// ---------------------------------------------------------------------------
// Evidence beats the label -- FIX-PLAN D3a.
// ---------------------------------------------------------------------------

/**
 * The columns that only this platform's own agent can write.
 *
 * Structural rather than `RouterDevice`, because this module is deliberately
 * dependency-free (see the header) and several callers hold different
 * projections of the same row. Every field is optional: a caller that does
 * not have one is saying "I cannot see this evidence", which must never be
 * read as "this evidence is absent".
 */
export interface RouterRowEvidence {
  vendor?: string | null;
  /** A heartbeat OR the provisioning-token exchange stamped this. Either way
   * the device spoke to us, which a controller never does. */
  lastSeenAt?: string | null;
  /** Read off the device by the agent. A controller has no RouterOS. */
  routerOsVersion?: string | null;
  /**
   * DELIBERATELY NOT EVIDENCE, and this is the one field where that needs
   * saying -- FIX-PLAN FE-1.2.
   *
   * `routerOsVersion` is written only by the agent's status push and
   * `lastSeenAt` only by its heartbeat: both are the DEVICE reporting in.
   * `hasApiCredentials` is admin-entered -- an operator typing a username and
   * a password into a form proves nothing about what is at the other end of
   * the row. Counting it would mean that filling in credentials on a
   * controller silently reclassified it as agent-managed, which is the same
   * "somebody typed something" failure this predicate exists to end, just
   * with an extra step. `managementIpAddress` and `publicIpAddress` are
   * excluded for the same reason and are not modelled here at all.
   *
   * Kept on the interface so a caller that passes a whole `RouterDevice`
   * type-checks, and so the exclusion is documented where someone would
   * otherwise "fix" it back in.
   */
  hasApiCredentials?: boolean | null;
}

/**
 * Whether this ROW is controller-managed: the vendor says so AND nothing on
 * the row contradicts it.
 *
 * WHY THE LABEL ALONE IS NOT ENOUGH
 * ---------------------------------
 * `vendor` is a string somebody typed into a dropdown. In production it was
 * typed onto seven live MikroTiks, and because every liveness, monitoring and
 * alerting decision keyed off the label alone, that one edit switched
 * monitoring off for all seven and put nothing in its place: the Master fleet
 * read ONLINE 0 / DEGRADED 0 / OFFLINE 0 / VIA CONTROLLER 7 while one of
 * those rows was `status: "offline"`, `health_status: "unhealthy"`, last seen
 * two days earlier -- and nobody was told, because the alert evaluator's
 * roster is filtered by the same label.
 *
 * A device that checked in and then stopped is down. That fact does not
 * depend on what someone typed in a dropdown afterwards. So the question
 * every liveness surface asks is this one, not `isControllerManaged`: a row
 * carrying agent evidence is treated as agent-managed whatever its vendor
 * column says, and a genuinely onboarded controller -- which has none of that
 * evidence, because the onboard path leaves every agent column NULL -- is
 * unaffected.
 *
 * `isControllerManaged(vendor)` stays for the pure-vendor question the device
 * adapter registries ask ("can this vendor be written to at all"), where the
 * label IS the subject.
 */
export function isControllerManagedRow(row: RouterRowEvidence | null | undefined): boolean {
  if (!row) return false;
  if (!isControllerManaged(row.vendor)) return false;
  return !hasAgentEvidence(row);
}

/** The evidence itself, exported so a surface can say WHY it disagreed with
 * the label rather than silently overriding it. */
export function hasAgentEvidence(row: RouterRowEvidence | null | undefined): boolean {
  if (!row) return false;
  // Only what the DEVICE reported. See `hasApiCredentials` above for why an
  // admin-entered credential is not in this list.
  return Boolean(row.lastSeenAt) || Boolean(row.routerOsVersion);
}

/**
 * A row labelled as a controller that is nonetheless behaving like an agent.
 *
 * Surfaced rather than silently resolved: `isControllerManagedRow` makes the
 * mislabel harmless, and this makes it VISIBLE, so somebody corrects the data
 * instead of the platform quietly compensating for it forever.
 */
export function vendorLooksWrong(row: RouterRowEvidence | null | undefined): boolean {
  if (!row) return false;
  return isControllerManaged(row.vendor) && hasAgentEvidence(row);
}

export const VENDOR_MISMATCH_LABEL = "Vendor looks wrong";
export const VENDOR_MISMATCH_DETAIL =
  "Recorded as a TP-Link Omada controller, but this device has been checking in like a " +
  "MikroTik. Someone should confirm the vendor.";

// ---------------------------------------------------------------------------
// The one status vocabulary for a controller row -- FIX-PLAN D2.
// ---------------------------------------------------------------------------

/**
 * The seven states a controller row can be in, in precedence order.
 *
 * The BACKEND computes the value (`controller_state` on the router read
 * paths); this module owns the WORDS. That split is the point: three
 * surfaces giving three different answers about one router in one session was
 * the symptom of three independent derivations (the venue dashboard's
 * `location-liveness.ts`, Fix a Problem's `connection-verdicts.ts` and the
 * Master fleet's own local badge map). One server-computed value plus one
 * copy table makes that contradiction structurally impossible rather than
 * fixed three times over.
 *
 * THREE RULES EVERY SURFACE OBEYS, and they are why these strings read as
 * they do:
 *
 *  1. Agent columns are never rendered for a controller row. `status`,
 *     `health_status`, `last_seen_at` and `routeros_version` are written only
 *     by a heartbeat; where a column must exist the cell reads
 *     `NOT_MEASURED_HERE` -- never "Never", never "Unknown", never a raw enum.
 *  2. Agent vocabulary is reserved. "Online", "Offline", "Live", "Gone quiet"
 *     and "Never checked in" all mean AN AGENT CHECKED IN. A controller never
 *     borrows them -- which is why the healthy state below is "Controller
 *     reachable" and not "Online".
 *  3. "Controller reachable" is a claim about US reaching the CONTROLLER. Not
 *     about the venue's access points, and not about a guest's internet. No
 *     surface may promote it into "the WiFi works".
 *
 * `certificate_unverified` is DEFINED but not yet claimed: the gateway cannot
 * currently tell a TLS failure apart from any other network failure, so the
 * backend collapses it into `unreachable`. Defining it now keeps the
 * vocabulary complete; claiming it before it can be distinguished would be
 * the unearned precision the rest of this module exists to prevent.
 */
export type ControllerState =
  | "not_registered"
  | "disabled"
  | "credentials_rejected"
  | "certificate_unverified"
  | "unreachable"
  | "not_mapped"
  | "reachable";

export type ControllerStateTone = "neutral" | "warning" | "danger" | "ok";

export interface ControllerStateCopy {
  label: string;
  tone: ControllerStateTone;
  /** One sentence. `{ago}` is substituted by `controllerStateSentence`. */
  sentence: string;
}

export const CONTROLLER_STATE_COPY: Record<ControllerState, ControllerStateCopy> = {
  not_registered: {
    label: "Not connected",
    tone: "neutral",
    sentence: "This controller has no connection details yet, so it can't sign anyone in.",
  },
  disabled: {
    label: "Turned off",
    tone: "warning",
    sentence:
      "This integration is switched off. Guests can't sign in until someone turns it back on.",
  },
  credentials_rejected: {
    label: "Sign-in rejected",
    tone: "danger",
    sentence:
      "The controller refused the credentials we hold. They may have been changed in Omada.",
  },
  certificate_unverified: {
    label: "Identity unverified",
    tone: "danger",
    sentence: "We reached the controller but couldn't verify its identity.",
  },
  unreachable: {
    label: "Can't reach it",
    tone: "danger",
    sentence: "We last reached this controller {ago}. Until we can, guests can't sign in.",
  },
  not_mapped: {
    label: "Authorising nobody",
    tone: "warning",
    sentence:
      "We can reach this controller, but nobody has chosen which Omada site and guest network " +
      "to use. Guests can't sign in until that's done.",
  },
  reachable: {
    label: "Controller reachable",
    tone: "ok",
    sentence: "Last contacted the controller {ago}.",
  },
};

/** Rule 1's cell text, in one place so the fleet list, the fleet drawer, the
 * venue dashboard and Fix a Problem cannot drift. */
export const NOT_MEASURED_HERE = "Not measured here";

/**
 * `true` only for a value this build recognises.
 *
 * A backend that grows an eighth state must not make an older console render
 * `undefined`, and must not have it quietly rounded to the nearest known
 * state -- an unrecognised state is an unknown, and this module's posture is
 * that an unknown is never spent as an answer.
 */
export function isControllerState(value: unknown): value is ControllerState {
  return typeof value === "string" && value in CONTROLLER_STATE_COPY;
}

/**
 * The sentence for a state, with `{ago}` filled in.
 *
 * When the caller has no timestamp the clause is rewritten rather than
 * printed with a placeholder or a guessed "recently".
 */
export function controllerStateSentence(state: ControllerState, ago: string | null): string {
  const raw = CONTROLLER_STATE_COPY[state].sentence;
  if (ago) return raw.replace("{ago}", ago);
  return raw
    .replace("We last reached this controller {ago}. ", "We can't reach this controller. ")
    .replace("Last contacted the controller {ago}.", "We have reached this controller.");
}

// ---------------------------------------------------------------------------
// Device-domain screens: refuse early and explain -- FIX-PLAN D4.
// ---------------------------------------------------------------------------

/**
 * What each gated screen CONFIGURES, in a venue owner's words, and the verb
 * that agrees with it.
 *
 * A table rather than a sentence per screen because it IS one sentence: only
 * the noun changes, and six near-identical strings are six places for the
 * wording to drift.
 */
const CONTROLLER_UNSUPPORTED_NOUNS: Record<string, { noun: string; verb: string }> = {
  vlans: { noun: "Network zones (VLANs)", verb: "are" },
  dhcp: { noun: "IP address ranges (DHCP)", verb: "are" },
  "port-forwarding": { noun: "Port forwarding rules", verb: "are" },
  voip: { noun: "Traffic priority", verb: "is" },
  "website-blocking": { noun: "Website blocking", verb: "is" },
  "isp-details": { noun: "Internet connection details", verb: "are" },
};

export const CONTROLLER_UNSUPPORTED_HEADLINE = "Configured in Omada, not here.";

/**
 * The panel body for a gated screen.
 *
 * States what is true, why, and -- crucially -- what we DO do, because the
 * owner's next thought after "not here" is "then what am I paying for": we
 * connect to the controller to sign guests in, we do not configure the
 * network for it. That second half is the difference between a refusal and an
 * explanation.
 *
 * Null for a feature that is not gated, so a call site cannot render this
 * panel over a screen that works.
 */
export function controllerUnsupportedCopy(
  featureId: string,
  venueName: string | null | undefined,
): string | null {
  const entry = CONTROLLER_UNSUPPORTED_NOUNS[featureId];
  if (!entry) return null;
  const who = venueName?.trim() || "This venue";
  return (
    `${who} runs on a TP-Link Omada controller. ${entry.noun} for this venue ${entry.verb} ` +
    "set in Omada's own interface — we connect to the controller to sign guests in, we don't " +
    "configure the network for it."
  );
}

// ---------------------------------------------------------------------------
// Router pickers -- FIX-PLAN FE-3.
// ---------------------------------------------------------------------------

/** The minimum a picker row has to carry for this module to judge it. */
export interface VendorJudgeableRouter extends RouterRowEvidence {
  id: string;
  name: string;
}

/**
 * Split a venue's routers into the ones a device-domain form may target and
 * the ones it may not.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE SCREEN-LEVEL GATE
 * ----------------------------------------------------
 * `CONTROLLER_UNSUPPORTED_FEATURE_IDS` gates a whole SCREEN, and only when
 * EVERY router at the venue is a controller (`locationIsControllerManaged` is
 * `every`, not `some`) -- deliberately, because at a MIXED venue those screens
 * act on the MikroTik and they genuinely work.
 *
 * A mixed venue is exactly where the second gate was missing, and it is what
 * was observed in production: the screen renders, correctly, and then its
 * "New zone" picker lists every router the venue has -- controller included,
 * with no badge and no warning. The owner picks it, fills in the whole form,
 * and the backend refuses by vendor on submit (`get_vlan_adapter` raising
 * `UnsupportedVlanVendorError`). The same defect as the screen-level one, one
 * level down, surviving the screen-level fix because that fix was keyed on
 * the VENUE rather than on the row being written to.
 *
 * Judged with `isControllerManagedRow`, not the bare vendor: a mislabelled
 * MikroTik must not vanish from its own venue's picker.
 *
 * Returned as a pair rather than as a filter so callers are pushed to NAME
 * what they removed. A router that silently disappears from a picker is a
 * support ticket ("where did my second device go"); one named as absent, with
 * a reason, is not.
 */
export function partitionRoutersByDeviceWrite<T extends VendorJudgeableRouter>(
  rows: readonly T[],
): { writable: T[]; controllerManaged: T[] } {
  const writable: T[] = [];
  const controllerManaged: T[] = [];
  for (const r of rows) {
    if (isControllerManagedRow(r)) controllerManaged.push(r);
    else writable.push(r);
  }
  return { writable, controllerManaged };
}

/**
 * The line under a picker that has left rows out. Null when nothing was
 * excluded, so every call site is one conditional render.
 */
export function excludedControllerRoutersNote(
  controllerManaged: readonly VendorJudgeableRouter[],
): string | null {
  const n = controllerManaged.length;
  if (n === 0) return null;
  if (n === 1) {
    return (
      "One device at this venue is a TP-Link Omada controller and isn't listed here — " +
      "it's configured in Omada."
    );
  }
  return (
    `${n} devices at this venue are TP-Link Omada controllers and aren't listed here — ` +
    "they're configured in Omada."
  );
}

/**
 * The same fact said about ONE already-selected router rather than about a
 * filtered list.
 *
 * Used where excluding the row is the wrong fix because there is nothing to
 * fall back to -- Internet Connection, where the venue's uplink is a record
 * about the building and the controller may be the only `Router` row it has.
 * The record is legitimate; what is unavailable is every control that talks
 * to the device.
 */
export function controllerRouterDeviceWriteReason(vendor: string | null | undefined): string {
  const who = vendor ? `a ${routerVendorLabel(vendor)} controller` : "a network controller";
  return (
    `This is ${who} rather than a WyfyGuest-managed router, so we do not reach the device ` +
    "itself from here. Anything that has to be sent to it — health checks, failover and " +
    "traffic routing — is done in that controller."
  );
}

/**
 * What the Devices screen says instead of an empty chart -- FIX-PLAN D5.
 *
 * That screen's charts are CPU, memory and per-interface octet counters, all
 * written by measurement paths a controller has no part in (the agent's
 * RouterOS reads, and the SNMP sweep against the device). On a controller row
 * they are permanently empty -- and an empty chart with an axis on it is a
 * measurement claim: it says we looked and there was nothing, where the truth
 * is that nothing here looks. Never a per-port chart, a RouterOS version or a
 * model string for a controller venue.
 */
export function controllerDeviceMetricsReason(vendor: string | null | undefined): string {
  const who = vendor ? `a ${routerVendorLabel(vendor)} controller` : "a network controller";
  return (
    `This is ${who} and its readings live in that controller, not here. This platform ` +
    "measures a device it runs software on; it does not poll a controller for CPU, memory " +
    "or per-port traffic, so there is nothing on this chart to show rather than nothing " +
    "happening on your network."
  );
}

/**
 * Whether this venue has any router these forms can act on at all.
 *
 * The case FE-3 calls out: at a controller-only venue reached through some
 * path the screen-level gate did not cover, the filtered list is EMPTY, and an
 * empty picker over a live form is the same defect wearing a different face.
 * Call sites render the D4 notice instead.
 *
 * Lives here rather than beside `RouterPickerItems`, where it was written.
 * That module exports two components, and a non-component export alongside
 * them trips `react-refresh/only-export-components` -- the 59th warning
 * against a `--max-warnings 58` ratchet, which is what reddened `main` after
 * the 2026-09-12 merges. Its sibling `partitionRoutersByDeviceWrite` is
 * already here, so this is the address it should have had.
 */
export function hasWritableRouter(rows: readonly VendorJudgeableRouter[]): boolean {
  return partitionRoutersByDeviceWrite(rows).writable.length > 0;
}

/** Matches DeviceVendor in wyfy-device-gateway's contract (PRD section 4.1)
 * -- same string identifiers so this dropdown's value and the backend's
 * Router.vendor column always agree. Two vendors are supported today, in
 * two different ways: MikroTik gets the setup script this file generates,
 * and TP-Link Omada gets `OmadaGuidedSetupPanel` -- an Omada controller is
 * onboarded through its network integration and configured in its own UI,
 * so there is no script, only the values to type in. Every other entry
 * exists so this Master-console screen can honestly say "not yet
 * supported" instead of hiding the hardware a customer actually has. */
export const DEVICE_VENDORS: { value: string; label: string }[] = [
  { value: "mikrotik", label: "MikroTik" },
  { value: "tplink_omada", label: "TP-Link Omada" },
  { value: "ruckus", label: "Ruckus" },
  { value: "unifi", label: "UniFi" },
  { value: "aruba", label: "Aruba" },
  { value: "cisco_meraki", label: "Cisco Meraki" },
];

/**
 * The vendors a control may WRITE. The two this platform implements.
 *
 * `DEVICE_VENDORS` above is a LABELLING table -- it exists so a screen can
 * name hardware a customer actually has and say "not yet supported". Its own
 * comment says exactly that. It was nonetheless wired straight into the
 * Master fleet drawer's vendor `<select>`, which fires
 * `PUT /routers/{id} {vendor}` on change: picking "UniFi" wrote
 * `vendor="unifi"`, a value that is in no adapter registry and NOT in
 * `CONTROLLER_MANAGED_VENDORS`, so the row was thereafter silently treated as
 * an agent-managed MikroTik for ever. The comment described an intent the
 * code did not implement, which is the same failure as the router.service
 * comment claiming this wizard was mounted somewhere it was not.
 *
 * Separating the two lists makes the intent enforceable rather than
 * aspirational: a screen that wants to NAME a vendor reads `DEVICE_VENDORS`;
 * a control that wants to SET one reads this.
 *
 * This is only the write-surface half of FIX-PLAN D3b. The rest of it --
 * moving `vendor` onto a GLOBAL-scoped route, a typed confirmation, an audit
 * diff, and immutability once the device has spoken -- is backend work and is
 * not done here.
 */
export const SELECTABLE_DEVICE_VENDORS: { value: string; label: string }[] = DEVICE_VENDORS.filter(
  (v) => v.value === "mikrotik" || v.value === "tplink_omada",
);

/** The label for a vendor string, including one this platform does not
 * implement -- `DEVICE_VENDORS` exists so a screen can NAME hardware
 * honestly even where it cannot manage it. Exported because the vendor
 * change dialog has to say, in words, what a row is being moved from. */
export function vendorLabel(value: string): string {
  return DEVICE_VENDORS.find((v) => v.value === value)?.label ?? value;
}

/**
 * The options a vendor `<select>` should offer for a row that currently
 * holds `current`.
 *
 * `SELECTABLE_DEVICE_VENDORS` on its own is not enough for a control bound
 * to an existing value: a row already carrying `unifi` -- and rows do, this
 * list was a live write surface for months -- binds a `<select>` to a value
 * with no matching `<option>`, which renders as the first option instead.
 * The screen would then show "MikroTik" for a row the database calls
 * "unifi", which is a new lie in place of the old one.
 *
 * So the current value is kept, labelled, and marked unselectable. It can be
 * read and moved away from; it cannot be chosen.
 */
export function vendorOptionsFor(
  current: string | undefined,
): { value: string; label: string; disabled?: boolean }[] {
  const value = current || "mikrotik";
  if (SELECTABLE_DEVICE_VENDORS.some((v) => v.value === value)) {
    return SELECTABLE_DEVICE_VENDORS;
  }
  return [
    { value, label: `${vendorLabel(value)} — not supported`, disabled: true },
    ...SELECTABLE_DEVICE_VENDORS,
  ];
}

/**
 * ---------------------------------------------------------------------------
 * The four above moved here from `RouterSetupScriptAdvanced.tsx` on
 * 2026-09-12. FIX-PLAN D2 says this module owns the vendor vocabulary, and
 * the mechanical reason is the one already recorded on `hasWritableRouter`:
 * that file exports components, so every non-component export beside them
 * trips `react-refresh/only-export-components`, and
 * `eslint . --max-warnings 58` is the ratchet that reddens `main`.
 * ---------------------------------------------------------------------------
 */
