import type { LensDeviceItem, LensStatus, LensSummary } from "@/types/traffic-lens";
import type { FlowGeoCountry, FlowGeoSummary } from "@/types/traffic-flow-geo";
import type { Finding, FindingsResponse } from "@/types/traffic-lens-findings";
import type {
  DestinationRecord,
  DestinationSearchResult,
  ServiceDestinationsResult,
} from "@/types/traffic-flow-destinations";
import type { FlowServiceItem, FlowTimelineStep } from "@/types/traffic-flow";
import { DEMO_CAFE_LOCATION_ID, DEMO_GUESTS, demoAnchor, demoRandom } from "@/lib/netlogs-demo";

/**
 * Demo-workspace fixtures for the customer Traffic Lens page: status,
 * summary (totals, timeline, services, protocols, devices, destinations),
 * countries, findings and the venue-level Records table. Served by the
 * traffic-lens services when `isDemo()`; nothing reaches the backend.
 *
 * Seven days of five-minute windows ending at the shared demo anchor
 * (`netlogs-demo.ts`), with a deterministic venue-day shape: quiet at night,
 * busy from late morning to late evening. The same guest addresses as
 * NetLogs/IPDR (10.5.50.x / 10.5.60.x) are the devices.
 *
 * Services are PORT LABELS, as on the real page (`serviceLabel`: "no
 * product or app name is ever added"). Brand names appear only where the
 * product really shows them: the network (ASN) names in Countries.
 * Destination addresses are documentation ranges (198.51.100.x,
 * 203.0.113.x) plus well-known public DNS.
 */

const MIN = 60_000;
const WINDOW_MS = 5 * MIN;
const WINDOW_S = 300;
const DAYS_HELD = 7;
const WINDOWS_HELD = DAYS_HELD * 288;
/** A busy Mumbai venue: ~42 GiB a day on the guest WiFi. */
const DAY_BYTES = 42 * 1024 ** 3;
const UP_SHARE = 0.11;
const BYTES_PER_FLOW = 180_000;

/** Relative traffic by IST hour, averaging 1. */
const HOURLY = (() => {
  const raw = [
    0.25, 0.18, 0.12, 0.1, 0.1, 0.12, 0.25, 0.5, 0.9, 1.2, 1.4, 1.5, 1.6, 1.5, 1.4, 1.4, 1.5, 1.6,
    1.8, 1.9, 1.8, 1.5, 1.0, 0.5,
  ];
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  return raw.map((v) => v / mean);
})();

interface DemoService {
  protocol: number;
  protocol_name: string;
  port: number | null;
  service_name: string | null;
  share: number;
}

const SERVICES: readonly DemoService[] = [
  { protocol: 6, protocol_name: "tcp", port: 443, service_name: "https", share: 0.44 },
  { protocol: 17, protocol_name: "udp", port: 443, service_name: "https", share: 0.27 },
  { protocol: 6, protocol_name: "tcp", port: 80, service_name: "http", share: 0.07 },
  { protocol: 6, protocol_name: "tcp", port: 5222, service_name: "xmpp-client", share: 0.035 },
  { protocol: 17, protocol_name: "udp", port: 3478, service_name: "stun", share: 0.025 },
  { protocol: 17, protocol_name: "udp", port: 19305, service_name: null, share: 0.02 },
  { protocol: 17, protocol_name: "udp", port: 53, service_name: "domain", share: 0.012 },
  { protocol: 6, protocol_name: "tcp", port: 993, service_name: "imaps", share: 0.008 },
  { protocol: 17, protocol_name: "udp", port: 123, service_name: "ntp", share: 0.001 },
];

