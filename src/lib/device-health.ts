/**
 * Pure derivation for "how much traffic did this interface actually move,
 * and when did it peak".
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * Same reasoning as `src/lib/location-liveness.ts`: the arithmetic below
 * is the entire correctness of the feature, and it is the kind that is
 * silently wrong rather than loudly broken. Keeping it pure means it can
 * be executed for real by `scripts/test-device-health.mjs` instead of
 * being eyeballed inside a chart.
 *
 * THE CENTRAL FACT: THESE ARE COUNTERS, NOT RATES
 * -----------------------------------------------
 * `RouterHealthSnapshot.interface_traffic_counters` stores IF-MIB
 * `ifHCInOctets`/`ifHCOutOctets` -- monotonically increasing totals since
 * the device last reset them. The backend serves them exactly as read,
 * and says so (`RouterInterfaceTrafficCounter`'s docstring: "never a rate
 * ... turning two successive snapshots into a Mbps rate is the caller's
 * own job"). That job is here.
 *
 * Throughput between two readings is therefore
 *
 *     (octets2 - octets1) * 8 / (t2 - t1) / 1e6   Mbps
 *
 * and the three ways that goes wrong, each of which must produce a *gap*
 * rather than a number:
 *
 *  1. COUNTER RESET. A device reboot (or a 32-bit counter wrapping)
 *     restarts the total near zero, so `octets2 < octets1` and the naive
 *     delta is negative. Plotting a negative throughput is nonsense;
 *     plotting `Math.abs()` of it invents an enormous spike at exactly
 *     the moment the device was least healthy, which is precisely when
 *     someone is looking. Both are worse than an honest gap.
 *  2. NO READING. A null counter means the agent did not answer that OID.
 *     It is not zero traffic.
 *  3. A GAP TOO LONG TO AVERAGE OVER. If the device went quiet for hours,
 *     the delta across that hole is a real total but a meaningless
 *     *rate* -- a saturation peak averaged over six hours reads as calm.
 *     Beyond `MAX_INTERVAL_MINUTES` the pair is reported as a gap.
 *
 * `null` in a series point means exactly one thing throughout: no
 * throughput could be measured across that interval. Charts render it
 * with `connectNulls={false}` so the line breaks rather than
 * interpolating across a hole it cannot see into.
 */
import type { DeviceHealthReading, InterfaceTrafficCounter } from "@/types/deviceHealth";

/**
 * Longest interval between two readings still worth expressing as a rate.
 *
 * The slower of the two sweeps that feed this chart runs every 10 minutes
 * (`ROUTER_HEALTH_POLL_SWEEP_INTERVAL_SECONDS = 600`; the SNMP one is
 * 300s), so this is three consecutive missed sweeps of the slow path --
 * comfortably past ordinary jitter, well short of averaging a busy
 * evening into a flat line.
 *
 * The backend applies the same 1800s ceiling to the ISP link card's own
 * rate derivation (`MAX_RATE_INTERVAL_SECONDS` in
 * `app/domains/isp/constants.py`). Different pipeline, same question
 * about the same physical link -- change one, change both.
 */
export const MAX_INTERVAL_MINUTES = 30;

/** One charted instant for one interface. `null` == not measurable. */
export interface InterfaceThroughputPoint {
  /** End of the interval this rate was measured across. */
  at: string;
  downMbps: number | null;
  upMbps: number | null;
}

export interface InterfaceSeries {
  ifIndex: number;
  ifName: string;
  /** Oldest-first. */
  points: InterfaceThroughputPoint[];
  /** Most recent non-null `up` reported for this interface. */
  up: boolean | null;
  /** Highest measured values, and when. `null` when never measurable. */
  peakDownMbps: number | null;
  peakDownAt: string | null;
  peakUpMbps: number | null;
  peakUpAt: string | null;
  /** Total octets observed across all usable intervals. */
  totalInOctets: number;
  totalOutOctets: number;
}

/** Bits per octet. Named so the `* 8` below is not a magic number. */
const BITS_PER_OCTET = 8;
const BITS_PER_MEGABIT = 1_000_000;

/**
 * Rate across one interval, or `null` if it cannot honestly be measured.
 * Exported for the test harness -- this is the predicate that matters.
 */
export function intervalMbps(
  earlierOctets: number | null,
  laterOctets: number | null,
  earlierAt: string,
  laterAt: string,
): number | null {
  if (earlierOctets == null || laterOctets == null) return null;
  if (!Number.isFinite(earlierOctets) || !Number.isFinite(laterOctets)) return null;

  const seconds = (new Date(laterAt).getTime() - new Date(earlierAt).getTime()) / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds > MAX_INTERVAL_MINUTES * 60) return null;

  const delta = laterOctets - earlierOctets;
  // Counter reset / wrap. An honest gap, never an absolute value.
  if (delta < 0) return null;

  return (delta * BITS_PER_OCTET) / seconds / BITS_PER_MEGABIT;
}

