/** Non-component exports split out of `ConnectedDevicesPanel.tsx` so that file
 * only exports components (react-refresh/only-export-components). */
import { Search, Wifi } from "lucide-react";
import { maskMac } from "@/lib/masking";
import type { ConnectedRow } from "./ConnectedDevicesPanel";

export type SortKey = "mac" | "ip" | "device" | "firstSeen" | "lastSeen";

function ipNum(ip: string): number {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return Number.POSITIVE_INFINITY;
  return ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3];
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Raw rows -> display rows. The ONLY place the raw MAC is read. Pure, so the
 * masking rule is testable without a browser. */
export function toConnectedRows(
  raw: ReadonlyArray<{ m: unknown; i: unknown; d: unknown; fs: unknown; ls: unknown }>,
  masked: boolean,
): ConnectedRow[] {
  return raw.map((r, idx) => {
    const mac = str(r.m);
    return {
      idx,
      mac: masked ? maskMac(mac) : mac,
      ip: str(r.i),
      device: str(r.d),
      firstSeen: str(r.fs),
      lastSeen: str(r.ls),
    };
  });
}

/** Search + sort over display values only. "First/Last seen" are the API's
 * own relative strings ("2 min ago"), so they sort by the API's order, never
 * by a parse of the words. */
export function queryConnectedRows(
  rows: readonly ConnectedRow[],
  query: string,
  sort: { key: SortKey; dir: 1 | -1 },
): ConnectedRow[] {
  const q = query.trim().toLowerCase();
  const hit = q
    ? rows.filter((r) => [r.mac, r.ip, r.device].some((v) => v.toLowerCase().includes(q)))
    : [...rows];
  const cmp = (a: ConnectedRow, b: ConnectedRow): number => {
    switch (sort.key) {
      case "mac":
        return a.mac.localeCompare(b.mac);
      case "ip":
        return ipNum(a.ip) - ipNum(b.ip) || a.ip.localeCompare(b.ip);
      case "device":
        return a.device.localeCompare(b.device);
      case "firstSeen":
      case "lastSeen":
      default:
        return a.idx - b.idx;
    }
  };
  return hit.sort((a, b) => cmp(a, b) * sort.dir || a.idx - b.idx);
}
