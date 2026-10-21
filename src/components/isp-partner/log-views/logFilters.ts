/**
 * Partner log filters and their URL form (TASKS FE-8: filters round-trip in
 * the search params). Pure; reuses the customer NetLogs vocabulary from
 * `lib/netlogs.ts` (read-only import).
 */
import { NETLOGS_CATEGORIES, NETLOGS_SEVERITIES, NETLOGS_MAX_QUERY_LENGTH } from "@/lib/netlogs";

export type LogTab = "netlogs" | "ipdr" | "auth";
export const LOG_TABS: readonly LogTab[] = ["netlogs", "ipdr", "auth"];

export const LOG_RANGES = ["24h", "7d", "30d", "90d"] as const;
export type LogRange = (typeof LOG_RANGES)[number];
export const LOG_RANGE_LABEL: Record<LogRange, string> = {
  "24h": "Last 24 h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};
const DAY = 86_400_000;
const RANGE_MS: Record<LogRange, number> = {
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
};

export interface LogFilters {
  tab: LogTab;
  customer: string;
  location: string;
  router: string;
  range: LogRange;
  severity: string[];
  category: string[];
  q: string;
}

export const DEFAULT_LOG_FILTERS: LogFilters = {
  tab: "netlogs",
  customer: "",
  location: "",
  router: "",
  range: "24h",
  severity: [],
  category: [],
  q: "",
};

export interface LogSearch {
  tab?: string;
  cust?: string;
  loc?: string;
  router?: string;
  range?: string;
  sev?: string;
  cat?: string;
  q?: string;
}

const ID = /^[0-9a-fA-F-]{36}$/;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
function list(v: unknown, allowed: readonly string[]): string[] {
  const wanted = new Set(
    str(v)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.filter((a) => wanted.has(a));
}

export function filtersFromSearch(s: Record<string, unknown> | undefined): LogFilters {
  const search = s ?? {};
  const tab = (LOG_TABS as readonly string[]).includes(str(search.tab))
    ? (str(search.tab) as LogTab)
    : DEFAULT_LOG_FILTERS.tab;
  const range = (LOG_RANGES as readonly string[]).includes(str(search.range))
    ? (str(search.range) as LogRange)
    : DEFAULT_LOG_FILTERS.range;
  const id = (v: unknown) => (ID.test(str(v)) ? str(v) : "");
  return {
    tab,
    customer: id(search.cust),
    location: id(search.loc),
    router: id(search.router),
    range,
    severity: list(search.sev, NETLOGS_SEVERITIES),
    category: list(search.cat, NETLOGS_CATEGORIES),
    q: str(search.q).slice(0, NETLOGS_MAX_QUERY_LENGTH),
  };
}

export function searchFromFilters(f: LogFilters): LogSearch {
  const out: LogSearch = {};
  if (f.tab !== DEFAULT_LOG_FILTERS.tab) out.tab = f.tab;
  if (f.customer) out.cust = f.customer;
  if (f.location) out.loc = f.location;
  if (f.router) out.router = f.router;
  if (f.range !== DEFAULT_LOG_FILTERS.range) out.range = f.range;
  if (f.severity.length) out.sev = f.severity.join(",");
  if (f.category.length) out.cat = f.category.join(",");
  if (f.q.trim()) out.q = f.q.trim();
  return out;
}

/** `since`/`until` for a range at `now`. */
export function rangeWindow(range: LogRange, now: number): { since: string; until: string } {
  return {
    since: new Date(now - RANGE_MS[range]).toISOString(),
    until: new Date(now).toISOString(),
  };
}

/** The scope params every log endpoint shares (API_CONTRACT §4.9). */
export function scopeParams(
  f: LogFilters,
  window: { since: string; until: string },
): Record<string, string> {
  const p: Record<string, string> = { since: window.since, until: window.until };
  if (f.customer) p.isp_customer_id = f.customer;
  if (f.location) p.isp_location_id = f.location;
  if (f.router) p.isp_router_id = f.router;
  return p;
}

export function netLogParams(
  f: LogFilters,
  window: { since: string; until: string },
): Record<string, string> {
  const p = scopeParams(f, window);
  if (f.severity.length) p.severity = f.severity.join(",");
  if (f.category.length) p.category = f.category.join(",");
  const q = f.q.trim().slice(0, NETLOGS_MAX_QUERY_LENGTH);
  if (q) p.q = q;
  return p;
}
