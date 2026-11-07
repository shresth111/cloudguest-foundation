/**
 * Pure model for the Devices page's fleet summary and hardware inventory,
 * and for the Overview's hardware card that summarises it.
 *
 * NOTHING HERE INVENTS A ROW. Every inventory row is one of:
 *   - a router the venue's liveness read already holds
 *     (`activeLocation.liveness.routers`, from `/locations/{id}/routers`),
 *     optionally joined by id to the same venue's `RouterDevice` rows
 *     (`useLocationDevices`, the query the traffic panel already makes) for
 *     its model and MAC;
 *   - a registered piece of hardware (`useMonitoredHardware`).
 *
 * Status words and tones come from the existing single sources --
 * `describeLiveness` for hardware, `routerStatus` (the Overview topology's
 * mapping of `RouterLiveness.state`) for routers -- so this page, the
 * Overview card and the topology map can never disagree about a device.
 *
 * Pure (no React) so `scripts/test-devices-inventory.mjs` can drive it.
 */
import type { RouterLiveness } from "@/lib/location-liveness";
import type { RouterDevice } from "@/types/router";
import type { MonitoredDeviceRow } from "@/services/deviceHardware.service";
import { describeLiveness, hardwareLivenessIsMeasured } from "@/lib/device-liveness";
import { isControllerManaged, isNasOnlyVendor, routerVendorLabel } from "@/lib/router-vendors";
import { routerStatus } from "@/components/customer/dashboard/overview/topology-model";

/** What the strip counts. `unmeasured` is NOT `unknown`: unknown says we
 * looked and could not tell, unmeasured says nothing on this platform looks
 * (a controller-managed venue). The old summary kept them apart; so does
 * this one. */
export type FleetBucket = "ok" | "warn" | "crit" | "unknown" | "unmeasured";

export const BUCKET_ORDER: readonly FleetBucket[] = ["ok", "warn", "crit", "unknown", "unmeasured"];

/** Faults first: down, degraded, can't-tell, not measured, up. */
const FAULT_RANK: Record<FleetBucket, number> = {
  crit: 0,
  warn: 1,
  unknown: 2,
  unmeasured: 3,
  ok: 4,
};

export type FleetKind = "router" | "ap" | "other";

export const KIND_ORDER: readonly FleetKind[] = ["router", "ap", "other"];

export interface InventoryRow {
  /** Stable across renders: `rt:<router id>` or `hw:<hardware id>`. */
  key: string;
  source: "router" | "hardware";
  kind: FleetKind;
  name: string;
  /** "Router", "Access Point", "Printer", ... -- the registered type, or
   * "Router" for a venue router ("Access Point" for a NAS-only one). */
  typeLabel: string;
  /** Free-text floor, "" when none recorded (routers have none). */
  floor: string;
  mac: string | null;
  /** Model / vendor line, when the source has one. */
  model: string | null;
  bucket: FleetBucket;
  /** Badge word, e.g. "Online", "Down", "Can't reach router", "Not measured". */
  statusWord: string;
  /** The short measured fact beside it, already labelled ("since 07:09 ·
   * port ether3 link down"), or null. Never a bare duration. */
  detail: string | null;
  /** One plain sentence: what it means and what to check. */
  explanation: string | null;
  /** Last time the network heard from it (ISO), or null when never. */
  lastSeenAt: string | null;
  /** Real boot uptime (seconds) when the source reports one; never derived
   * from `lastSeenAt`. */
  uptimeSeconds: number | null;
  hardware?: MonitoredDeviceRow;
  router?: RouterLiveness;
  routerDevice?: RouterDevice;
}

/** A registered hardware row's bucket. Identical to the old summary's
 * `summaryBucket`: read off `describeLiveness`'s tone so the strip and each
 * row's dot can never disagree. */
export function hardwareBucket(d: MonitoredDeviceRow): FleetBucket {
  if (!hardwareLivenessIsMeasured(d)) return "unmeasured";
  const tone = describeLiveness(d).tone;
  if (tone === "up") return "ok";
  if (tone === "down") return "crit";
  if (tone === "warning") return "warn";
  return "unknown";
}

export function hardwareKind(type: string): FleetKind {
  if (type === "Access Point") return "ap";
  if (type === "Router") return "router";
  return "other";
}

