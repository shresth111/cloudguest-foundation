/**
 * Pure presentation model for the Internet Connection page and the
 * Overview's Internet Connection card. Everything here turns rows the page
 * already holds (`IspLink`, `IspHealthCheck`, `IspHealthCheckSummary`) into
 * what the UI shows. It fetches nothing and invents nothing: an unknown
 * stays unknown (null), never a zero.
 */
import type {
  IspHealthCheck,
  IspHealthCheckBucket,
  IspHealthCheckSummary,
  IspLink,
} from "@/types/isp";
import type { ConsoleStatus } from "@/components/customer/console";

/** A link's health as one of the console's five states. "unknown" (never
 * checked) is neutral grey, not a fault. */
export function linkStatus(healthStatus: string | null | undefined): ConsoleStatus {
  switch (healthStatus) {
    case "healthy":
      return "ok";
    case "degraded":
      return "warn";
    case "unhealthy":
      return "crit";
    default:
      return "offline";
  }
}

/** Active uplink first, then primary before backup, then priority. */
export function sortLinks(links: IspLink[]): IspLink[] {
  return [...links].sort((a, b) => {
    if (a.isActiveUplink !== b.isActiveUplink) return a.isActiveUplink ? -1 : 1;
    if (a.role !== b.role) return a.role === "primary" ? -1 : 1;
    return a.priority - b.priority;
  });
}

export type FailoverKind =
  /** No link at all. */
  | "none"
  /** One link: there is nothing to fail over to. */
  | "single"
  /** Two or more links, traffic on a primary. */
  | "normal"
  /** Traffic is on a backup line: the failover state worth shouting about. */
  | "on-backup"
  /** Every enabled link is down. */
  | "all-down"
  /** Links exist but none is marked active (not checked yet, or the router
   * has not reported which line carries traffic). */
  | "unknown";

export interface FailoverState {
  kind: FailoverKind;
  active: IspLink | null;
  /** The primary line that is not carrying traffic, when on backup. */
  primary: IspLink | null;
  /** When the primary went down -- `IspLink.unhealthySince`, computed
   * server-side. Null when the server did not report one; the UI then says
   * "on backup" without a time rather than guessing. */
  since: string | null;
}

export function failoverState(links: IspLink[]): FailoverState {
  const enabled = links.filter((l) => l.isEnabled);
  if (enabled.length === 0) return { kind: "none", active: null, primary: null, since: null };
  const active = enabled.find((l) => l.isActiveUplink) ?? null;
  const known = enabled.filter((l) => l.healthStatus && l.healthStatus !== "unknown");
  if (known.length > 0 && known.every((l) => l.healthStatus === "unhealthy")) {
    const earliest = known
      .map((l) => l.unhealthySince)
      .filter((v): v is string => !!v)
      .sort()[0];
    return { kind: "all-down", active, primary: null, since: earliest ?? null };
  }
  if (enabled.length === 1) return { kind: "single", active, primary: null, since: null };
  if (!active) return { kind: "unknown", active: null, primary: null, since: null };
  if (active.role === "backup") {
    const primary =
      sortLinks(enabled.filter((l) => l.role === "primary" && l.id !== active.id))[0] ?? null;
    return { kind: "on-backup", active, primary, since: primary?.unhealthySince ?? null };
  }
  return { kind: "normal", active, primary: null, since: null };
}

/** How long a link has been in its current state, from the newest-first
 * raw checks the page holds. `atLeast` is true when every check in hand
 * agrees -- the state is older than the window we can see, and the UI must
 * say "for at least", not claim a start time. For a link that is down the
 * server's own `unhealthySince` wins. */
export function stateSince(
  link: IspLink,
  checksNewestFirst: IspHealthCheck[],
): { iso: string; atLeast: boolean } | null {
  if (link.healthStatus === "unhealthy" && link.unhealthySince) {
    return { iso: link.unhealthySince, atLeast: false };
  }
  if (!checksNewestFirst.length) return null;
  if (checksNewestFirst[0].status !== link.healthStatus) return null;
  let oldestSame = checksNewestFirst[0];
  for (const c of checksNewestFirst) {
    if (c.status !== link.healthStatus) return { iso: oldestSame.checkedAt, atLeast: false };
    oldestSame = c;
  }
  return { iso: oldestSame.checkedAt, atLeast: true };
}

/** Share of checks in range that were not unhealthy -- the same formula the
 * old history dialog used. Null when there were no checks. */
export function uptimePercent(buckets: IspHealthCheckBucket[]): number | null {
  const total = buckets.reduce((s, b) => s + b.totalChecks, 0);
  if (total <= 0) return null;
  return (100 * buckets.reduce((s, b) => s + (b.totalChecks - b.unhealthyCount), 0)) / total;
}

export interface Incident {
  id: string;
  linkId: string;
  severity: "crit" | "warn";
  /** First bucket start (inclusive). */
  start: string;
  /** Last bucket's end (exclusive). */
  end: string;
  bucketStarts: string[];
  failedChecks: number;
  degradedChecks: number;
  totalChecks: number;
  worstLatencyMs: number | null;
  worstLossPct: number | null;
}

const UNIT_MS = { hour: 3_600_000, day: 86_400_000 } as const;

