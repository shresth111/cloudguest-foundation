/**
 * "Worth a look", fed by the server's findings (API.md, "Findings API").
 * Pure: turns the response into the words and rows the block shows. Used by
 * the customer page and the Master venue view, so both read the same.
 *
 * The rules of the block, each pinned by scripts/test-traffic-lens-findings.mjs:
 *
 *   - FLAGGED FIRST, most serious first; each opens to its evidence.
 *   - CLEAR CHECKS ARE ONE LINE that names what was looked for. It never
 *     says the venue is fine.
 *   - "COULD NOT BE CHECKED" IS SAID, with the reason, and is never folded
 *     into the clear line.
 *   - A FLAG IS NOT AN ACCUSATION: the measurement, then a neutral next
 *     step. A service is "unusual for this venue", never anything worse.
 *   - A CARD NAMES A DEVICE OR A DESTINATION, NEVER BOTH. The server sends
 *     it that way; `findingCard` also refuses to render both.
 *   - ONLY `act` IS ALARMING. `look` and `info` are amber and neutral.
 */
import { clockLabel, flowBytes, isNum, serviceLabel, shareLabel } from "@/lib/traffic-lens-shared";
import { lensDeviceLabel } from "@/lib/traffic-lens-customer";
import type {
  Finding,
  FindingSeverity,
  FindingState,
  FindingsResponse,
} from "@/types/traffic-lens-findings";

/** What each check looks for, in a few words. Order = the server's order. */
export const FINDING_NAMES: Record<string, string> = {
  upload_heavy: "An unusually heavy upload",
  quiet_hours_traffic: "Traffic at a normally quiet time",
  dominant_device: "One device using most of the traffic",
  unusual_service: "A service that is unusual for this venue",
  known_bad_destinations: "Addresses on a known-bad list",
};

export interface FindingRow {
  label: string;
  value: string;
}

export interface FindingCard {
  id: string;
  state: FindingState;
  /** null unless flagged. */
  tone: FindingSeverity | null;
  name: string;
  /** The measurement, or why it could not be checked. */
  text: string;
  /** A neutral next step. Flagged only. */
  next: string | null;
  /** The evidence, shown when the card is opened. Flagged only. */
  rows: FindingRow[];
}