function routerBucket(r: RouterLiveness): FleetBucket {
  // A controller row: nothing on this platform measures it. Not "unknown"
  // (we looked), not green.
  if (r.state === "not-applicable") return "unmeasured";
  const s = routerStatus(r);
  if (s === "ok") return "ok";
  if (s === "warn") return "warn";
  if (s === "crit") return "crit";
  return "unknown";
}

export function hardwareRow(d: MonitoredDeviceRow, now: number = Date.now()): InventoryRow {
  const measured = hardwareLivenessIsMeasured(d);
  const live = describeLiveness(d, now);
  return {
    key: `hw:${d.id}`,
    source: "hardware",
    kind: hardwareKind(d.type),
    name: d.name || d.mac,
    typeLabel: d.type,
    floor: (d.floor ?? "").trim(),
    mac: d.mac || null,
    model: null,
    bucket: hardwareBucket(d),
    statusWord: live.state,
    detail: measured ? live.detail : null,
    explanation: live.explanation,
    lastSeenAt: d.lastSeenAt ?? null,
    uptimeSeconds: d.uptimeSeconds ?? null,
    hardware: d,
  };
}

export function routerRow(r: RouterLiveness, device?: RouterDevice): InventoryRow {
  const vendor = r.vendor ?? device?.vendor ?? null;
  // At a NAS-only venue (Aruba Instant On) the "router" row IS the access
  // point: the AP signs guests in and there is no router of ours. Count and
  // label it as one. Every other vendor (MikroTik, Omada) stays a Router.
  const nasOnly = isNasOnlyVendor(vendor);
  return {
    key: `rt:${r.key}`,
    source: "router",
    kind: nasOnly ? "ap" : "router",
    name: r.label,
    typeLabel: nasOnly ? "Access Point" : "Router",
    floor: "",
    mac: device?.macAddress || null,
    // A controller row's `model` column carries whatever was typed at
    // onboarding (see DeviceHealthTrafficView); name the vendor instead.
    model:
      device?.model && !isControllerManaged(vendor)
        ? device.model
        : vendor
          ? routerVendorLabel(vendor)
          : null,
    bucket: routerBucket(r),
    statusWord: r.shortLabel,
    detail: null,
    explanation: r.detail || null,
    lastSeenAt: r.lastContactIso,
    uptimeSeconds: null,
    router: r,
    routerDevice: device,
  };
}

/** Routers first (in the API's order), then hardware. */
export function buildInventory(input: {
  routers: readonly RouterLiveness[] | null | undefined;
  routerDevices?: readonly RouterDevice[] | null;
  hardware: readonly MonitoredDeviceRow[];
  now?: number;
}): InventoryRow[] {
  const byId = new Map((input.routerDevices ?? []).map((d) => [d.id, d]));
  const routers = (input.routers ?? []).map((r) => routerRow(r, byId.get(r.key)));
  const hardware = input.hardware.map((d) => hardwareRow(d, input.now));
  return [...routers, ...hardware];
}

export type BucketCounts = Record<FleetBucket, number>;

export function emptyCounts(): BucketCounts {
  return { ok: 0, warn: 0, crit: 0, unknown: 0, unmeasured: 0 };
}

export function countBuckets(rows: readonly { bucket: FleetBucket }[]): BucketCounts {
  const out = emptyCounts();
  for (const r of rows) out[r.bucket] += 1;
  return out;
}

export function countByKind(rows: readonly InventoryRow[]): Record<FleetKind, BucketCounts> {
  return {
    router: countBuckets(rows.filter((r) => r.kind === "router")),
    ap: countBuckets(rows.filter((r) => r.kind === "ap")),
    other: countBuckets(rows.filter((r) => r.kind === "other")),
  };
}

export function totalOf(c: BucketCounts): number {
  return c.ok + c.warn + c.crit + c.unknown + c.unmeasured;
}

/* ── Filtering and sorting ───────────────────────────────────────── */

export interface InventoryFilter {
  kind: FleetKind | "all";
  bucket: FleetBucket | "all";
  /** A floor label, `""` for "no floor recorded", or "all". */
  floor: string | "all";
  query: string;
}

export const NO_FILTER: InventoryFilter = { kind: "all", bucket: "all", floor: "all", query: "" };

