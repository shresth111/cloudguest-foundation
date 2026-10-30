/**
 * Pure model for the Overview topology map: ISP link(s) -> router/gateway ->
 * access points / switches / other hardware -> guests online.
 *
 * NOTHING HERE INVENTS A NODE. Every node is one row of data the page
 * already holds:
 *   - ISP nodes      -- `useWanSummary` links (`/isp/links`, max two)
 *   - gateway nodes  -- `LocationLiveness.routers` (from `/locations/{id}/routers`)
 *   - downstream     -- the Omada controller's own inventory when the venue
 *                       has one and it answered, otherwise the venue's
 *                       monitored hardware (`/monitored-hardware`)
 *   - clients        -- `kpis.onlineUsers` from the dashboard summary
 * When a source has nothing, the model says which kind of nothing
 * (`ispState`, `gatewayState`, `downstreamState`) so the view can render an
 * honest placeholder rather than an empty-looking healthy chain.
 *
 * Pure so `scripts/test-dashboard-topology.mjs` can exercise it directly.
 */
import type { IspLink } from "@/types/isp";
import type { LocationLiveness, RouterLiveness } from "@/lib/location-liveness";
import type { MonitoredDeviceRow } from "@/services/deviceHardware.service";
import type {
  ControllerDeviceRow,
  ControllerInventory,
} from "@/services/controllerDevices.service";
import {
  describeLiveness,
  formatDuration,
  hardwareLivenessIsMeasured,
} from "@/lib/device-liveness";
import { routerVendorLabel } from "@/lib/router-vendors";
import type { WanSummaryState } from "../dashboard.types";
import type { OverviewStatus } from "./console-ui";

export type TopoKind = "isp" | "gateway" | "ap" | "switch" | "device" | "clients" | "more";

/** One labelled fact for the hover card. `key` is translated by the view;
 * `value` is data and renders as sent. `mono` for addresses. */
export interface TopoFact {
  key:
    | "role"
    | "interface"
    | "gatewayIp"
    | "latency"
    | "loss"
    | "plan"
    | "lastChecked"
    | "vendor"
    | "state"
    | "lastContact"
    | "model"
    | "ip"
    | "mac"
    | "uptime"
    | "clients"
    | "firmware"
    | "type"
    | "floor"
    | "detail"
    | "lastSeen"
    | "source";
  value: string;
  mono?: boolean;
  /** An ISO timestamp the view should render relative ("3m ago"). */
  time?: boolean;
}

export interface TopoNode {
  id: string;
  kind: TopoKind;
  label: string;
  /** Short second line under the label. */
  sub: string | null;
  status: OverviewStatus;
  /** Status word to show, already in data vocabulary (may be English
   * library copy, e.g. describeLiveness' "Up"). The view prefers its own
   * translated word for `status` and shows this as the detail. */
  statusText: string | null;
  facts: TopoFact[];
  /** Feature id for `customerFeatureHref`, when a page exists for it. */
  target: "isp-details" | "devices" | "users" | null;
  /** ISP only: carrying traffic now. Drives solid vs dashed link. */
  active?: boolean;
  /** "more" only: how many nodes it stands for. */
  count?: number;
}

export interface TopologyInput {
  wan: WanSummaryState;
  liveness: LocationLiveness;
  /** True while the routers read is still in flight. */
  livenessLoading: boolean;
  hardware: MonitoredDeviceRow[];
  hardwareLoading: boolean;
  /** `null` when the venue has no controller to ask (no request made). */
  controller: (ControllerInventory & { loading: boolean }) | null;
  onlineGuests: number | null;
  nasOnly: boolean;
  /** Downstream nodes drawn before the rest collapse into "+N more". */
  maxDownstream?: number;
}

export interface TopologyModel {
  ispState: "loading" | "none" | "ready";
  isps: TopoNode[];
  gatewayState: "loading" | "none" | "unreadable" | "ready";
  gateways: TopoNode[];
  downstreamState: "loading" | "none" | "unmeasured" | "controller-unreachable" | "ready";
  /** Where the downstream rows came from. */
  downstreamSource: "controller" | "hardware" | null;
  downstream: TopoNode[];
  /** Total downstream rows before collapsing. */
  downstreamTotal: number;
  /** Downstream rows per status, over ALL rows (not just the drawn ones). */
  downstreamCounts: Record<OverviewStatus, number>;
  clients: TopoNode | null;
  /** Worst status anywhere in the chain, for the panel's own dot. */
  overall: OverviewStatus;
}

const RANK: Record<OverviewStatus, number> = {
  crit: 0,
  warn: 1,
  offline: 2,
  unknown: 3,
  info: 4,
  ok: 5,
};

export function worstStatus(statuses: OverviewStatus[]): OverviewStatus {
  if (statuses.length === 0) return "unknown";
  return statuses.reduce((w, s) => (RANK[s] < RANK[w] ? s : w), "ok" as OverviewStatus);
}

