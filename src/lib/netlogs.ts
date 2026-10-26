/**
 * NetLogs (customer dashboard): every pure decision the page makes, in one
 * dependency-free module so `scripts/test-netlogs.mjs` can execute it.
 *
 *   - filters <-> URL search params (the page keeps every filter in the URL,
 *     so a link or a reload reopens the same view);
 *   - the time window a filter set means, and the query params it sends;
 *   - status badge colour, severity / category wording;
 *   - the friendly sentence for each backend error code;
 *   - the chart rows built from `/device-logs/summary`.
 *
 * Contract: cloud-guest#420 (`app/domains/device_logs/customer_router.py`,
 * `schemas.py`, `exceptions.py`). The backend validates every list filter
 * against its own vocabulary (422 `NETLOGS_BAD_FILTER`), so the lists here
 * mirror `LogCategory`, `LogStatus` and `SEVERITY_NAMES` exactly, and
 * anything else in a URL is dropped rather than sent.
 *
 * Never named or shown here: tunnel addresses, WireGuard, or how a line was
 * tied to a router. Those are Master-console internals.
 */
import type { NetLogEvent, NetLogSummary } from "@/types/netlogs";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const NETLOGS_PRESETS = ["24h", "7d", "30d", "90d", "1y", "2y"] as const;
export type NetLogsPreset = (typeof NETLOGS_PRESETS)[number];
export type NetLogsRange = NetLogsPreset | "custom";

export const NETLOGS_PRESET_LABEL: Record<NetLogsPreset, string> = {
  "24h": "24 h",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "1y": "1 year",
  "2y": "2 years",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const PRESET_MS: Record<NetLogsPreset, number> = {
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "90d": 90 * DAY_MS,
  "1y": 365 * DAY_MS,
  "2y": 730 * DAY_MS,
};

/** The backend clamps any window to this many days (CUSTOMER_MAX_QUERY_WINDOW_DAYS). */
export const NETLOGS_MAX_WINDOW_DAYS = 730;
/** `q` is `max_length=200` on every route. */
export const NETLOGS_MAX_QUERY_LENGTH = 200;
/** One page of the list. The backend allows up to 500. */
export const NETLOGS_PAGE_SIZE = 100;
/** The CSV export's own row cap (CUSTOMER_EXPORT_MAX_ROWS). */
export const NETLOGS_EXPORT_MAX_ROWS = 100_000;

/** `LogCategory`, in the order the filter and the chart legend list them. */
export const NETLOGS_CATEGORIES = [
  "dhcp",
  "hotspot_auth",
  "radius",
  "firewall",
  "dns",
  "system",
  "wireless",
  "other",
] as const;

export const NETLOGS_CATEGORY_LABEL: Record<string, string> = {
  dhcp: "DHCP",
  hotspot_auth: "Hotspot sign-in",
  radius: "RADIUS",
  firewall: "Firewall",
  dns: "DNS",
  system: "System",
  wireless: "Wireless",
  other: "Other",
};

/** `LogStatus`. */
export const NETLOGS_STATUSES = [
  "success",
  "failure",
  "accept",
  "reject",
  "blocked",
  "allowed",
  "connected",
  "disconnected",
  "released",
] as const;

/** `SEVERITY_NAMES`, most to least severe. */
export const NETLOGS_SEVERITIES = [
  "emergency",
  "alert",
  "critical",
  "error",
  "warning",
  "notice",
  "info",
  "debug",
] as const;

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "Other";
  return NETLOGS_CATEGORY_LABEL[category] ?? titleCase(category);
}

/** A captive-portal failure is written by WyfyGuest's portal API, not by a
 * router hotspot. Keeping that provenance in the row prevents a portal retry
 * from looking like it contradicted a separate RADIUS decision. */
export function eventCategoryLabel(
  event: Pick<NetLogEvent, "category" | "source" | "protocol">,
): string {
  if (event.source === "captive_portal" || event.protocol === "PORTAL") {
    return "Portal sign-in";
  }
  return categoryLabel(event.category);
}