export interface FindingsView {
  /** "2 of 5 checks flagged for this period". */
  heading: string;
  flagged: FindingCard[];
  unchecked: FindingCard[];
  /** The one line for everything that was checked and not flagged. null
   * when nothing was clear. */
  clearLine: string | null;
  /** Shown with the block whenever the list was used or named. */
  credit: { text: string; url: string; date: string | null } | null;
  /** Where the comparisons come from. */
  basis: string;
  /** Customer only: how many periods the small-venue rule left out. */
  withheldNote: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (isNum(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "02:30 to 03:30", with the date when it is not today. */
export function findingHourLabel(start: unknown, end: unknown, now: number): string {
  const a = clockLabel(str(start), now);
  const b = clockLabel(str(end), now);
  if (!a) return "An hour in this period";
  return b ? `${a} to ${b}` : a;
}

/** UTC hours of the day as local clock ranges: [0,1,2] -> "05:30 to 08:30".
 * The server works in UTC; the venue reads its own clock. */
export function quietHoursLabel(hoursUtc: unknown, now: number): string | null {
  const hours = (Array.isArray(hoursUtc) ? hoursUtc : [])
    .filter((h): h is number => Number.isInteger(h) && h >= 0 && h <= 23)
    .sort((a, b) => a - b);
  if (hours.length === 0) return null;
  const day = new Date(now);
  const at = (h: number) =>
    new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h),
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const runs: [number, number][] = [];
  for (const h of hours) {
    const last = runs[runs.length - 1];
    if (last && last[1] === h - 1) last[1] = h;
    else runs.push([h, h]);
  }
  // 23 and 0 are neighbours on a clock.
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === 23) {
    const tail = runs.pop() as [number, number];
    runs[0] = [tail[0], runs[0][1]];
  }
  return runs.map(([a, b]) => `${at(a)} to ${at((b + 1) % 24)}`).join(", ");
}

const daysWord = (n: number | null) =>
  n === null ? "this venue's recent days" : `this venue's last ${plural(n, "day", "days")}`;

/** Why a check could not run, in the page's words. An unknown reason still
 * reads as "could not be checked": it is never shown as passed. */
export function findingReasonText(f: Finding): string {
  const e = obj(f.evidence);
  const t = obj(f.thresholds);
  switch (f.reason) {
    case "not_measured":
      return "No data for this period.";
    case "feature_off":
      return "Traffic collection is switched off for the platform.";
    case "not_enough_traffic": {
      const had = num(e.period_bytes);
      const need = num(t.min_period_bytes);
      return had !== null && need !== null
        ? `Not enough traffic to judge: ${flowBytes(had)} in this period, and this check needs ${flowBytes(need)}.`
        : "Not enough traffic to judge.";
    }
    case "baseline_too_short": {
      const have = num(e.baseline_days);
      const need = num(t.baseline_min_days);
      return need !== null && have !== null
        ? `Needs ${plural(need, "day", "days")} of this venue's own traffic to compare with; there ${have === 1 ? "is" : "are"} ${have} so far.`
        : "Not enough days of this venue's own traffic to compare with yet.";
    }
    case "no_quiet_hours":
      return "This venue has had no regularly quiet hour in the last week, so there is nothing to compare with.";
    case "too_few_devices": {
      const need = num(t.min_devices);
      return `Fewer than ${need ?? 5} devices were online at once. With a handful of guests, one of them using most of the traffic is ordinary.`;
    }
    case "no_device_list":
      return "No device figures for this period.";
    case "services_not_measured":
      return "Protocol and port were not recorded in this period.";
    case "destinations_not_measured":
      return "Outside addresses were not recorded in this period.";
    case "list_unavailable":
      return "The known-bad address list is not available right now, so nothing was compared.";
    case "list_stale":
      return "The copy of the known-bad address list is too old to rely on, so it was not used.";
    case "withheld_small_venue": {
      const need = num(e.min_devices);
      return `Not checked while fewer than ${need ?? 5} devices are connected.`;
    }
    default:
      return "Could not be checked.";
  }
}

function uploadCard(f: Finding, now: number): Pick<FindingCard, "text" | "next" | "rows"> {
  const p = obj(f.parts);
  const e = obj(f.evidence);
  const typical = num(p.typical_bytes_up);
  const times = num(p.times_typical);
  const hours = num(p.hours) ?? 1;
  const compared =
    typical !== null && typical > 0 && times !== null
      ? `about ${times} times this venue's usual busiest upload hour (${flowBytes(typical)})`
      : "where this venue usually uploads almost nothing";
  return {
    text: `${findingHourLabel(p.start, p.end, now)}: ${flowBytes(num(p.bytes_up))} was uploaded, ${compared}.${
      hours > 1 ? ` ${hours - 1} more ${hours - 1 === 1 ? "hour was" : "hours were"} like it.` : ""
    }`,
    next: "Common causes are a backup, a large file being sent, or a device sharing files. It can also be data leaving that should not. This does not say which device, or where it went.",
    rows: [
      ...list(e.items).map((it) => ({
        label: findingHourLabel(it.start, it.end, now),
        value: `${flowBytes(num(it.bytes_up))} uploaded, ${flowBytes(num(it.bytes_down))} downloaded`,
      })),
      { label: "Usual busiest upload hour", value: flowBytes(typical) },
      { label: "Compared with", value: daysWord(num(e.baseline_days)) },
    ],
  };
}

function quietCard(f: Finding, now: number): Pick<FindingCard, "text" | "next" | "rows"> {
  const p = obj(f.parts);
  const e = obj(f.evidence);
  const hours = num(p.hours) ?? 1;
  const quiet = quietHoursLabel(e.quiet_hours_utc, now);
  return {
    text: `${findingHourLabel(p.start, p.end, now)}: ${flowBytes(num(p.bytes))} was used. At this hour this venue normally uses at most ${flowBytes(num(p.usual_at_most_bytes))}.${
      hours > 1
        ? ` ${hours - 1} more quiet ${hours - 1 === 1 ? "hour was" : "hours were"} like it.`
        : ""
    }`,
    next: `The quiet hours are worked out from ${daysWord(num(e.baseline_days))} of traffic, not from your opening hours. If the venue was open or an update was running, this is expected.`,
    rows: [
      ...list(e.items).map((it) => ({
        label: findingHourLabel(it.start, it.end, now),
        value: `${flowBytes(num(it.bytes))}, normally at most ${flowBytes(num(it.usual_at_most_bytes))}`,
      })),
      ...(quiet ? [{ label: "Normally quiet (worked out, your local time)", value: quiet }] : []),
      { label: "Compared with", value: daysWord(num(e.baseline_days)) },
    ],
  };
}

function deviceCard(f: Finding): Pick<FindingCard, "text" | "next" | "rows"> {
  const p = obj(f.parts);
  const e = obj(f.evidence);
  const d = obj(p.device);
  const share = num(p.share_at_least);
  return {
    text: `One device used at least ${shareLabel(share)} of all traffic (at least ${flowBytes(num(p.bytes_at_least))}).`,
    next: 'If the WiFi feels slow, this device is the first place to look. Read the figures as "at least": the device may have used more, never less.',
    rows: [
      { label: "Device", value: `${str(d.ip) ?? "Not known"} · ${lensDeviceLabel(str(d.match))}` },
      { label: "Share of traffic", value: `at least ${shareLabel(share)}` },
      { label: "All traffic in the period", value: flowBytes(num(e.period_bytes)) },
      ...(num(e.devices_at_once) !== null
        ? [{ label: "Devices online at once", value: `up to ${num(e.devices_at_once)}` }]
        : []),
    ],
  };
}

const serviceWhy = (it: Record<string, unknown>) =>
  it.why === "new"
    ? "new at this venue"
    : `seen here on ${plural(num(it.days_seen) ?? 0, "day", "days")} only`;

function serviceRef(it: Record<string, unknown>) {
  return {
    protocol: num(it.protocol),
    protocol_name: str(it.protocol_name),
    port: num(it.port),
    service_name: str(it.service_name),
  };
}

function serviceCard(f: Finding): Pick<FindingCard, "text" | "next" | "rows"> {
  const p = obj(f.parts);
  const e = obj(f.evidence);
  const more = (num(p.services) ?? 1) - 1;
  return {
    text: `${serviceLabel(serviceRef(p))} carried ${shareLabel(num(p.share))} of traffic (${flowBytes(num(p.bytes))}), which is unusual for this venue: it is ${serviceWhy(p)}.${
      more > 0 ? ` ${plural(more, "more service", "more services")} like it.` : ""
    }`,
    next: "A port is a label, not an app: this does not say what the traffic was, and unusual is not the same as wrong. Your IT person can look at it in Records.",
    rows: [
      ...list(e.items).map((it) => ({
        label: serviceLabel(serviceRef(it)),
        value: `${flowBytes(num(it.bytes))}, ${shareLabel(num(it.share))} of traffic · ${serviceWhy(it)}`,
      })),
      { label: "Compared with", value: daysWord(num(e.baseline_days)) },
    ],
  };
}

function knownBadCard(f: Finding): Pick<FindingCard, "text" | "next" | "rows"> {
  const p = obj(f.parts);
  const e = obj(f.evidence);
  const n = num(p.addresses) ?? 1;
  const listName = str(p.list_name) ?? "known-bad address";
  const withheld = num(e.windows_withheld);
  return {
    text: `This venue exchanged at least ${flowBytes(num(p.bytes_at_least))} with ${plural(n, "address", "addresses")} on the ${listName} list${
      str(p.list_date) ? ` (${str(p.list_date)})` : ""
    }${str(p.address) ? `, ${n === 1 ? "" : "the largest being "}${str(p.address)}` : ""}.`,
    next: "A device on this network may be infected or misused. This does not say which device: nothing records that. Ask your IT person to check the devices on this network.",
    rows: [
      ...list(e.items).map((it) => ({
        label: str(it.address) ?? "Address",
        value: `at least ${flowBytes(num(it.bytes))} in ${plural(num(it.windows) ?? 0, "five-minute period", "five-minute periods")} · listed block ${str(it.list_entry) ?? "not given"}${
          str(it.reference) ? ` (${str(it.reference)})` : ""
        }`,
      })),
      {
        label: "Addresses compared",
        value: `${num(e.addresses_checked) ?? 0} recorded for this period`,
      },
      ...(withheld !== null && withheld > 0
        ? [
            {
              label: "Left out",
              value: `${plural(withheld, "five-minute period", "five-minute periods")} with fewer than ${num(e.min_devices) ?? 5} devices connected`,
            },
          ]
        : []),
    ],
  };
}

const DEVICE_WORDS = /^(device|ip|router_id|guest_session_id|mac|mac_address)$/;
const DESTINATION_WORDS = /^(address|remote_address|destination|list_entry)$/;

function keysOf(v: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, into));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      into.add(k);
      keysOf(x, into);
    }
  return into;
}