function countByStatus(nodes: TopoNode[]): Record<OverviewStatus, number> {
  const out: Record<OverviewStatus, number> = {
    ok: 0,
    warn: 0,
    crit: 0,
    info: 0,
    offline: 0,
    unknown: 0,
  };
  for (const n of nodes) out[n.status] += 1;
  return out;
}

export function ispStatus(link: IspLink): OverviewStatus {
  if (!link.isEnabled) return "offline";
  switch (link.healthStatus) {
    case "healthy":
      return "ok";
    case "degraded":
      return "warn";
    case "unhealthy":
      return "crit";
    default:
      return "unknown";
  }
}

export function routerStatus(r: RouterLiveness): OverviewStatus {
  switch (r.state) {
    case "online":
      return "ok";
    case "heartbeat-late":
      return "warn";
    case "went-silent":
    case "controller-reported-down":
      return "crit";
    case "never-checked-in":
    case "setup-not-started":
    case "suspended":
    case "retired":
      return "offline";
    // A controller row: this platform never measures it. Not green.
    case "not-applicable":
    case "unknown":
    default:
      return "unknown";
  }
}

/** Omada's status vocabulary varies by controller version; anything not
 * recognised is `unknown`, never assumed up. */
export function controllerDeviceStatus(raw: string): OverviewStatus {
  const s = (raw ?? "").toLowerCase();
  if (/disconnect|offline|down|lost|heartbeat.?missed/.test(s)) return "crit";
  if (/pend|adopt|upgrad|provision|isolat|config|restart|reboot/.test(s)) return "warn";
  if (/^(connected|online|up|active)$/.test(s)) return "ok";
  return "unknown";
}

function hardwareStatus(d: MonitoredDeviceRow): { status: OverviewStatus; text: string | null } {
  if (!hardwareLivenessIsMeasured(d)) return { status: "unknown", text: "Not measured" };
  const live = describeLiveness(d);
  const status: OverviewStatus =
    live.tone === "up"
      ? "ok"
      : live.tone === "down"
        ? "crit"
        : live.tone === "warning"
          ? "warn"
          : "unknown";
  return { status, text: live.state };
}

function ispNode(link: IspLink): TopoNode {
  const facts: TopoFact[] = [{ key: "role", value: link.role }];
  if (link.interface) facts.push({ key: "interface", value: link.interface, mono: true });
  if (link.gatewayIpAddress)
    facts.push({ key: "gatewayIp", value: link.gatewayIpAddress, mono: true });
  if (link.latencyMs != null)
    facts.push({ key: "latency", value: `${Math.round(link.latencyMs)} ms` });
  if (link.packetLossPercentage != null)
    facts.push({ key: "loss", value: `${link.packetLossPercentage.toFixed(1)} %` });
  if (link.downloadBandwidthMbps != null)
    facts.push({
      key: "plan",
      value: `${link.downloadBandwidthMbps}${link.uploadBandwidthMbps != null ? ` / ${link.uploadBandwidthMbps}` : ""} Mbps`,
    });
  if (link.lastCheckedAt) facts.push({ key: "lastChecked", value: link.lastCheckedAt, time: true });
  return {
    id: `isp:${link.id}`,
    kind: "isp",
    label: link.providerName || "ISP",
    sub: link.linkType ? link.linkType : null,
    status: ispStatus(link),
    statusText: null,
    facts,
    target: "isp-details",
    active: link.isActiveUplink,
  };
}

function gatewayNode(r: RouterLiveness): TopoNode {
  const facts: TopoFact[] = [];
  if (r.vendor) facts.push({ key: "vendor", value: routerVendorLabel(r.vendor) });
  facts.push({ key: "state", value: r.shortLabel });
  if (r.lastContactIso) facts.push({ key: "lastContact", value: r.lastContactIso, time: true });
  return {
    id: `gw:${r.key}`,
    kind: "gateway",
    label: r.label,
    sub: r.vendor ? routerVendorLabel(r.vendor) : null,
    status: routerStatus(r),
    statusText: r.shortLabel,
    facts,
    target: "devices",
  };
}

function controllerKind(d: ControllerDeviceRow): TopoKind {
  const t = d.deviceType.toLowerCase();
  if (t === "ap") return "ap";
  if (t === "switch") return "switch";
  return "device";
}

function controllerNode(d: ControllerDeviceRow): TopoNode {
  const facts: TopoFact[] = [];
  if (d.model) facts.push({ key: "model", value: d.model });
  if (d.ipAddress) facts.push({ key: "ip", value: d.ipAddress, mono: true });
  facts.push({ key: "mac", value: d.mac, mono: true });
  if (d.uptimeSeconds != null)
    facts.push({ key: "uptime", value: formatDuration(d.uptimeSeconds) });
  if (d.clientCount != null) facts.push({ key: "clients", value: String(d.clientCount) });
  if (d.firmwareVersion) facts.push({ key: "firmware", value: d.firmwareVersion, mono: true });
  facts.push({ key: "source", value: "controller" });
  return {
    id: `cd:${d.mac}`,
    kind: controllerKind(d),
    label: d.name || d.model || d.mac,
    sub: d.model,
    status: controllerDeviceStatus(d.status),
    statusText: d.status,
    facts,
    target: "devices",
  };
}