export function titleCase(value: string): string {
  const s = value.replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Status and severity presentation
// ---------------------------------------------------------------------------

export type StatusTone = "positive" | "negative" | "neutral";

const POSITIVE_STATUSES = new Set(["success", "accept", "allowed", "connected"]);
const NEGATIVE_STATUSES = new Set(["reject", "failure", "blocked"]);

/** Green for a good outcome, red for a refused one, neutral for everything
 * else -- including `disconnected`/`released` (normal, not failures) and a
 * line that states no outcome at all. */
export function statusTone(status: string | null | undefined): StatusTone {
  const s = (status ?? "").toLowerCase();
  if (POSITIVE_STATUSES.has(s)) return "positive";
  if (NEGATIVE_STATUSES.has(s)) return "negative";
  return "neutral";
}

/** Tailwind classes for the status badge, per tone. */
export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  positive:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  negative:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

/** A line with no outcome reads as a dash, not as a guessed status. */
export function statusLabel(status: string | null | undefined): string {
  return status ? titleCase(status) : "—";
}

export type SeverityTone = "error" | "warning" | "quiet";

/** 0-3 is an error, 4 a warning (the summary's own split); the rest -- and
 * a line with no syslog priority -- stay quiet. */
export function severityTone(severity: number | null | undefined): SeverityTone {
  if (severity === null || severity === undefined) return "quiet";
  if (severity <= 3) return "error";
  if (severity === 4) return "warning";
  return "quiet";
}

/** "Unknown" for a line without a priority, never "Info". */
export function severityLabel(event: Pick<NetLogEvent, "severity" | "severity_name">): string {
  if (event.severity_name) return titleCase(event.severity_name);
  if (event.severity !== null && event.severity >= 0 && event.severity <= 7) {
    return titleCase(NETLOGS_SEVERITIES[event.severity]);
  }
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Row presentation
// ---------------------------------------------------------------------------

/** Device/Host column: the router's name in this account, else the name the
 * device sent; plus the venue as a small label. */
export function deviceHost(
  event: Pick<NetLogEvent, "router_name" | "hostname" | "location_name" | "source">,
): {
  name: string;
  location: string | null;
} {
  if (event.source === "captive_portal") {
    return { name: "WyfyGuest Portal", location: event.location_name?.trim() || null };
  }
  const name = event.router_name?.trim() || event.hostname?.trim() || "Unknown device";
  return { name, location: event.location_name?.trim() || null };
}

/** Message column: the short headline when the backend has one, with the
 * full line available on expand; otherwise the full line itself. */
export function messageParts(
  event: Pick<NetLogEvent, "summary" | "message"> & Partial<Pick<NetLogEvent, "source" | "status">>,
): {
  headline: string;
  detail: string | null;
} {
  const summary = event.summary?.trim();
  // The backend deliberately keeps the auth method and reason in the raw
  // message. For a portal rejection, hiding that reason behind an expand
  // control makes operators retry blindly and wrongly blame RADIUS.
  const portalReason =
    event.source === "captive_portal" && event.status === "failure"
      ? event.message.match(/^.+? sign-in failed:\s*(.+)$/i)?.[1]?.trim()
      : null;
  if (summary && portalReason) {
    return { headline: `${summary} — ${portalReason}`, detail: event.message || null };
  }
  if (summary) return { headline: summary, detail: event.message || null };
  return { headline: event.message, detail: null };
}

// ---------------------------------------------------------------------------
// Filters <-> URL
// ---------------------------------------------------------------------------

/** `location`: "" follows the venue picked in the dashboard header, "all"
 * means every venue (offered to organisation-wide callers only), anything
 * else is a location id. */
export interface NetLogsFilters {
  range: NetLogsRange;
  /** `YYYY-MM-DD`, custom range only. */
  from: string;
  to: string;
  location: string;
  router: string;
  severity: string[];
  category: string[];
  status: string[];
  q: string;
}

export const DEFAULT_NETLOGS_FILTERS: NetLogsFilters = {
  range: "24h",
  from: "",
  to: "",
  location: "",
  router: "",
  severity: [],
  category: [],
  status: [],
  q: "",
};

/** The URL shape. Short keys, comma-joined lists, defaults omitted. */
export interface NetLogsSearch {
  range?: string;
  from?: string;
  to?: string;
  loc?: string;
  router?: string;
  sev?: string;
  cat?: string;
  st?: string;
  q?: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Location and router ids are UUIDs; "all" is the one non-id location value. */
const ID = /^[0-9a-fA-F-]{8,64}$/;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** A comma list from the URL, lower-cased, de-duplicated, restricted to the
 * backend's own vocabulary and returned in that vocabulary's order. */
function list(value: unknown, allowed: readonly string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : str(value);
  const wanted = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.filter((a) => wanted.has(a));
}

/** Read the page's filters out of a (possibly hand-edited) URL. Anything not
 * understood falls back to the default instead of being sent and 422-ing. */
export function filtersFromSearch(
  search: Record<string, unknown> | null | undefined,
): NetLogsFilters {
  const s = search ?? {};
  const rangeRaw = str(s.range);
  let range: NetLogsRange = (NETLOGS_PRESETS as readonly string[]).includes(rangeRaw)
    ? (rangeRaw as NetLogsPreset)
    : rangeRaw === "custom"
      ? "custom"
      : DEFAULT_NETLOGS_FILTERS.range;
  let from = validDay(str(s.from)) ? str(s.from) : "";
  let to = validDay(str(s.to)) ? str(s.to) : "";
  if (range === "custom") {
    if (!from || !to) {
      // A custom range missing either end is not a range.
      range = DEFAULT_NETLOGS_FILTERS.range;
      from = "";
      to = "";
    } else if (from > to) {
      [from, to] = [to, from];
    }
  } else {
    from = "";
    to = "";
  }
  const locRaw = str(s.loc);
  const location = locRaw === "all" || ID.test(locRaw) ? locRaw : "";
  const routerRaw = str(s.router);
  const router = ID.test(routerRaw) ? routerRaw : "";
  return {
    range,
    from,
    to,
    location,
    router,
    severity: list(s.sev, NETLOGS_SEVERITIES),
    category: list(s.cat, NETLOGS_CATEGORIES),
    status: list(s.st, NETLOGS_STATUSES),
    q: str(s.q).slice(0, NETLOGS_MAX_QUERY_LENGTH),
  };
}

/** The inverse: only non-default values, so the bare page URL stays bare. */
export function searchFromFilters(f: NetLogsFilters): NetLogsSearch {
  const out: NetLogsSearch = {};
  if (f.range !== DEFAULT_NETLOGS_FILTERS.range) out.range = f.range;
  if (f.range === "custom") {
    if (f.from) out.from = f.from;
    if (f.to) out.to = f.to;
  }
  if (f.location) out.loc = f.location;
  if (f.router) out.router = f.router;
  if (f.severity.length) out.sev = f.severity.join(",");
  if (f.category.length) out.cat = f.category.join(",");
  if (f.status.length) out.st = f.status.join(",");
  const q = f.q.trim().slice(0, NETLOGS_MAX_QUERY_LENGTH);
  if (q) out.q = q;
  return out;
}

/** True when any filter narrows the list (the window does not count). */
export function hasNarrowingFilters(f: NetLogsFilters): boolean {
  return (
    !!f.router ||
    f.severity.length > 0 ||
    f.category.length > 0 ||
    f.status.length > 0 ||
    f.q.trim() !== ""
  );
}

/**
 * Which venue the request is for.
 *
 *   - an explicit location id always wins;
 *   - "all" means every venue, but only for an organisation-wide caller --
 *     a location-scoped caller asking for "all" would be refused, so they
 *     stay on their own venue;
 *   - nothing chosen follows the venue in the dashboard header.
 *
 * `null` = every venue the caller may read (no `location_id` sent).
 */
export function effectiveLocationId(
  f: Pick<NetLogsFilters, "location">,
  activeLocationId: string | null,
  orgWide: boolean,
): string | null {
  if (f.location && f.location !== "all") return f.location;
  if (f.location === "all" && orgWide) return null;
  return activeLocationId;
}

// ---------------------------------------------------------------------------
// Window and query params
// ---------------------------------------------------------------------------

export interface NetLogsWindow {
  since: Date;
  until: Date;
  /** The asked-for window was longer than the backend allows and was cut. */
  clamped: boolean;
}

function localMidnight(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The window a filter set means, at `now` (pinned by the caller so "Load
 * more" pages share one window). A custom range runs from the start of its
 * first day to the end of its last, in the viewer's own timezone, and never
 * past `now`.
 */
export function netLogsWindow(
  f: Pick<NetLogsFilters, "range" | "from" | "to">,
  now: number,
): NetLogsWindow {
  if (f.range === "custom" && validDay(f.from) && validDay(f.to)) {
    let since = localMidnight(f.from <= f.to ? f.from : f.to);
    const lastDay = localMidnight(f.from <= f.to ? f.to : f.from);
    let until = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1);
    if (until.getTime() > now) until = new Date(now);
    if (since.getTime() > until.getTime()) since = new Date(until.getTime());
    const max = NETLOGS_MAX_WINDOW_DAYS * DAY_MS;
    const clamped = until.getTime() - since.getTime() > max;
    if (clamped) since = new Date(until.getTime() - max);
    return { since, until, clamped };
  }
  const preset: NetLogsPreset =
    f.range === "custom" ? (DEFAULT_NETLOGS_FILTERS.range as NetLogsPreset) : f.range;
  return { since: new Date(now - PRESET_MS[preset]), until: new Date(now), clamped: false };
}

/**
 * Query params shared by the list, the summary and the export. Lists are
 * comma-joined (the backend accepts repeated or comma-separated values).
 * There is never an `organization_id`: the organisation is the request
 * context's (`X-Organization-Id`).
 */
export function netLogsParams(
  f: NetLogsFilters,
  window: Pick<NetLogsWindow, "since" | "until">,
  locationId: string | null,
): Record<string, string> {
  const params: Record<string, string> = {
    since: window.since.toISOString(),
    until: window.until.toISOString(),
  };
  if (locationId) params.location_id = locationId;
  if (f.router) params.router_id = f.router;
  if (f.severity.length) params.severity = f.severity.join(",");
  if (f.category.length) params.category = f.category.join(",");
  if (f.status.length) params.status = f.status.join(",");
  const q = f.q.trim().slice(0, NETLOGS_MAX_QUERY_LENGTH);
  if (q) params.q = q;
  return params;
}

/** The list's params: the shared ones plus page size and cursor. */
export function netLogsListParams(
  base: Record<string, string>,
  cursor: string | null | undefined,
  limit: number = NETLOGS_PAGE_SIZE,
): Record<string, string> {
  const params: Record<string, string> = { ...base, limit: String(limit) };
  if (cursor) params.cursor = cursor;
  return params;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface NetLogsErrorLike {
  status: number | null;
  code?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface FriendlyError {
  title: string;
  detail: string;
  /** The filter the error is about, when clearing it is the fix. */
  clear?: "location" | "router" | "filters";
}

/**
 * One sentence per failure the backend can give this page. The backend's
 * own message is not shown: for some codes it names a platform setting the
 * customer has nothing to do with.
 */
export function netLogsErrorMessage(error: NetLogsErrorLike | null | undefined): FriendlyError {
  if (!error) {
    return { title: "Couldn't load network logs", detail: "Something went wrong. Try again." };
  }
  const code = typeof error.data?.code === "string" ? error.data.code : "";
  switch (code) {
    case "NETLOGS_LOCATION_NOT_FOUND":
      return {
        title: "That location isn't in your account",
        detail: "It may have been removed. Pick another location to see its logs.",
        clear: "location",
      };
    case "NETLOGS_ROUTER_NOT_FOUND":
      return {
        title: "That router isn't in your account",
        detail: "It may have been removed or moved. Pick another router, or show all routers.",
        clear: "router",
      };
    case "NETLOGS_LOCATION_FORBIDDEN":
      return {
        title: "You can't view this location's logs",
        detail:
          "Your access doesn't include network logs for this location. Pick one of your own locations, or ask your account owner for access.",
        clear: "location",
      };
    case "NETLOGS_BAD_FILTER": {
      const field = typeof error.data?.field === "string" ? error.data.field : "";
      return {
        title: "One of the filters isn't valid",
        detail: field
          ? `The ${field} filter has a value this page doesn't recognise. Clear the filters and try again.`
          : "Clear the filters and try again.",
        clear: "filters",
      };
    }
    case "DEVICE_LOGS_BAD_CURSOR":
      return {
        title: "The list has changed",
        detail: "Refresh to load the latest lines, then try again.",
      };
    case "DEVICE_LOGS_DISABLED":
      return {
        title: "Network logs aren't switched on yet",
        detail: "Nothing is being collected for your account at the moment.",
      };
  }
  if (error.status === 403) {
    return {
      title: "You don't have access to network logs",
      detail: "Ask your account owner to give your role access to Network Logs.",
    };
  }
  if (error.status === 400) {
    return {
      title: "Pick an account first",
      detail: "Network logs are shown for one account at a time. Choose a location and try again.",
    };
  }
  if (error.status === 409) {
    return {
      title: "Network logs aren't switched on yet",
      detail: "Nothing is being collected for your account at the moment.",
    };
  }
  if (error.status === null) {
    return {
      title: "Couldn't reach the server",
      detail: "Check your internet connection and try again.",
    };
  }
  return {
    title: "Couldn't load network logs",
    detail: `The server answered with an error (${error.status}). Try again in a moment.`,
  };
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

export interface NetLogsChartRow {
  /** First day of the bar, `YYYY-MM-DD`. */
  day: string;
  /** Last day of the bar (same as `day` for one-day bars). */
  lastDay: string;
  total: number;
  errors: number;
  warnings: number;
  /** One key per category. */
  [category: string]: number | string;
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Chart rows from the summary's `by_day`, which lists only days that had
 * events. Days in between are filled with real zeros (the summary counted
 * them and found none), so a quiet day shows as a gap on the axis instead of
 * its neighbours closing up around it. Long ranges are grouped into
 * multi-day bars so the chart stays readable; `lastDay` says what each bar
 * covers.
 */
export function netLogsChartRows(
  summary: Pick<NetLogSummary, "by_day"> | null | undefined,
  maxBars = 120,
): NetLogsChartRow[] {
  const days = (summary?.by_day ?? []).filter((d) => validDay(d.day));
  if (days.length === 0) return [];
  const byDay = new Map(days.map((d) => [d.day, d]));
  const first = days[0].day;
  const last = days[days.length - 1].day;
  const daily: NetLogsChartRow[] = [];
  for (let day = first, guard = 0; day <= last && guard < 4000; day = addDays(day, 1), guard++) {
    const d = byDay.get(day);
    const row: NetLogsChartRow = {
      day,
      lastDay: day,
      total: d?.total ?? 0,
      errors: d?.errors ?? 0,
      warnings: d?.warnings ?? 0,
    };
    for (const c of NETLOGS_CATEGORIES) row[c] = d?.by_category?.[c] ?? 0;
    daily.push(row);
  }
  if (daily.length <= maxBars) return daily;
  const size = Math.ceil(daily.length / maxBars);
  const grouped: NetLogsChartRow[] = [];
  for (let i = 0; i < daily.length; i += size) {
    const chunk = daily.slice(i, i + size);
    const row: NetLogsChartRow = {
      day: chunk[0].day,
      lastDay: chunk[chunk.length - 1].day,
      total: 0,
      errors: 0,
      warnings: 0,
    };
    for (const c of NETLOGS_CATEGORIES) row[c] = 0;
    for (const r of chunk) {
      row.total += r.total;
      row.errors += r.errors;
      row.warnings += r.warnings;
      for (const c of NETLOGS_CATEGORIES) row[c] = (row[c] as number) + (r[c] as number);
    }
    grouped.push(row);
  }
  return grouped;
}

/** Categories that actually occur in the window, in vocabulary order -- the
 * stacked chart and its legend list only these. */
export function presentCategories(
  summary: Pick<NetLogSummary, "by_category"> | null | undefined,
): string[] {
  const counts = summary?.by_category ?? {};
  return NETLOGS_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0);
}

/** "12 Oct" or "12 Oct – 18 Oct" for a grouped bar. */
export function chartDayLabel(day: string, lastDay?: string): string {
  const fmt = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  return lastDay && lastDay !== day ? `${fmt(day)} – ${fmt(lastDay)}` : fmt(day);
}