/**
 * Stable identity for an interface across readings.
 *
 * The NAME, not the index. `ifIndex` means two different things
 * depending on which sweep took the reading: SNMP reports a genuine
 * IF-MIB `ifIndex`, while the RouterOS-API sweep has no such field and
 * parses the device's own internal row id (`*1`, `*2`) instead. Those
 * two numbering schemes are commonly equal on RouterOS but nothing has
 * verified it against hardware, so they must not be assumed equal here.
 *
 * Keying on the index would mean that a router polled by both
 * transports could render `ether1` as two separate series -- each
 * holding half the history, each looking like a complete one. There is
 * no error state for that; it just quietly halves what the operator
 * sees. The name is what both transports report identically, and it is
 * also the identity the operator recognises.
 *
 * `ifIndex` is still carried on the series (first one seen wins) purely
 * for ordering and for DOM ids.
 */
function key(counter: InterfaceTrafficCounter): string {
  return counter.ifName;
}

/**
 * Turn a device's readings into one throughput series per interface.
 *
 * Only readings that actually carry a per-interface breakdown take part.
 * Both sweeps now attach one, but older rows -- and any poll whose
 * interface read failed -- do not. Those are skipped rather than treated
 * as zeroes: a reading with no breakdown is not a reading of no traffic,
 * and counting it would draw a hole in the line that the device never
 * had.
 *
 * `readings` must be oldest-first (`deviceHealthService.history` returns
 * them that way).
 */
export function toInterfaceSeries(readings: DeviceHealthReading[]): InterfaceSeries[] {
  const withCounters = readings.filter(
    (r) => r.interfaceTrafficCounters != null && r.interfaceTrafficCounters.length > 0,
  );

  const series = new Map<string, InterfaceSeries>();
  // Previous usable reading per interface, so a single interface missing
  // from one poll does not break the whole device's series.
  const previous = new Map<string, { at: string; counter: InterfaceTrafficCounter }>();

  for (const reading of withCounters) {
    for (const counter of reading.interfaceTrafficCounters ?? []) {
      const k = key(counter);
      let entry = series.get(k);
      if (!entry) {
        entry = {
          ifIndex: counter.ifIndex,
          ifName: counter.ifName,
          points: [],
          up: null,
          peakDownMbps: null,
          peakDownAt: null,
          peakUpMbps: null,
          peakUpAt: null,
          totalInOctets: 0,
          totalOutOctets: 0,
        };
        series.set(k, entry);
      }
      if (counter.up != null) entry.up = counter.up;

      const prev = previous.get(k);
      if (prev) {
        const downMbps = intervalMbps(
          prev.counter.inOctets,
          counter.inOctets,
          prev.at,
          reading.recordedAt,
        );
        const upMbps = intervalMbps(
          prev.counter.outOctets,
          counter.outOctets,
          prev.at,
          reading.recordedAt,
        );
        entry.points.push({ at: reading.recordedAt, downMbps, upMbps });

        if (downMbps != null) {
          if (entry.peakDownMbps == null || downMbps > entry.peakDownMbps) {
            entry.peakDownMbps = downMbps;
            entry.peakDownAt = reading.recordedAt;
          }
          if (prev.counter.inOctets != null && counter.inOctets != null) {
            entry.totalInOctets += counter.inOctets - prev.counter.inOctets;
          }
        }
        if (upMbps != null) {
          if (entry.peakUpMbps == null || upMbps > entry.peakUpMbps) {
            entry.peakUpMbps = upMbps;
            entry.peakUpAt = reading.recordedAt;
          }
          if (prev.counter.outOctets != null && counter.outOctets != null) {
            entry.totalOutOctets += counter.outOctets - prev.counter.outOctets;
          }
        }
      }
      previous.set(k, { at: reading.recordedAt, counter });
    }
  }

  return [...series.values()].sort((a, b) => a.ifIndex - b.ifIndex);
}

/** Human byte size. `null` in, "—" out; never a fabricated zero. */
export function formatOctets(octets: number | null): string {
  if (octets == null || !Number.isFinite(octets)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = octets;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Mbps for display. `null` reads as "no reading", never as 0. */
export function formatMbps(mbps: number | null): string {
  if (mbps == null || !Number.isFinite(mbps)) return "No reading";
  if (mbps >= 100) return `${mbps.toFixed(0)} Mbps`;
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  return `${mbps.toFixed(2)} Mbps`;
}

/**
 * Customer-facing label for where a reading came from.
 *
 * This is provenance -- which measurement path took the reading, and so
 * how much detail it carries -- not configuration. It says nothing about
 * whether SNMP is enabled, on which port, or with what community string;
 * none of that is customer-facing (see `@/types/deviceHealth`).
 */
export function metricsSourceLabel(source: DeviceHealthReading["metricsSource"]): string {
  if (source === "snmp") return "SNMP";
  if (source === "routerApi") return "Router API";
  return "Not recorded";
}

/**
 * The span the readings actually cover, so the UI can state the real
 * window it received rather than promising a fixed one.
 */
export function readingSpanLabel(readings: DeviceHealthReading[]): string | null {
  if (readings.length < 2) return null;
  const first = new Date(readings[0].recordedAt).getTime();
  const last = new Date(readings[readings.length - 1].recordedAt).getTime();
  const minutes = Math.round((last - first) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 90) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${Math.round(hours / 24)} d`;
}