/** True when a finding carries both a device and a destination. The server
 * never sends one; if a response ever did, the card shows no detail. */
export function findingPairsDeviceWithDestination(f: Finding): boolean {
  const keys = [...keysOf({ parts: f.parts, evidence: f.evidence }, new Set())];
  return keys.some((k) => DEVICE_WORDS.test(k)) && keys.some((k) => DESTINATION_WORDS.test(k));
}

/** One check as the block shows it. */
export function findingCard(f: Finding, now: number): FindingCard {
  const name = FINDING_NAMES[f.id] ?? "A check";
  const base = { id: f.id, state: f.state, name };
  if (f.state === "could_not_check")
    return { ...base, tone: null, text: findingReasonText(f), next: null, rows: [] };
  if (f.state !== "flagged")
    return { ...base, state: "clear", tone: null, text: "Not flagged.", next: null, rows: [] };
  const tone: FindingSeverity = f.severity === "act" || f.severity === "info" ? f.severity : "look";
  if (findingPairsDeviceWithDestination(f))
    return {
      ...base,
      tone,
      text: "Flagged, but the detail is not shown here.",
      next: null,
      rows: [],
    };
  const body =
    f.id === "upload_heavy"
      ? uploadCard(f, now)
      : f.id === "quiet_hours_traffic"
        ? quietCard(f, now)
        : f.id === "dominant_device"
          ? deviceCard(f)
          : f.id === "unusual_service"
            ? serviceCard(f)
            : f.id === "known_bad_destinations"
              ? knownBadCard(f)
              : { text: "Flagged.", next: null, rows: [] };
  return { ...base, tone, ...body };
}

