/** Pure helpers for the fiber plant screens (J22, lane JAZE-6 B). No React,
 * no API: `scripts/test-isp-partner-pppoe.mjs` runs them. Rules mirror
 * `fiber_router.py` / `fiber_service.py`; the API stays the authority. */
import type {
  FiberKind,
  FiberNode,
  FiberNodeBody,
  FiberPort,
  FiberStatus,
} from "@/services/isp-partner/fiber-types";

export const KIND_LABEL: Record<FiberKind, string> = {
  olt: "OLT",
  pole: "Pole",
  splitter: "Splitter",
  joint_closure: "Joint closure",
  ont: "ONT (subscriber end)",
  other: "Other",
};

export const STATUS_LABEL: Record<FiberStatus, string> = {
  active: "Active",
  planned: "Planned",
  retired: "Retired",
};

export function kindLabel(k: string): string {
  return (KIND_LABEL as Record<string, string>)[k] ?? k;
}

export function statusTone(s: string): string {
  return s === "active" ? "active" : s === "planned" ? "pending" : "normal";
}

/** An ONT is a leaf: the API refuses port_count on it. */
export function kindTakesPorts(k: string): boolean {
  return k !== "ont";
}

export interface NodeDraft {
  kind: FiberKind;
  name: string;
  code: string;
  status: FiberStatus;
  parent_id: string;
  parent_port: string;
  port_count: string;
  spec: string;
  address: string;
  latitude: string;
  longitude: string;
  isp_customer_id: string;
  notes: string;
}

export function nodeDraft(n?: FiberNode | null, parentId?: string): NodeDraft {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    kind: (n?.kind as FiberKind) ?? "splitter",
    name: s(n?.name),
    code: s(n?.code),
    status: (n?.status as FiberStatus) ?? "active",
    parent_id: n ? s(n.parent_id) : (parentId ?? ""),
    parent_port: s(n?.parent_port),
    port_count: s(n?.port_count),
    spec: s(n?.spec),
    address: s(n?.address),
    latitude: s(n?.latitude),
    longitude: s(n?.longitude),
    isp_customer_id: s(n?.isp_customer_id),
    notes: s(n?.notes),
  };
}

function intIn(v: string, lo: number, hi: number): number | null | "bad" {
  const t = v.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return "bad";
  const n = Number(t);
  return n >= lo && n <= hi ? n : "bad";
}

function coord(v: string, lim: number): number | null | "bad" {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= lim ? n : "bad";
}

/** Draft -> API body. With `current` it is a PATCH: only changed keys are
 * sent (the API treats an omitted key as "leave it"). */
export function nodeBody(
  d: NodeDraft,
  current?: FiberNode | null,
): { body: FiberNodeBody } | { error: string } {
  const name = d.name.trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name: at most 120 characters." };
  if (d.code.trim().length > 40) return { error: "Code: at most 40 characters." };
  const ports = intIn(d.port_count, 1, 1024);
  if (ports === "bad") return { error: "Ports must be a whole number from 1 to 1024." };
  if (ports !== null && !kindTakesPorts(d.kind))
    return { error: "An ONT has no splitter ports; leave Ports blank." };
  const pport = intIn(d.parent_port, 1, 1024);
  if (pport === "bad") return { error: "Upstream port must be a whole number from 1 to 1024." };
  if (pport !== null && !d.parent_id) return { error: "Pick the upstream node for that port." };
  if (current && d.parent_id === current.id) return { error: "A node cannot feed itself." };
  const lat = coord(d.latitude, 90);
  const lng = coord(d.longitude, 180);
  if (lat === "bad") return { error: "Latitude must be between -90 and 90." };
  if (lng === "bad") return { error: "Longitude must be between -180 and 180." };
  if ((lat === null) !== (lng === null))
    return { error: "Give both latitude and longitude, or neither." };

  const full: Required<FiberNodeBody> = {
    kind: d.kind,
    name,
    code: d.code.trim() || null,
    status: d.status,
    parent_id: d.parent_id || null,
    parent_port: pport,
    port_count: ports,
    spec: d.spec.trim() || null,
    address: d.address.trim() || null,
    latitude: lat,
    longitude: lng,
    isp_customer_id: d.isp_customer_id || null,
    notes: d.notes.trim() || null,
  };
  if (!current) {
    // Create: drop empty optionals (status/kind/name always go).
    const body: FiberNodeBody = {};
    for (const [k, v] of Object.entries(full) as [keyof FiberNodeBody, unknown][])
      if (v !== null) (body as Record<string, unknown>)[k] = v;
    return { body };
  }
  const body: FiberNodeBody = {};
  for (const k of Object.keys(full) as (keyof FiberNodeBody)[]) {
    const was = (current as unknown as Record<string, unknown>)[k] ?? null;
    if (full[k] !== was) (body as Record<string, unknown>)[k] = full[k];
  }
  // The API wants the pair together.
  if ("latitude" in body || "longitude" in body) {
    body.latitude = full.latitude;
    body.longitude = full.longitude;
  }
  return { body };
}

export function portSummary(ports: FiberPort[]): {
  total: number;
  free: number;
  subscribers: number;
  nodes: number;
} {
  const count = (s: FiberPort["state"]) => ports.filter((p) => p.state === s).length;
  return {
    total: ports.length,
    free: count("free"),
    subscribers: count("subscriber"),
    nodes: count("node"),
  };
}

/** "Root › Splitter 2 (port 3) › ONT" breadcrumb text. */
export function routeText(hops: { name: string; parent_port: number | null }[]): string {
  return hops
    .map((h, i) => (i > 0 && h.parent_port ? `${h.name} (port ${h.parent_port})` : h.name))
    .join(" › ");
}