/** A bucket counts as part of an incident when any check in it failed
 * (crit), or when at least a fifth of its checks were degraded (warn).
 * Adjacent such buckets merge into one window. Read from the server's own
 * per-bucket counts -- never one bar per raw check. */
export function incidentsFromSummary(linkId: string, summary: IspHealthCheckSummary): Incident[] {
  const unit = UNIT_MS[summary.bucketUnit] ?? UNIT_MS.hour;
  const flagged = summary.buckets
    .filter((b) => b.totalChecks > 0)
    .map((b) => {
      const sev: Incident["severity"] | null =
        b.unhealthyCount > 0 ? "crit" : b.degradedCount / b.totalChecks >= 0.2 ? "warn" : null;
      return { b, sev };
    })
    .filter((x): x is { b: IspHealthCheckBucket; sev: Incident["severity"] } => x.sev !== null)
    .sort((a, b) => a.b.bucketStart.localeCompare(b.b.bucketStart));
  const out: Incident[] = [];
  for (const { b, sev } of flagged) {
    const startMs = new Date(b.bucketStart).getTime();
    const last = out[out.length - 1];
    if (last && new Date(last.end).getTime() >= startMs) {
      last.end = new Date(startMs + unit).toISOString();
      last.bucketStarts.push(b.bucketStart);
      if (sev === "crit") last.severity = "crit";
      last.failedChecks += b.unhealthyCount;
      last.degradedChecks += b.degradedCount;
      last.totalChecks += b.totalChecks;
      last.worstLatencyMs = maxOrNull(last.worstLatencyMs, b.avgLatencyMs);
      last.worstLossPct = maxOrNull(last.worstLossPct, b.avgPacketLossPercentage);
      continue;
    }
    out.push({
      id: `${linkId}:${b.bucketStart}`,
      linkId,
      severity: sev,
      start: b.bucketStart,
      end: new Date(startMs + unit).toISOString(),
      bucketStarts: [b.bucketStart],
      failedChecks: b.unhealthyCount,
      degradedChecks: b.degradedCount,
      totalChecks: b.totalChecks,
      worstLatencyMs: b.avgLatencyMs,
      worstLossPct: b.avgPacketLossPercentage,
    });
  }
  return out;
}

function maxOrNull(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/** One chart row per bucket start, across every link: `t` is the bucket's
 * epoch ms; `<i>_lat`, `<i>_loss`, `<i>_down`, `<i>_up`, `<i>_uptime` per
 * link index. A missing value stays undefined, so Recharts draws a gap. */
export interface HistoryRow {
  t: number;
  [key: string]: number | null | undefined;
}

export function mergeHistory(summaries: Array<IspHealthCheckSummary | null>): HistoryRow[] {
  const rows = new Map<number, HistoryRow>();
  summaries.forEach((s, i) => {
    if (!s) return;
    for (const b of s.buckets) {
      if (b.totalChecks <= 0) continue;
      const t = new Date(b.bucketStart).getTime();
      if (!Number.isFinite(t)) continue;
      const row = rows.get(t) ?? { t };
      row[`${i}_lat`] = b.avgLatencyMs;
      row[`${i}_loss`] = b.avgPacketLossPercentage;
      row[`${i}_down`] = b.avgDownloadMbps;
      row[`${i}_up`] = b.avgUploadMbps;
      row[`${i}_uptime`] = b.uptimePercentage;
      rows.set(t, row);
    }
  });
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

/** State changes in the newest-first raw checks, returned newest first.
 * Only what the rows show: the first row has no "from". */
export interface StateChange {
  at: string;
  from: string;
  to: string;
  source: string;
}

export function stateChanges(checksNewestFirst: IspHealthCheck[]): StateChange[] {
  const asc = [...checksNewestFirst].reverse();
  const out: StateChange[] = [];
  for (let i = 1; i < asc.length; i++) {
    if (asc[i].status !== asc[i - 1].status) {
      out.push({
        at: asc[i].checkedAt,
        from: asc[i - 1].status,
        to: asc[i].status,
        source: asc[i].source,
      });
    }
  }
  return out.reverse();
}

/** Current rate as a share of plan, clamped 0..1. Null if either is unknown. */
export function planShare(current: number | null, plan: number | null): number | null {
  if (current == null || plan == null || plan <= 0) return null;
  return Math.max(0, Math.min(1, current / plan));
}

/* ---------- response-shape guards ----------
 * The service maps backend rows field by field; these catch a body that is
 * not the shape at all (an HTML error page, a renamed envelope) so a section
 * shows its error state instead of throwing mid-render. */

export function isSummary(x: unknown): x is IspHealthCheckSummary {
  if (!x || typeof x !== "object") return false;
  const s = x as IspHealthCheckSummary;
  return (
    (s.bucketUnit === "hour" || s.bucketUnit === "day") &&
    Array.isArray(s.buckets) &&
    s.buckets.every(
      (b) => b && typeof b.bucketStart === "string" && typeof b.totalChecks === "number",
    )
  );
}

export function isCheckList(x: unknown): x is IspHealthCheck[] {
  return (
    Array.isArray(x) &&
    x.every((c) => c && typeof c.checkedAt === "string" && typeof c.status === "string")
  );
}

export function isLinkList(x: unknown): x is IspLink[] {
  return (
    Array.isArray(x) &&
    x.every((l) => l && typeof l.id === "string" && typeof l.providerName === "string")
  );
}