const TONE_ORDER: Record<FindingSeverity, number> = { act: 0, look: 1, info: 2 };

/** The whole block. `null` data (still loading, or the request failed) is
 * the caller's to handle; this never invents a result. */
export function findingsView(data: FindingsResponse, now: number): FindingsView {
  const cards = (data.findings ?? []).map((f) => findingCard(f, now));
  const flagged = cards
    .filter((c) => c.state === "flagged")
    .sort((a, b) => TONE_ORDER[a.tone ?? "look"] - TONE_ORDER[b.tone ?? "look"]);
  const unchecked = cards.filter((c) => c.state === "could_not_check");
  const clear = cards.filter((c) => c.state === "clear");
  const total = cards.length;
  const heading =
    flagged.length > 0
      ? `${flagged.length} of ${plural(total, "check", "checks")} flagged for this period`
      : clear.length === 0
        ? `${plural(total, "check", "checks")}, none of which could be run for this period`
        : `${plural(total, "check", "checks")}, run on this period's figures`;
  const looked = clear.map((c) => lower(c.name)).join("; ");
  const clearLine =
    clear.length === 0
      ? null
      : flagged.length > 0
        ? `Also looked for, and not flagged: ${looked}.`
        : `Nothing flagged. Looked for: ${looked}.`;
  const known = (data.findings ?? []).find((f) => f.id === "known_bad_destinations");
  const tl = data.threat_list;
  const usedList = !!tl?.available && known?.reason !== "list_stale";
  const days = num(data.baseline?.days);
  const withheld = num(data.windows_withheld);
  return {
    heading,
    flagged,
    unchecked,
    clearLine,
    credit:
      tl?.credit?.text && tl.credit.url && usedList
        ? { text: tl.credit.text, url: tl.credit.url, date: tl.date ?? null }
        : null,
    basis: `Comparisons use ${daysWord(days)} of traffic. Nothing here is set by hand, and no alert is sent: these checks run when the page is opened.`,
    withheldNote:
      withheld !== null && withheld > 0 && isNum(data.min_devices)
        ? `The address check left out ${plural(withheld, "five-minute period", "five-minute periods")} with fewer than ${data.min_devices} devices connected.`
        : null,
  };
}