export function filterInventory(rows: readonly InventoryRow[], f: InventoryFilter): InventoryRow[] {
  const q = f.query.trim().toLowerCase();
  // MACs are compared without separators so "aabb" finds "AA:BB:...".
  const qHex = q.replace(/[^0-9a-f]/g, "");
  return rows.filter((r) => {
    if (f.kind !== "all" && r.kind !== f.kind) return false;
    if (f.bucket !== "all" && r.bucket !== f.bucket) return false;
    if (f.floor !== "all" && r.floor !== f.floor) return false;
    if (!q) return true;
    if (
      [r.name, r.typeLabel, r.floor, r.statusWord, r.detail ?? "", r.model ?? ""].some((s) =>
        s.toLowerCase().includes(q),
      )
    )
      return true;
    return (
      qHex.length >= 2 &&
      (r.mac ?? "")
        .toLowerCase()
        .replace(/[^0-9a-f]/g, "")
        .includes(qHex)
    );
  });
}

export type InventorySortKey = "status" | "name" | "type" | "floor" | "mac" | "lastSeen" | "uptime";

export interface InventorySort {
  key: InventorySortKey;
  dir: 1 | -1;
}

/** Default: faults first, then by name. */
export const DEFAULT_SORT: InventorySort = { key: "status", dir: 1 };

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.NaN);

/** Nulls always sort last, whichever direction. */
function nullsLast(a: number, b: number, dir: 1 | -1): number {
  const an = Number.isNaN(a);
  const bn = Number.isNaN(b);
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  return (a - b) * dir;
}

export function sortInventory(rows: readonly InventoryRow[], s: InventorySort): InventoryRow[] {
  const byName = (a: InventoryRow, b: InventoryRow) => a.name.localeCompare(b.name);
  return [...rows].sort((a, b) => {
    let c = 0;
    switch (s.key) {
      case "status":
        c = (FAULT_RANK[a.bucket] - FAULT_RANK[b.bucket]) * s.dir;
        break;
      case "name":
        c = byName(a, b) * s.dir;
        break;
      case "type":
        c = a.typeLabel.localeCompare(b.typeLabel) * s.dir;
        break;
      case "floor":
        // No floor sorts last either way.
        if (!a.floor !== !b.floor) return a.floor ? -1 : 1;
        c = a.floor.localeCompare(b.floor, undefined, { numeric: true }) * s.dir;
        break;
      case "mac":
        if (!a.mac !== !b.mac) return a.mac ? -1 : 1;
        c = (a.mac ?? "").localeCompare(b.mac ?? "") * s.dir;
        break;
      case "lastSeen":
        c = nullsLast(time(a.lastSeenAt), time(b.lastSeenAt), s.dir);
        break;
      case "uptime":
        c = nullsLast(a.uptimeSeconds ?? Number.NaN, b.uptimeSeconds ?? Number.NaN, s.dir);
        break;
    }
    return c || FAULT_RANK[a.bucket] - FAULT_RANK[b.bucket] || byName(a, b);
  });
}

/** The N rows an owner most needs to see: faults first, then by name. */
export function topAttention<T extends { bucket: FleetBucket; name: string }>(
  rows: readonly T[],
  n: number,
): T[] {
  return [...rows]
    .sort((a, b) => FAULT_RANK[a.bucket] - FAULT_RANK[b.bucket] || a.name.localeCompare(b.name))
    .slice(0, n);
}

/* ── The `?status=` hand-off from the Overview card ──────────────── */

const PARAM_TO_BUCKET: Record<string, FleetBucket> = {
  online: "ok",
  degraded: "warn",
  down: "crit",
  unknown: "unknown",
  unmeasured: "unmeasured",
};

export const BUCKET_TO_PARAM: Record<FleetBucket, string> = {
  ok: "online",
  warn: "degraded",
  crit: "down",
  unknown: "unknown",
  unmeasured: "unmeasured",
};

/** Reads `?status=down` (etc.) into a bucket; anything else is no filter.
 * TanStack Router may JSON-quote string search values, so quotes are
 * stripped. */
export function bucketFromSearch(search: string | null | undefined): FleetBucket | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("status");
  if (!raw) return null;
  return PARAM_TO_BUCKET[raw.replace(/^"|"$/g, "").toLowerCase()] ?? null;
}

/** Fired by the inventory drawer's "Traffic and load" on a router row; the
 * traffic panel (DeviceHealthTrafficView) selects that router and scrolls
 * into view. A DOM event because the two sections are siblings mounted
 * separately by the page shell (and the /agent preview). */
export const SHOW_ROUTER_TRAFFIC_EVENT = "wy:devices:show-traffic";