const DESTINATIONS: readonly { ip: string; share: number; service: number }[] = [
  { ip: "198.51.100.14", share: 0.16, service: 0 },
  { ip: "198.51.100.27", share: 0.13, service: 1 },
  { ip: "198.51.100.44", share: 0.09, service: 0 },
  { ip: "203.0.113.57", share: 0.07, service: 1 },
  { ip: "198.51.100.88", share: 0.05, service: 0 },
  { ip: "203.0.113.51", share: 0.04, service: 2 },
  { ip: "198.51.100.63", share: 0.03, service: 3 },
  { ip: "203.0.113.62", share: 0.02, service: 4 },
  { ip: "198.51.100.101", share: 0.015, service: 5 },
  { ip: "8.8.8.8", share: 0.006, service: 6 },
  { ip: "1.1.1.1", share: 0.004, service: 6 },
];

const key = (s: { protocol: number | null; port: number | null }) =>
  `${s.protocol ?? "x"}/${s.port ?? "x"}`;

/** A stable 0..1 number for (a, b): the per-window jitter. */
function jitter(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Newest window held ends at the anchor's 5-minute boundary. */
function lastWindowEnd(): number {
  return Math.floor(demoAnchor() / WINDOW_MS) * WINDOW_MS;
}

function istHour(ms: number): number {
  return new Date(ms + 330 * MIN).getUTCHours();
}

/** The most recent 03:00-04:00 IST before the anchor: the hour the
 * "traffic at a normally quiet time" finding names. */
function quietSpike(): { start: number; end: number } {
  const last = lastWindowEnd();
  const d = new Date(last + 330 * MIN);
  d.setUTCHours(4, 0, 0, 0);
  let end = d.getTime() - 330 * MIN;
  if (end > last) end -= 24 * 60 * MIN;
  return { start: end - 60 * MIN, end };
}

const SPIKE_BYTES = 2.3 * 1024 ** 3;
const QUIET_USUAL_AT_MOST = 0.25 * 1024 ** 3;

/** Venue bytes (both directions) in the window starting at `start`. */
function windowBytes(start: number): number {
  const w = Math.floor(start / WINDOW_MS);
  const spike = quietSpike();
  const extra = start >= spike.start && start < spike.end ? SPIKE_BYTES / 12 : 0;
  return (DAY_BYTES / 288) * HOURLY[istHour(start)] * (0.75 + 0.5 * jitter(w, 7)) + extra;
}

/** Window starts inside [since, until) that are held. */
function heldWindows(sinceIso: string, untilIso: string): number[] {
  const end = lastWindowEnd();
  const oldest = end - WINDOWS_HELD * WINDOW_MS;
  const since = Math.max(Date.parse(sinceIso) || oldest, oldest);
  const until = Math.min(Date.parse(untilIso) || end, end);
  const out: number[] = [];
  for (let t = Math.ceil(since / WINDOW_MS) * WINDOW_MS; t + WINDOW_MS <= until; t += WINDOW_MS)
    out.push(t);
  return out;
}

function stepSecondsFor(spanMs: number): number {
  if (spanMs <= 60 * MIN) return 300;
  if (spanMs <= 6 * 60 * MIN) return 900;
  if (spanMs <= 26 * 60 * MIN) return 3600;
  return 3 * 3600;
}

function bounds(params: Record<string, string>): { since: string; until: string } {
  const end = lastWindowEnd();
  return {
    since: params.since ?? new Date(end - 60 * MIN).toISOString(),
    until: params.until ?? new Date(end).toISOString(),
  };
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Devices at a venue: the café's own guests there, everyone else at HQ. */
function venueGuests(locationId: string) {
  const cafe = locationId === DEMO_CAFE_LOCATION_ID;
  return DEMO_GUESTS.map((g, i) => ({ g, i })).filter(({ g }) => (g.router === 2) === cafe);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function demoLensStatus(locationId: string): LensStatus {
  const end = lastWindowEnd();
  return {
    location_id: locationId,
    collection: "collecting",
    latest_data: iso(end),
    data_starts: iso(end - WINDOWS_HELD * WINDOW_MS),
    window_seconds: WINDOW_S,
    retention_days: DAYS_HELD,
  };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function demoLensSummary(locationId: string, params: Record<string, string>): LensSummary {
  const { since, until } = bounds(params);
  const windows = heldWindows(since, until);
  const end = lastWindowEnd();
  const base = {
    location_id: locationId,
    collection: "collecting" as const,
    latest_data: iso(end),
    since,
    until,
    window_seconds: WINDOW_S,
    data_oldest: iso(end - WINDOWS_HELD * WINDOW_MS),
    data_newest: iso(end - WINDOW_MS),
  };
  const spanMs = Math.max(WINDOW_MS, Date.parse(until) - Date.parse(since));
  const stepSeconds = stepSecondsFor(spanMs);
  if (windows.length === 0) {
    return {
      ...base,
      measured: false,
      step_seconds: stepSeconds,
      windows: 0,
      totals: null,
      services_measured: false,
      services: null,
      protocols: [],
      timeline: null,
      list_accuracy: null,
      devices: null,
      destinations: null,
    };
  }

  const seriesCount = Math.max(1, Math.min(4, Number(params.series) || 4));
  const series = SERVICES.slice(0, seriesCount);
  const serviceBytes = SERVICES.map(() => 0);
  const steps = new Map<number, FlowTimelineStep>();
  let total = 0;
  let peak = 0;
  for (const start of windows) {
    const bytes = windowBytes(start);
    total += bytes;
    const w = Math.floor(start / WINDOW_MS);
    const busy = HOURLY[istHour(start)];
    peak = Math.max(peak, Math.round(6 + 22 * busy + 6 * jitter(w, 3)));
    const stepStart = Math.floor(start / (stepSeconds * 1000)) * stepSeconds * 1000;
    const step = steps.get(stepStart) ?? {
      start: iso(stepStart),
      covered_seconds: 0,
      bytes_up: 0,
      bytes_down: 0,
      bps_up: 0,
      bps_down: 0,
      services_measured: true,
      services: Object.fromEntries(series.map((s) => [key(s), 0])),
      other_bytes: 0,
      protocols: { "6": 0, "17": 0 },
    };
    step.covered_seconds += WINDOW_S;
    step.bytes_up += bytes * UP_SHARE;
    step.bytes_down += bytes * (1 - UP_SHARE);
    let listed = 0;
    SERVICES.forEach((s, k) => {
      const b = bytes * s.share * (0.85 + 0.3 * jitter(w, 100 + k));
      serviceBytes[k] += b;
      step.protocols[String(s.protocol)] = (step.protocols[String(s.protocol)] ?? 0) + b;
      if (k < seriesCount) {
        step.services[key(s)] += b;
        listed += b;
      }
    });
    step.other_bytes += Math.max(0, bytes - listed);
    steps.set(stepStart, step);
  }
  const timelineSteps = [...steps.values()].map((s) => ({
    ...s,
    bytes_up: Math.round(s.bytes_up),
    bytes_down: Math.round(s.bytes_down),
    bps_up: Math.round((s.bytes_up * 8) / s.covered_seconds),
    bps_down: Math.round((s.bytes_down * 8) / s.covered_seconds),
    other_bytes: Math.round(s.other_bytes),
    services: Object.fromEntries(Object.entries(s.services).map(([k, v]) => [k, Math.round(v)])),
    protocols: Object.fromEntries(Object.entries(s.protocols).map(([k, v]) => [k, Math.round(v)])),
  }));

  const covered = windows.length * WINDOW_S;
  const up = Math.round(total * UP_SHARE);
  const down = Math.round(total - up);
  const limit = Math.max(1, Number(params.limit) || 10);
  const items: FlowServiceItem[] = SERVICES.map((s, k) => {
    const bytes = Math.round(serviceBytes[k]);
    return {
      protocol: s.protocol,
      protocol_name: s.protocol_name,
      port: s.port,
      service_name: s.service_name,
      bytes_up: Math.round(bytes * UP_SHARE),
      bytes_down: Math.round(bytes * (1 - UP_SHARE)),
      bytes,
      flows: Math.max(1, Math.round(bytes / BYTES_PER_FLOW)),
      share: bytes / total,
      avg_bps: Math.round((bytes * 8) / covered),
    };
  })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);
  const listedServices = items.reduce((a, s) => a + s.bytes, 0);
  const tcp = serviceBytes.reduce((a, b, k) => (SERVICES[k].protocol === 6 ? a + b : a), 0);
  const udp = serviceBytes.reduce((a, b, k) => (SERVICES[k].protocol === 17 ? a + b : a), 0);
  const rest = Math.max(0, total - tcp - udp);

  // Devices: the first HQ guest is the heavy one (~41% of the period).
  const guests = venueGuests(locationId);
  const weights = guests.map((_, n) => (n === 0 ? 0 : 0.55 ** n + 0.04 * jitter(n, 9)));
  const restWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const devices: LensDeviceItem[] = guests
    .map(({ g, i }, n) => {
      const share = n === 0 ? 0.41 : (0.5 * weights[n]) / restWeight;
      const bytes = Math.round(total * share);
      const match = i % 6 === 5 ? "ambiguous" : i % 7 === 6 ? "none" : "session";
      return {
        router_id: ["r-1", "r-1-floor2", "r-1-cafe"][g.router],
        ip: g.ip,
        bytes_up: Math.round(bytes * (n === 0 ? 0.04 : UP_SHARE)),
        bytes_down: Math.round(bytes * (n === 0 ? 0.96 : 1 - UP_SHARE)),
        bytes,
        flows: Math.max(1, Math.round(bytes / BYTES_PER_FLOW)),
        share_at_least: share,
        match,
        guest_session_id:
          match === "session" ? `demo-session-${String(i + 1).padStart(3, "0")}` : null,
      } satisfies LensDeviceItem;
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);
  const destinations = DESTINATIONS.slice(0, limit).map((d) => {
    const bytes = Math.round(total * d.share);
    return {
      ip: d.ip,
      bytes_up: Math.round(bytes * UP_SHARE),
      bytes_down: Math.round(bytes * (1 - UP_SHARE)),
      bytes,
      flows: Math.max(1, Math.round(bytes / BYTES_PER_FLOW)),
      share_at_least: d.share,
    };
  });
  const sum = (xs: { bytes: number }[]) => xs.reduce((a, x) => a + x.bytes, 0);

  return {
    ...base,
    measured: true,
    step_seconds: stepSeconds,
    windows: windows.length,
    totals: {
      bytes_up: up,
      bytes_down: down,
      bytes_internal: Math.round(total * 0.004),
      bytes_unclassified: 0,
      flows: Math.round(total / BYTES_PER_FLOW),
      covered_seconds: covered,
      avg_bps_up: Math.round((up * 8) / covered),
      avg_bps_down: Math.round((down * 8) / covered),
      devices_peak: guests.length > 6 ? peak : Math.min(peak, guests.length + 4),
      destinations_peak: Math.round(peak * 11),
    },
    services_measured: true,
    services: {
      exact: true,
      items,
      other_bytes: Math.max(0, Math.round(total - listedServices)),
      other_share: Math.max(0, 1 - listedServices / total),
    },
    protocols: [
      {
        protocol: 6,
        protocol_name: "tcp",
        bytes: Math.round(tcp + rest * 0.6),
        share: (tcp + rest * 0.6) / total,
      },
      {
        protocol: 17,
        protocol_name: "udp",
        bytes: Math.round(udp + rest * 0.38),
        share: (udp + rest * 0.38) / total,
      },
      {
        protocol: 1,
        protocol_name: "icmp",
        bytes: Math.round(rest * 0.02),
        share: (rest * 0.02) / total,
      },
    ],
    timeline: {
      series: series.map((s) => ({
        protocol: s.protocol,
        protocol_name: s.protocol_name,
        port: s.port,
        service_name: s.service_name,
        key: key(s),
      })),
      steps: timelineSteps,
    },
    list_accuracy: {
      method: "per_window_top_n",
      per_window_top_n: 50,
      lower_bound: true,
      applies_to: ["devices", "destinations"],
    },
    devices: { items: devices, other_bytes_at_most: Math.max(0, Math.round(total - sum(devices))) },
    destinations: {
      items: destinations,
      other_bytes_at_most: Math.max(0, Math.round(total - sum(destinations))),
      min_devices: 5,
      windows_withheld: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const COUNTRIES: readonly {
  code: string;
  share: number;
  networks: [number, string, number][];
}[] = [
  {
    code: "IN",
    share: 0.41,
    networks: [
      [15169, "Google LLC", 0.34],
      [2906, "Netflix Streaming Services", 0.22],
      [32934, "Meta Platforms", 0.18],
      [20940, "Akamai International", 0.12],
      [9498, "Bharti Airtel", 0.06],
    ],
  },
  {
    code: "US",
    share: 0.33,
    networks: [
      [15169, "Google LLC", 0.3],
      [32934, "Meta Platforms", 0.22],
      [714, "Apple Inc.", 0.18],
      [8075, "Microsoft Corporation", 0.14],
      [16509, "Amazon.com", 0.1],
    ],
  },
  {
    code: "SG",
    share: 0.13,
    networks: [
      [16509, "Amazon.com", 0.35],
      [8075, "Microsoft Corporation", 0.25],
      [714, "Apple Inc.", 0.2],
      [13335, "Cloudflare", 0.12],
    ],
  },
  {
    code: "IE",
    share: 0.05,
    networks: [
      [8075, "Microsoft Corporation", 0.5],
      [32934, "Meta Platforms", 0.3],
    ],
  },
  { code: "NL", share: 0.03, networks: [[20940, "Akamai International", 0.6]] },
  { code: "JP", share: 0.02, networks: [[714, "Apple Inc.", 0.7]] },
];

const vol = (bytes: number, share: number) => ({
  bytes_up: Math.round(bytes * UP_SHARE),
  bytes_down: Math.round(bytes * (1 - UP_SHARE)),
  bytes: Math.round(bytes),
  flows: Math.max(1, Math.round(bytes / BYTES_PER_FLOW)),
  share,
});

export function demoLensGeo(locationId: string, params: Record<string, string>): FlowGeoSummary {
  const { since, until } = bounds(params);
  const windows = heldWindows(since, until);
  const end = lastWindowEnd();
  const total = windows.reduce((a, t) => a + windowBytes(t), 0);
  const measured = windows.length > 0;
  const countries: FlowGeoCountry[] = COUNTRIES.map((c) => {
    const bytes = total * c.share;
    const listed = c.networks.reduce((a, n) => a + n[2], 0);
    return {
      country_code: c.code,
      ...vol(bytes, c.share),
      networks: {
        items: c.networks.map(([asn, name, share]) => ({
          asn,
          network_name: name,
          ...vol(bytes * share, share),
        })),
        other_bytes: Math.round(bytes * Math.max(0, 1 - listed - 0.02)),
        unknown_bytes: Math.round(bytes * 0.02),
        withheld_bytes: 0,
      },
    };
  });
  const listed = COUNTRIES.reduce((a, c) => a + c.share, 0);
  return {
    location_id: locationId,
    networks_min_devices: 5,
    networks_withheld_windows: 0,
    measured,
    geo_available: true,
    geo_measured: measured,
    exact: true,
    since,
    until,
    window_seconds: WINDOW_S,
    windows: windows.length,
    windows_measured: windows.length,
    data_oldest: iso(end - WINDOWS_HELD * WINDOW_MS),
    data_newest: iso(end - WINDOW_MS),
    totals: measured ? vol(total, 1) : null,
    countries: measured
      ? {
          items: countries,
          other_bytes: Math.round(total * Math.max(0, 1 - listed - 0.01)),
          other_share: Math.max(0, 1 - listed - 0.01),
        }
      : null,
    unknown: measured ? vol(total * 0.01, 0.01) : null,
    attribution: {
      text: "IP Geolocation by DB-IP",
      url: "https://db-ip.com",
      license: "CC BY 4.0",
      license_url: "https://creativecommons.org/licenses/by/4.0/",
    },
    source: { name: "DB-IP Lite", country_data_built: null, network_data_built: null },
  };
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export function demoLensFindings(
  locationId: string,
  period: { since: string; until: string },
): FindingsResponse {
  const summary = demoLensSummary(locationId, { ...period, limit: "10" });
  const end = lastWindowEnd();
  const measured = summary.measured;
  const totalBytes = (summary.totals?.bytes_up ?? 0) + (summary.totals?.bytes_down ?? 0);
  const top = summary.devices?.items[0] ?? null;
  const { start: nightStart, end: nightEnd } = quietSpike();
  const inPeriod = nightStart >= Date.parse(period.since) && nightEnd <= Date.parse(period.until);
  const thresholds = {};
  const clear = (id: string): Finding => ({
    id,
    state: "clear",
    reason: null,
    severity: null,
    names:
      id === "known_bad_destinations"
        ? "destination"
        : id === "unusual_service"
          ? "service"
          : "nothing",
    parts: null,
    evidence: {},
    thresholds,
  });
  const findings: Finding[] = [
    clear("upload_heavy"),
    inPeriod
      ? {
          id: "quiet_hours_traffic",
          state: "flagged",
          reason: null,
          severity: "info",
          names: "nothing",
          parts: {
            start: iso(nightStart),
            end: iso(nightEnd),
            bytes: SPIKE_BYTES,
            usual_at_most_bytes: QUIET_USUAL_AT_MOST,
            hours: 1,
          },
          evidence: {
            items: [
              {
                start: iso(nightStart),
                end: iso(nightEnd),
                bytes: SPIKE_BYTES,
                usual_at_most_bytes: QUIET_USUAL_AT_MOST,
              },
            ],
            // 01:30-05:30 IST, in UTC hours.
            quiet_hours_utc: [20, 21, 22, 23],
            baseline_days: DAYS_HELD,
          },
          thresholds,
        }
      : clear("quiet_hours_traffic"),
    top && measured
      ? {
          id: "dominant_device",
          state: "flagged",
          reason: null,
          severity: "look",
          names: "device",
          parts: {
            device: {
              router_id: top.router_id,
              ip: top.ip,
              match: top.match,
              guest_session_id: top.guest_session_id,
            },
            share_at_least: top.share_at_least,
            bytes_at_least: top.bytes,
          },
          evidence: {
            period_bytes: totalBytes,
            devices_at_once: summary.totals?.devices_peak ?? null,
          },
          thresholds,
        }
      : {
          id: "dominant_device",
          state: "could_not_check",
          reason: "not_measured",
          severity: null,
          names: "device",
          parts: null,
          evidence: {},
          thresholds,
        },
    clear("unusual_service"),
    clear("known_bad_destinations"),
  ];
  const count = (s: string) => findings.filter((f) => f.state === s).length;
  return {
    location_id: locationId,
    measured,
    since: period.since,
    until: period.until,
    window_seconds: WINDOW_S,
    windows: summary.windows,
    data_oldest: summary.data_oldest,
    data_newest: summary.data_newest,
    baseline: {
      since: iso(end - DAYS_HELD * 24 * 60 * MIN),
      until: iso(end),
      days: DAYS_HELD,
      derived: true,
      timezone: "Asia/Kolkata",
    },
    counts: {
      flagged: count("flagged"),
      clear: count("clear"),
      could_not_check: count("could_not_check"),
    },
    notifications: false,
    threat_list: {
      name: "Demo blocklist",
      available: true,
      date: iso(end).slice(0, 10),
      stale: false,
      max_age_days: 7,
      entries: 48210,
      credit: { text: "Sample list for the demo account", url: "https://wyfyguest.com" },
    },
    findings,
    min_devices: 5,
    windows_withheld: 0,
  };
}

// ---------------------------------------------------------------------------
// Records (venue-level destinations)
// ---------------------------------------------------------------------------

function inPrefix(ip: string, filter: string): boolean {
  const [base, bits] = filter.split("/");
  if (!bits) return ip === base;
  const toInt = (s: string) => s.split(".").reduce((a, o) => (a << 8) + (Number(o) & 255), 0) >>> 0;
  const n = Number(bits);
  if (!ip.includes(".") || !base.includes(".") || !(n >= 0 && n <= 32)) return false;
  const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

const MAX_RECORDS = 500;

function destinationRecords(params: Record<string, string>): DestinationRecord[] {
  const { since, until } = bounds(params);
  const windows = heldWindows(since, until);
  // One record per (window, destination) for the busiest destinations of
  // each window; sampled across long ranges to stay small.
  const stride = Math.max(1, Math.ceil(windows.length / 120));
  const rows: DestinationRecord[] = [];
  const rnd = demoRandom(7734);
  for (let i = windows.length - 1; i >= 0; i -= stride) {
    const start = windows[i];
    const bytes = windowBytes(start) * stride;
    const w = Math.floor(start / WINDOW_MS);
    for (const d of DESTINATIONS) {
      if (jitter(w, d.ip.length * 31 + d.share * 1000) > 0.75) continue;
      const s = SERVICES[d.service];
      const b = Math.round(bytes * d.share * (0.7 + 0.6 * rnd()));
      rows.push({
        window_start: iso(start),
        window_end: iso(start + WINDOW_MS),
        address: d.ip,
        protocol: s.protocol,
        protocol_name: s.protocol_name,
        port: s.port ?? 0,
        service_name: s.service_name,
        bytes_up: Math.round(b * UP_SHARE),
        bytes_down: Math.round(b * (1 - UP_SHARE)),
        bytes: b,
        flows: Math.max(1, Math.round(b / BYTES_PER_FLOW)),
        packets: Math.round(b / 1100),
      });
    }
  }
  return rows;
}

function filterRecords(rows: DestinationRecord[], params: Record<string, string>) {
  return rows.filter((r) => {
    if (params.address && !inPrefix(r.address, params.address.trim())) return false;
    if (params.protocol && r.protocol !== Number(params.protocol)) return false;
    if (params.port && r.port !== Number(params.port)) return false;
    if (params.direction === "up" && !(r.bytes_up > r.bytes_down)) return false;
    if (params.direction === "down" && !(r.bytes_down >= r.bytes_up)) return false;
    return true;
  });
}

const SORT_FIELD: Record<string, (r: DestinationRecord) => number | string> = {
  time: (r) => r.window_start,
  address: (r) => r.address,
  protocol: (r) => r.protocol,
  port: (r) => r.port,
  bytes: (r) => r.bytes,
  bytes_up: (r) => r.bytes_up,
  bytes_down: (r) => r.bytes_down,
  flows: (r) => r.flows,
  packets: (r) => r.packets ?? 0,
};

function rangeFields(locationId: string, params: Record<string, string>) {
  const { since, until } = bounds(params);
  const windows = heldWindows(since, until).length;
  const end = lastWindowEnd();
  return {
    measured: windows > 0,
    location_id: locationId,
    router_id: null,
    since,
    until,
    window_seconds: WINDOW_S,
    windows,
    windows_measured: windows,
    data_oldest: iso(end - WINDOWS_HELD * WINDOW_MS),
    data_newest: iso(end - WINDOW_MS),
    per_window_top_n: 50,
    min_devices: 5,
    windows_withheld: 0,
  };
}

export function demoLensDestinationSearch(
  locationId: string,
  params: Record<string, string>,
): DestinationSearchResult {
  const matching = filterRecords(destinationRecords(params), params);
  const sortKey = (params.sort as DestinationSearchResult["sort"]) || "time";
  const order = params.order === "asc" ? "asc" : "desc";
  const get = SORT_FIELD[sortKey] ?? SORT_FIELD.time;
  const sorted = [...matching].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    const c = x < y ? -1 : x > y ? 1 : 0;
    return order === "asc" ? c : -c;
  });
  const limit = Math.max(1, Math.min(MAX_RECORDS, Number(params.limit) || MAX_RECORDS));
  const rows = sorted.slice(0, limit);
  const totals = matching.reduce(
    (a, r) => ({
      bytes_up: a.bytes_up + r.bytes_up,
      bytes_down: a.bytes_down + r.bytes_down,
      bytes: a.bytes + r.bytes,
      flows: a.flows + r.flows,
    }),
    { bytes_up: 0, bytes_down: 0, bytes: 0, flows: 0 },
  );
  const fields = rangeFields(locationId, params);
  return {
    ...fields,
    retention_days: DAYS_HELD,
    filters: {
      address: params.address ?? null,
      protocol: params.protocol ? Number(params.protocol) : null,
      port: params.port ? Number(params.port) : null,
      direction:
        params.direction === "up" || params.direction === "down" ? params.direction : "any",
    },
    sort: sortKey,
    order,
    limit,
    total: matching.length,
    returned: rows.length,
    truncated: matching.length > rows.length,
    query_ms: 12,
    totals: fields.measured ? totals : null,
    unlisted: fields.measured
      ? {
          bytes_up: Math.round(totals.bytes_up * 0.08),
          bytes_down: Math.round(totals.bytes_down * 0.08),
          bytes: Math.round(totals.bytes * 0.08),
          flows: Math.round(totals.flows * 0.08),
        }
      : null,
    rows,
  };
}

export function demoLensDestinationCsv(params: Record<string, string>): {
  csv: string;
  total: number;
  rows: number;
} {
  const matching = filterRecords(destinationRecords(params), params);
  const header = [
    "window_start",
    "window_end",
    "address",
    "protocol",
    "port",
    "service",
    "bytes_up",
    "bytes_down",
    "bytes",
    "flows",
    "packets",
  ];
  const lines = matching.map((r) =>
    [
      r.window_start,
      r.window_end,
      r.address,
      r.protocol_name.toUpperCase(),
      r.port,
      r.service_name ?? "",
      r.bytes_up,
      r.bytes_down,
      r.bytes,
      r.flows,
      r.packets ?? "",
    ].join(","),
  );
  return {
    csv: [header.join(","), ...lines].join("\r\n") + "\r\n",
    total: matching.length,
    rows: matching.length,
  };
}

export function demoLensServiceDestinations(
  locationId: string,
  params: Record<string, string>,
): ServiceDestinationsResult {
  const fields = rangeFields(locationId, params);
  const protocol = Number(params.protocol);
  const port = Number(params.port);
  const svc = SERVICES.find((s) => s.protocol === protocol && s.port === port) ?? null;
  const summary = demoLensSummary(locationId, {
    since: fields.since,
    until: fields.until,
    limit: "20",
  });
  const item = summary.services?.items.find((s) => s.protocol === protocol && s.port === port);
  const bytes = item?.bytes ?? 0;
  const dests = DESTINATIONS.filter((d) => SERVICES[d.service] === svc);
  const weightSum = dests.reduce((a, d) => a + d.share, 0) || 1;
  const listedShare = Math.min(0.85, 0.5 + 0.1 * dests.length);
  const limit = Math.max(1, Number(params.limit) || 10);
  const items = dests.slice(0, limit).map((d) => {
    const share = (d.share / weightSum) * listedShare;
    const b = Math.round(bytes * share);
    return {
      address: d.ip,
      bytes_up: Math.round(b * UP_SHARE),
      bytes_down: Math.round(b * (1 - UP_SHARE)),
      bytes: b,
      flows: Math.max(1, Math.round(b / BYTES_PER_FLOW)),
      share,
    };
  });
  const listed = items.reduce((a, d) => a + d.bytes, 0);
  return {
    ...fields,
    service:
      svc && item
        ? {
            protocol: svc.protocol,
            protocol_name: svc.protocol_name,
            port: svc.port ?? 0,
            service_name: svc.service_name,
            exact: true,
            bytes_up: item.bytes_up,
            bytes_down: item.bytes_down,
            bytes: item.bytes,
            flows: item.flows,
          }
        : null,
    lower_bound: true,
    destinations_listed: items.length,
    listed_bytes: listed,
    unlisted_bytes: Math.max(0, bytes - listed),
    unlisted_share: bytes > 0 ? Math.max(0, 1 - listed / bytes) : 0,
    items,
  };
}
