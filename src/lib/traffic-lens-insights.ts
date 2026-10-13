/**
 * Traffic Lens on the CUSTOMER dashboard: the answers at the top of the page,
 * and the columns of the Records table. Pure functions, no React, so
 * scripts/test-traffic-lens-insights.mjs can run them.
 *
 * Every statement here is computed from one `/summary` response
 * (wyfy-specs/flow-visibility/API.md, C-2) and nothing else. The rules:
 *
 *   1. A STATEMENT IS NEVER MADE FROM NOTHING. No data, one reading only, a
 *      tie and a real zero are four different `kind`s with four different
 *      sentences. One five-minute reading never names a "busiest time".
 *   2. LOWER BOUNDS STAY "AT LEAST". A device's share is a minimum when the
 *      API says so, and a check that did not trigger on minimums says "does
 *      not show up", never "is fine".
 *   3. A SERVICE IS A PORT LABEL. The plain names below are keyed on the
 *      port's standard name as the API sends it. Nothing is read from an
 *      address and no product is ever named.
 *   4. EVERY FIGURE CARRIES ITS UNIT AND ITS PERIOD.
 *
 * Like the other customer files, nothing here says how the data is gathered.
 */
import { formatCount } from "@/lib/analytics-format";
import {
  DASH,
  clockLabel,
  flowBytes,
  flowRate,
  isLowerBound,
  isNum,
  rateFromBytes,
  serviceKey,
  serviceLabel,
  shareLabel,
  type FlowSummary,
} from "@/lib/traffic-lens-shared";
import { lensDeviceLabel, type LensRange } from "@/lib/traffic-lens-customer";
import { rangeLabel } from "@/lib/traffic-flow-destinations";
import { filterLoadedRecords, recordTime, retrievedLine } from "@/lib/records-table";
import type { FlowServiceRef } from "@/types/traffic-flow";
import type { DestinationRecord, DestinationSortKey } from "@/types/traffic-flow-destinations";

type Summary = FlowSummary | null | undefined;

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** What a standard port name means in plain words. Keyed on the IANA label
 * the API sends, so an unnamed port gets no gloss and nothing is guessed. */
const SERVICE_KINDS: Record<string, string> = {
  https: "Secure web browsing",
  http: "Web browsing (not encrypted)",
  domain: "Name lookups (DNS)",
  ntp: "Clock sync",
  imaps: "Email",
  pop3s: "Email",
  smtp: "Email",
  submission: "Email",
  ssh: "Remote login",
};

/** "Secure web browsing" for https; null when the port has no standard name
 * or the name is not one of the few glossed here. */
export function serviceKind(s: FlowServiceRef | null | undefined): string | null {
  const name = (s?.service_name ?? "").trim().toLowerCase();
  return SERVICE_KINDS[name] ?? null;
}

const PROTOCOL_SHORT: Record<number, string> = { 1: "ICMP", 6: "TCP", 17: "UDP", 58: "ICMPv6" };

/** The name each service row leads with, by service key. Two services with
 * the same plain name (https over TCP and over UDP) get their protocol
 * added, so no two rows read the same. */
export function serviceDisplayNames(items: readonly FlowServiceRef[]): Map<string, string> {
  const count = new Map<string, number>();
  for (const it of items) {
    const kind = serviceKind(it);
    if (kind) count.set(kind, (count.get(kind) ?? 0) + 1);
  }
  const names = new Map<string, string>();
  for (const it of items) {
    const kind = serviceKind(it);
    const proto = typeof it.protocol === "number" ? PROTOCOL_SHORT[it.protocol] : undefined;
    names.set(
      serviceKey(it),
      kind ? ((count.get(kind) ?? 0) > 1 && proto ? `${kind} (${proto})` : kind) : serviceLabel(it),
    );
  }
  return names;
}