function hardwareKind(d: MonitoredDeviceRow): TopoKind {
  if (d.type === "Access Point") return "ap";
  return "device";
}

function hardwareNode(d: MonitoredDeviceRow): TopoNode {
  const { status, text } = hardwareStatus(d);
  const live = hardwareLivenessIsMeasured(d) ? describeLiveness(d) : null;
  const facts: TopoFact[] = [{ key: "type", value: d.type }];
  if (d.floor) facts.push({ key: "floor", value: d.floor });
  facts.push({ key: "mac", value: d.mac, mono: true });
  if (live?.detail) facts.push({ key: "detail", value: live.detail });
  if (d.lastSeenAt) facts.push({ key: "lastSeen", value: d.lastSeenAt, time: true });
  return {
    id: `hw:${d.id}`,
    kind: hardwareKind(d),
    label: d.name,
    sub: d.floor || d.type,
    status,
    statusText: text,
    facts,
    target: "devices",
  };
}

/** Problems first, then APs before other hardware, then by name -- so a
 * collapsed "+N more" never hides the one device that is down. */
function sortDownstream(nodes: TopoNode[]): TopoNode[] {
  const kindRank: Record<TopoKind, number> = {
    switch: 0,
    ap: 1,
    device: 2,
    isp: 9,
    gateway: 9,
    clients: 9,
    more: 9,
  };
  return [...nodes].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      kindRank[a.kind] - kindRank[b.kind] ||
      a.label.localeCompare(b.label),
  );
}

export function buildTopology(input: TopologyInput): TopologyModel {
  const max = Math.max(1, input.maxDownstream ?? 8);

  // --- ISPs
  let ispState: TopologyModel["ispState"];
  let isps: TopoNode[] = [];
  if (input.wan.status === "loading") ispState = "loading";
  else if (input.wan.status === "empty") ispState = "none";
  else {
    isps = input.wan.links.map(ispNode);
    ispState = isps.length ? "ready" : "none";
  }

  // --- Gateways
  const routers = input.liveness.routers ?? [];
  let gatewayState: TopologyModel["gatewayState"];
  if (routers.length > 0) gatewayState = "ready";
  else if (input.livenessLoading) gatewayState = "loading";
  else if (input.liveness.state === "no-router") gatewayState = "none";
  else gatewayState = "unreadable";
  const gateways = routers.map(gatewayNode);

  // --- Downstream
  let downstreamState: TopologyModel["downstreamState"];
  let source: TopologyModel["downstreamSource"] = null;
  let all: TopoNode[] = [];
  const ctl = input.controller;
  if (ctl && ctl.status === "ok" && ctl.devices.length > 0) {
    source = "controller";
    all = ctl.devices.map(controllerNode);
    downstreamState = "ready";
  } else if (input.hardware.length > 0) {
    source = "hardware";
    all = input.hardware.map(hardwareNode);
    downstreamState = "ready";
  } else if (input.hardwareLoading || ctl?.loading) {
    downstreamState = "loading";
  } else if (ctl && ctl.status === "unreachable") {
    downstreamState = "controller-unreachable";
  } else if (input.nasOnly) {
    // Aruba Instant On: nothing here sees the access points at all.
    downstreamState = "unmeasured";
  } else {
    downstreamState = "none";
  }

  const sorted = sortDownstream(all);
  let downstream = sorted;
  if (sorted.length > max) {
    const shown = sorted.slice(0, max - 1);
    const rest = sorted.slice(max - 1);
    downstream = [
      ...shown,
      {
        id: "more",
        kind: "more",
        label: `+${rest.length}`,
        sub: null,
        status: worstStatus(rest.map((n) => n.status)),
        statusText: null,
        facts: [],
        target: "devices",
        count: rest.length,
      },
    ];
  }

  // --- Clients. A count we hold, or no node at all: never a stand-in zero.
  const clients: TopoNode | null =
    input.onlineGuests == null
      ? null
      : {
          id: "clients",
          kind: "clients",
          label: input.onlineGuests.toLocaleString(),
          sub: null,
          status: input.onlineGuests > 0 ? "ok" : "unknown",
          statusText: null,
          facts: [],
          target: "users",
          count: input.onlineGuests,
        };

  const overall = worstStatus(
    [...isps, ...gateways, ...all].map((n) => n.status).filter((s) => s !== "unknown"),
  );

  return {
    ispState,
    isps,
    gatewayState,
    gateways,
    downstreamState,
    downstreamSource: source,
    downstream,
    downstreamTotal: all.length,
    downstreamCounts: countByStatus(all),
    clients,
    overall: [...isps, ...gateways, ...all].length === 0 ? "unknown" : overall,
  };
}