/** "in the last hour", or "from 12 Oct 13:07 to 12 Oct 13:52". */
export function lensPeriodPhrase(range: LensRange): string {
  if (range.kind === "custom") {
    const label = rangeLabel(range);
    return label ? `from ${label}` : "in the chosen period";
  }
  switch (range.window) {
    case "1h":
      return "in the last hour";
    case "6h":
      return "in the last 6 hours";
    case "24h":
      return "in the last 24 hours";
    case "7d":
      return "in the last 7 days";
    default:
      return "in the chosen period";
  }
}

/** "5 minutes" / "15 minutes" / "1 hour": the length of one timeline step. */
export function stepSpan(stepSeconds: number | null | undefined): string | null {
  if (!isNum(stepSeconds) || stepSeconds === 0) return null;
  if (stepSeconds % 3600 === 0) {
    const h = stepSeconds / 3600;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const m = Math.round(stepSeconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

/** One answer on the page: a short label, the sentence, and a line under it.
 * `kind` is what the tests and the layout read; the words follow from it. */
export interface LensAnswer<K extends string> {
  kind: K;
  /** The sentence. Always complete on its own. */
  headline: string;
  /** Unit, period and caveat. null when there is nothing to add. */
  detail: string | null;
  /** Amber on screen. Only ever true for a measured, stated threshold. */
  flagged: boolean;
}

// ---------------------------------------------------------------------------
// 1. What the traffic was (the headline)
// ---------------------------------------------------------------------------

export type TopServiceKind = "not_measured" | "none" | "tie" | "top";

export interface TopServiceAnswer extends LensAnswer<TopServiceKind> {
  /** The very large figure beside the sentence ("61%"); null when there is
   * no single share to show. */
  figure: string | null;
  /** What the figure is a share of, said under it. */
  figureCaption: string | null;
}

/** The busiest service and its share. A tie for first is said as a tie; a
 * period with only part of its service detail is said to be partial. */
export function lensTopService(summary: Summary, periodPhrase: string): TopServiceAnswer {
  if (!summary || summary.measured !== true)
    return {
      kind: "not_measured",
      headline: "Not measured for this period.",
      detail: "Nothing was recorded, which is not the same as no traffic.",
      flagged: false,
      figure: null,
      figureCaption: null,
    };
  const sv = summary.services;
  const windowsMeasured = (sv as { windows_measured?: unknown } | null)?.windows_measured;
  if (
    !sv ||
    (summary.services_measured !== true && !(isNum(windowsMeasured) && windowsMeasured > 0))
  )
    return {
      kind: "not_measured",
      headline: "What the traffic was is not measured for this period.",
      detail:
        "Traffic was counted, but the records did not say which service it was. That is not the same as no services.",
      flagged: false,
      figure: null,
      figureCaption: null,
    };
  const items = (sv.items ?? []).filter((it) => isNum(it.bytes) && it.bytes > 0);
  if (items.length === 0)
    return {
      kind: "none",
      headline: `No service traffic was recorded ${periodPhrase}.`,
      detail: "The period was measured and it was quiet.",
      flagged: false,
      figure: null,
      figureCaption: null,
    };
  const partial =
    summary.services_measured !== true || sv.exact === false
      ? isNum(windowsMeasured) && isNum(summary.windows)
        ? ` Service detail covers ${formatCount(windowsMeasured)} of ${formatCount(summary.windows)} five-minute periods; shares are of that measured part.`
        : " Service detail covers only part of this period; shares are of the measured part."
      : "";
  // Services that mean the same thing in plain words (https over TCP and
  // over UDP) are one answer; a port with no plain name stands alone.
  const all =
    items.reduce((sum, it) => sum + it.bytes, 0) + (isNum(sv.other_bytes) ? sv.other_bytes : 0);
  const groups = new Map<string, { name: string; bytes: number; labels: string[] }>();
  for (const it of items) {
    const name = serviceKind(it) ?? serviceLabel(it);
    const g = groups.get(name) ?? { name, bytes: 0, labels: [] };
    g.bytes += it.bytes;
    g.labels.push(serviceLabel(it));
    groups.set(name, g);
  }
  const ranked = [...groups.values()].sort((a, b) => b.bytes - a.bytes);
  const top = ranked[0];
  const share = shareLabel(top.bytes / all);
  const tied = ranked.filter((g) => g.bytes === top.bytes);
  if (tied.length > 1) {
    const names = tied.map((g) => g.name);
    const list =
      names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return {
      kind: "tie",
      headline: `${list} shared the top, ${share} of your traffic each.`,
      detail: `${flowBytes(top.bytes)} each ${periodPhrase}.${partial}`,
      flagged: false,
      figure: share,
      figureCaption: "each, of all traffic",
    };
  }
  const plain = top.labels.length > 1 || top.labels[0] !== top.name;
  return {
    kind: "top",
    headline: `${top.name} was ${share} of your traffic ${periodPhrase}.`,
    detail: `${plain ? `${top.labels.join(" + ")} · ` : ""}${flowBytes(top.bytes)}, download and upload together.${partial}`,
    flagged: false,
    figure: share,
    figureCaption: `of all traffic was ${plain ? top.name.toLowerCase() : top.name}`,
  };
}

// ---------------------------------------------------------------------------
// 2. When it was busiest
// ---------------------------------------------------------------------------

export type PeakKind = "not_measured" | "single" | "idle" | "tie" | "peak";

export interface PeakAnswer extends LensAnswer<PeakKind> {
  /** Epoch ms of the (first) busiest step; null when none is named. */
  at: number | null;
  /** Bits per second, download and upload together; null when none. */
  bps: number | null;
}

/** The busiest timeline step. One reading is not a peak: a "busiest time"
 * needs something to be busier than. */
export function lensPeak(summary: Summary, now: number): PeakAnswer {
  const none: PeakAnswer = {
    kind: "not_measured",
    headline: "Busiest time: not measured.",
    detail: "No reading in this period.",
    flagged: false,
    at: null,
    bps: null,
  };
  if (!summary || summary.measured !== true) return none;
  const steps: { t: number; iso: string; down: number; up: number; total: number }[] = [];
  for (const s of summary.timeline?.steps ?? []) {
    const t = Date.parse(s.start);
    const down = isNum(s.bps_down) ? s.bps_down : rateFromBytes(s.bytes_down, s.covered_seconds);
    const up = isNum(s.bps_up) ? s.bps_up : rateFromBytes(s.bytes_up, s.covered_seconds);
    if (Number.isNaN(t) || down === null || up === null) continue;
    steps.push({ t, iso: s.start, down, up, total: down + up });
  }
  if (steps.length === 0) return none;
  steps.sort((a, b) => a.t - b.t);
  const span = stepSpan(summary.step_seconds);
  const over = span ? ` over ${span}` : "";
  if (steps.length === 1) {
    const only = steps[0];
    return {
      kind: "single",
      headline: "Only one reading so far.",
      detail: `${flowRate(only.total)}${over} from ${clockLabel(only.iso, now) ?? DASH}. A busiest time needs more than one reading to compare.`,
      flagged: false,
      at: null,
      bps: only.total,
    };
  }
  const max = Math.max(...steps.map((s) => s.total));
  if (max === 0)
    return {
      kind: "idle",
      headline: "No traffic in any reading.",
      detail: `${formatCount(steps.length)} readings were taken and each was zero.`,
      flagged: false,
      at: null,
      bps: 0,
    };
  const at = steps.filter((s) => s.total === max);
  const first = at[0];
  const when = clockLabel(first.iso, now) ?? DASH;
  const split = `Download ${flowRate(first.down)}, upload ${flowRate(first.up)}${over}.`;
  if (at.length > 1) {
    const more = at.length - 1;
    return {
      kind: "tie",
      headline: `Busiest at ${when}: ${flowRate(max)}.`,
      detail: `The same speed was reached ${more === 1 ? "one more time" : `${formatCount(more)} more times`} in this period. ${split}`,
      flagged: false,
      at: first.t,
      bps: max,
    };
  }
  return {
    kind: "peak",
    headline: `Busiest at ${when}: ${flowRate(max)}.`,
    detail: split,
    flagged: false,
    at: first.t,
    bps: max,
  };
}

// ---------------------------------------------------------------------------
// 3. Whether one device is using most of it
// ---------------------------------------------------------------------------

/** A device with this share or more of all traffic is flagged. */
export const LENS_HEAVY_DEVICE_SHARE = 0.5;

export type HeaviestDeviceKind = "not_measured" | "none" | "tie" | "top";

export interface HeaviestDeviceAnswer extends LensAnswer<HeaviestDeviceKind> {
  /** The share as a 0..1 number; null when no single device is named. */
  share: number | null;
}

/** The device with the largest share. Its share is "at least" whenever the
 * API marks the list as lower bounds. Names no destination and no service:
 * the device list stands on its own. */
export function lensHeaviestDevice(summary: Summary): HeaviestDeviceAnswer {
  if (!summary || summary.measured !== true)
    return {
      kind: "not_measured",
      headline: "Heaviest device: not measured.",
      detail: "No reading in this period.",
      flagged: false,
      share: null,
    };
  const lb = isLowerBound(summary, "devices");
  const least = lb ? "at least " : "";
  const items = [...(summary.devices?.items ?? [])]
    .filter((d) => isNum(d.bytes) && d.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
  if (items.length === 0)
    return {
      kind: "none",
      headline: "No device traffic was recorded.",
      detail: "The period was measured and no device stood in any list.",
      flagged: false,
      share: null,
    };
  const top = items[0];
  const tied = items.filter((d) => d.bytes === top.bytes);
  if (tied.length > 1)
    return {
      kind: "tie",
      headline: `${formatCount(tied.length)} devices are level at the top, ${least}${shareLabel(top.share_at_least)} of all traffic each.`,
      detail: `${least}${flowBytes(top.bytes)} each. See the list below.`,
      flagged: false,
      share: null,
    };
  const share = isNum(top.share_at_least) && top.share_at_least <= 1 ? top.share_at_least : null;
  const heavy = share !== null && share >= LENS_HEAVY_DEVICE_SHARE;
  return {
    kind: "top",
    headline: `One device used ${least}${shareLabel(top.share_at_least)} of all traffic.`,
    detail: `${lensDeviceLabel(top.match)} · ${least}${flowBytes(top.bytes)}.${heavy ? " That is half or more of everything." : ""}`,
    flagged: heavy,
    share,
  };
}

// ---------------------------------------------------------------------------
// 4. How much, in all
// ---------------------------------------------------------------------------

export type VolumeKind = "not_measured" | "measured";

export interface VolumeAnswer extends LensAnswer<VolumeKind> {
  /** "Up to 14 devices at once" and the like; empty when not measured. */
  facts: string[];
}

export function lensVolume(summary: Summary, periodPhrase: string): VolumeAnswer {
  const t = summary?.totals;
  if (!summary || summary.measured !== true || !t)
    return {
      kind: "not_measured",
      headline: "Total used: not measured.",
      detail: "No reading in this period.",
      flagged: false,
      facts: [],
    };
  const total = (isNum(t.bytes_down) ? t.bytes_down : 0) + (isNum(t.bytes_up) ? t.bytes_up : 0);
  const facts: string[] = [];
  if (isNum(t.devices_peak)) facts.push(`Up to ${formatCount(t.devices_peak)} devices at once`);
  if (isNum(t.destinations_peak))
    facts.push(`Up to ${formatCount(t.destinations_peak)} outside addresses at once`);
  return {
    kind: "measured",
    headline: `${flowBytes(total)} used ${periodPhrase}.`,
    detail: `Download ${flowBytes(t.bytes_down)} (average ${flowRate(t.avg_bps_down)}), upload ${flowBytes(t.bytes_up)} (average ${flowRate(t.avg_bps_up)}).`,
    flagged: false,
    facts,
  };
}

// ---------------------------------------------------------------------------
// 5. Worth a look: three fixed checks
// ---------------------------------------------------------------------------

/** A quarter or more of traffic on ports with no standard name is flagged. */
export const LENS_UNNAMED_PORT_SHARE = 0.25;

export type LensCheckId = "heavy_device" | "upload_heavy" | "unnamed_ports";
/** `unchecked` = the data to run the check was not there. Never shown as
 * passed. */
export type LensCheckState = "flagged" | "clear" | "unchecked";

export interface LensCheck {
  id: LensCheckId;
  state: LensCheckState;
  /** What the check looks for, in a few words. */
  name: string;
  /** The measurement, and a neutral next step when flagged. */
  text: string;
}

/** The page's three checks, always all three and always in this order, so
 * "nothing flagged" can say exactly what was looked at. */
export function lensChecks(summary: Summary): LensCheck[] {
  const measured = !!summary && summary.measured === true && !!summary.totals;
  const device = lensHeaviestDevice(summary);
  const devicesListed = (summary?.devices?.items ?? []).length > 0;
  const lb = isLowerBound(summary, "devices");

  const heavy: LensCheck = {
    id: "heavy_device",
    name: "One device using half or more",
    state: !measured || !devicesListed ? "unchecked" : device.flagged ? "flagged" : "clear",
    text:
      !measured || !devicesListed
        ? "Could not be checked: no device figures for this period."
        : device.flagged
          ? `${device.headline} If the WiFi feels slow, this device is the first place to look.`
          : lb
            ? "No device shows up as using half or more. Device figures are minimums, so this is what was seen, not a guarantee."
            : "No device used half or more.",
  };

  const t = summary?.totals;
  const up = t && isNum(t.bytes_up) ? t.bytes_up : null;
  const down = t && isNum(t.bytes_down) ? t.bytes_down : null;
  const uploadHeavy = up !== null && down !== null && up > down;
  const upload: LensCheck = {
    id: "upload_heavy",
    name: "More upload than download",
    state:
      !measured || up === null || down === null ? "unchecked" : uploadHeavy ? "flagged" : "clear",
    text:
      !measured || up === null || down === null
        ? "Could not be checked: no totals for this period."
        : uploadHeavy
          ? `Upload (${flowBytes(up)}) was higher than download (${flowBytes(down)}). Guest WiFi usually downloads more; a device may be backing up or sending large files.`
          : `Download (${flowBytes(down)}) was higher than upload (${flowBytes(up)}), as is usual.`,
  };

  const sv = summary?.services;
  const servicesOk = measured && summary?.services_measured === true && !!sv;
  let unnamedBytes = 0;
  let allBytes = 0;
  if (servicesOk && sv) {
    for (const it of sv.items ?? []) {
      const b = isNum(it.bytes) ? it.bytes : 0;
      allBytes += b;
      if (!(it.service_name ?? "").trim()) unnamedBytes += b;
    }
    allBytes += isNum(sv.other_bytes) ? sv.other_bytes : 0;
  }
  const unnamedShare = allBytes > 0 ? unnamedBytes / allBytes : 0;
  const unnamedFlag = servicesOk && unnamedShare >= LENS_UNNAMED_PORT_SHARE;
  const unnamed: LensCheck = {
    id: "unnamed_ports",
    name: "A quarter or more on ports with no standard name",
    state: !servicesOk ? "unchecked" : unnamedFlag ? "flagged" : "clear",
    text: !servicesOk
      ? "Could not be checked: no service detail for this period."
      : unnamedFlag
        ? `At least ${shareLabel(unnamedShare)} of traffic (${flowBytes(unnamedBytes)}) was on ports with no standard name. That is not wrong in itself; your IT person can look at them in Records.`
        : unnamedBytes > 0
          ? `${shareLabel(unnamedShare)} of traffic was on listed ports with no standard name, under a quarter.`
          : "Every listed service is on a port with a standard name.",
  };

  return [heavy, upload, unnamed];
}

/** The one line when nothing is flagged. It says what was looked at; it
 * never says the venue is fine. null when something is flagged. */
export function lensChecksSummary(checks: LensCheck[]): string | null {
  if (checks.some((c) => c.state === "flagged")) return null;
  const clear = checks.filter((c) => c.state === "clear");
  const unchecked = checks.filter((c) => c.state === "unchecked");
  if (clear.length === 0) return "Nothing could be checked for this period.";
  const looked = clear.map((c) => c.name.charAt(0).toLowerCase() + c.name.slice(1)).join("; ");
  return `Nothing flagged. Looked for: ${looked}.${
    unchecked.length > 0
      ? ` Could not check: ${unchecked.map((c) => c.name.charAt(0).toLowerCase() + c.name.slice(1)).join("; ")}.`
      : ""
  }`;
}

// ---------------------------------------------------------------------------
// The traffic strip: one bar, 100% of the traffic
// ---------------------------------------------------------------------------

export const LENS_STRIP_REST_KEY = "__rest";

export interface StripSegment {
  /** "<protocol>/<port>", or LENS_STRIP_REST_KEY. */
  key: string;
  /** Plain words first: "Secure web browsing", or the port label. */
  name: string;
  /** The port label: "https (TCP/443)". Empty for the rest. */
  label: string;
  /** 0..100, one decimal. All segments add up to 100. */
  width: number;
  share: string;
  bytes: string;
  /** null = the grey "everything else" segment. */
  color: string | null;
}

/** The strip's segments: the busiest services in their timeline colours (at
 * most `colors.length`), and everything else as one grey segment. Empty when
 * services were not measured, so an unmeasured period draws no strip. */
export function lensComposition(summary: Summary, colors: readonly string[]): StripSegment[] {
  if (!summary || summary.measured !== true || summary.services_measured !== true) return [];
  const sv = summary.services;
  const items = (sv?.items ?? []).filter((it) => isNum(it.bytes) && it.bytes > 0);
  const total =
    items.reduce((sum, it) => sum + it.bytes, 0) + (isNum(sv?.other_bytes) ? sv.other_bytes : 0);
  if (total <= 0) return [];
  // A service keeps the colour of its place in the timeline's series, so the
  // strip is the timeline's legend.
  const order = (summary.timeline?.series ?? []).map((s) => s.key);
  const coloured = items
    .map((it) => ({ it, i: order.indexOf(serviceKey(it)) }))
    .filter((x) => x.i >= 0 && x.i < colors.length)
    .sort((a, b) => a.i - b.i);
  const names = serviceDisplayNames(items);
  const segments: StripSegment[] = coloured.map(({ it, i }) => ({
    key: serviceKey(it),
    name: names.get(serviceKey(it)) ?? serviceLabel(it),
    label: serviceLabel(it),
    width: Math.round((it.bytes / total) * 1000) / 10,
    share: shareLabel(it.bytes / total),
    bytes: flowBytes(it.bytes),
    color: colors[i],
  }));
  const listed = coloured.reduce((sum, x) => sum + x.it.bytes, 0);
  const rest = total - listed;
  if (rest > 0) {
    const used = segments.reduce((sum, s) => sum + s.width, 0);
    segments.push({
      key: LENS_STRIP_REST_KEY,
      name: "Everything else",
      label: "",
      width: Math.max(0, Math.round((100 - used) * 10) / 10),
      share: shareLabel(rest / total),
      bytes: flowBytes(rest),
      color: null,
    });
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Records: the one table
// ---------------------------------------------------------------------------
//
// The table has the SHAPE of a full connection log, column for column, in
// the order the owner asked for: Start, End, Src addr, S.port, Dst addr,
// D.port, Protocol, S.NAT, D.NAT, Bytes, Packets, Service, Export.
//
// Five of those have no data behind them, for any venue: a destination
// record is for the venue as a whole and never says which device, address
// translation is not recorded, and packets are not counted. They stay in
// their position as PLACEHOLDERS: a greyed header, an em dash in every cell
// and a one-line reason. A placeholder has no field, no sort and no filter,
// and `recordCells` fills it with a dash whatever the row object holds, so
// it cannot start showing a value by accident.

// The pieces any records table needs live in src/lib/records-table.ts; they
// are re-exported here so this module stays the customer table's one door.
export { filterLoadedRecords, recordTime, retrievedLine };

export type LensRecordColumnId =
  | "start"
  | "end"
  | "src_addr"
  | "src_port"
  | "address"
  | "port"
  | "protocol"
  | "src_nat"
  | "dst_nat"
  | "total"
  | "packets"
  | "service"
  | "down"
  | "up"
  | "direction"
  | "flows";

export interface LensRecordColumn {
  id: LensRecordColumnId;
  label: string;
  /** The server sort this header asks for; null = not sortable. */
  sort: DestinationSortKey | null;
  /** Always shown: without these a row does not say what it is. */
  fixed: boolean;
  numeric: boolean;
  /** Set on a column that has no data for any venue: why, in one line.
   * Such a column is always shown, always a dash, never sortable. */
  notRecorded: string | null;
  /** Shown unless the person hides it. The extra columns start hidden so
   * the table opens in the asked-for shape. */
  initial: boolean;
}

const live = (
  id: LensRecordColumnId,
  label: string,
  sort: DestinationSortKey | null,
  over: Partial<LensRecordColumn> = {},
): LensRecordColumn => ({
  id,
  label,
  sort,
  fixed: false,
  numeric: false,
  notRecorded: null,
  initial: true,
  ...over,
});
const placeholder = (
  id: LensRecordColumnId,
  label: string,
  notRecorded: string,
): LensRecordColumn => ({
  id,
  label,
  sort: null,
  fixed: true,
  numeric: false,
  notRecorded,
  initial: true,
});

const NO_DEVICE = "Not recorded: a record is for the venue as a whole and never says which device.";
const NO_NAT = "Not recorded: address translation is not kept.";

/** The Records table, in order. The last column of the asked-for shape,
 * Export, is the row's download button and is drawn by the table itself. */
export const LENS_RECORD_COLUMNS: LensRecordColumn[] = [
  live("start", "Start", "time", { fixed: true }),
  live("end", "End", null),
  placeholder("src_addr", "Src addr", NO_DEVICE),
  placeholder("src_port", "S.port", NO_DEVICE),
  live("address", "Dst addr", "address", { fixed: true }),
  live("port", "D.port", "port", { numeric: true }),
  live("protocol", "Protocol", "protocol"),
  placeholder("src_nat", "S.NAT", NO_NAT),
  placeholder("dst_nat", "D.NAT", NO_NAT),
  live("total", "Bytes", "bytes", { numeric: true }),
  placeholder("packets", "Packets", "Not recorded: flows are counted, packets are not."),
  live("service", "Service", null),
  // Not in the asked-for shape, but real: off until switched on in Columns.
  live("down", "Download", "bytes_down", { numeric: true, initial: false }),
  live("up", "Upload", "bytes_up", { numeric: true, initial: false }),
  live("direction", "Direction", null, { initial: false }),
  live("flows", "Flows", "flows", { numeric: true, initial: false }),
];

export const LENS_RECORD_DEFAULT_COLUMNS: LensRecordColumnId[] = LENS_RECORD_COLUMNS.filter(
  (c) => c.initial,
).map((c) => c.id);

/** The placeholder columns, as the Columns menu lists them. */
export const LENS_RECORD_NOT_RECORDED: { label: string; why: string }[] =
  LENS_RECORD_COLUMNS.filter((c) => c.notRecorded !== null).map((c) => ({
    label: c.label,
    why: c.notRecorded as string,
  }));

/** What the venue does have, but not on a destination record: the records
 * endpoint returns no country and no network (API.md, "Not in this version
 * (Geo)"), and none is joined on in the browser. Listed in the Columns menu
 * with where to find it. */
export const LENS_RECORD_ELSEWHERE: { label: string; why: string }[] = [
  { label: "Country", why: "Not on a record. See the Countries view" },
  { label: "Network", why: "Not on a record. See the Countries view" },
];

/** Flip one column; a fixed column (and every placeholder) cannot be
 * hidden. Order is the table's. */
export function toggleRecordColumn(
  visible: readonly LensRecordColumnId[],
  id: LensRecordColumnId,
): LensRecordColumnId[] {
  const column = LENS_RECORD_COLUMNS.find((c) => c.id === id);
  if (!column || column.fixed) return [...visible];
  const next = new Set(visible);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return LENS_RECORD_COLUMNS.filter((c) => c.fixed || next.has(c.id)).map((c) => c.id);
}

/** Which way the record's bytes went, read from its two byte counts. */
export function recordDirection(row: Pick<DestinationRecord, "bytes_up" | "bytes_down">): string {
  const up = isNum(row.bytes_up) ? row.bytes_up : null;
  const down = isNum(row.bytes_down) ? row.bytes_down : null;
  if (up === null || down === null) return DASH;
  if (up > 0 && down > 0) return "Both ways";
  if (down > 0) return "Download";
  if (up > 0) return "Upload";
  return "No bytes";
}

/** Whose clock Start and End are on, for the line under the table. */
export function recordTimeBasis(timeZone?: string | null): string {
  if (timeZone) {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone });
      return `the venue's time (${timeZone})`;
    } catch {
      // An unusable zone name: fall through to the browser's.
    }
  }
  return "your browser's local time";
}

/** One record as the cells of the table, keyed by column id. A placeholder
 * column is a dash here whatever the row holds. */
export function recordCells(
  row: DestinationRecord,
  timeZone?: string | null,
): Record<LensRecordColumnId, string> & { key: string } {
  const name = (row.protocol_name ?? "").trim().toLowerCase();
  const protocol =
    PROTOCOL_SHORT[row.protocol] ??
    (name && name !== "other" ? name.toUpperCase() : `Protocol ${row.protocol}`);
  return {
    key: `${row.window_start}|${row.address}|${row.protocol}|${row.port}`,
    start: recordTime(row.window_start, timeZone),
    end: recordTime(row.window_end, timeZone),
    src_addr: DASH,
    src_port: DASH,
    address: row.address,
    // Port 0 is a protocol without ports, not a port.
    port: isNum(row.port) && row.port > 0 ? String(row.port) : DASH,
    protocol,
    src_nat: DASH,
    dst_nat: DASH,
    total: flowBytes(row.bytes),
    packets: DASH,
    // "https (TCP/443)", the bare "UDP/19305" for an unnamed port, and just
    // the protocol when it has no ports at all.
    service: isNum(row.port) && row.port > 0 ? serviceLabel(row) : protocol,
    down: flowBytes(row.bytes_down),
    up: flowBytes(row.bytes_up),
    direction: recordDirection(row),
    flows: isNum(row.flows) ? formatCount(row.flows) : DASH,
  };
}

export interface RecordFilterChip {
  field: "address" | "protocol" | "port" | "direction";
  label: string;
}

/** The server filters of the search on screen, as removable chips. Read
 * from the request that was sent, so a chip is always a filter in force. */
export function recordFilterChips(params: Record<string, string> | null): RecordFilterChip[] {
  if (!params) return [];
  const chips: RecordFilterChip[] = [];
  if (params.address) chips.push({ field: "address", label: `Dst addr ${params.address}` });
  if (params.protocol) {
    const n = Number(params.protocol);
    chips.push({ field: "protocol", label: `Protocol ${PROTOCOL_SHORT[n] ?? params.protocol}` });
  }
  if (params.port) chips.push({ field: "port", label: `D.port ${params.port}` });
  if (params.direction === "up" || params.direction === "down")
    chips.push({
      field: "direction",
      label: params.direction === "up" ? "Upload only" : "Download only",
    });
  return chips;
}
