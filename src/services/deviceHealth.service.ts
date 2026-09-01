/**
 * Device health readings + per-interface traffic counters for one device.
 *
 * Backed by `GET /routers/{router_id}/health-history`
 * (`app/domains/router_provisioning/router.py`), which serves the
 * `router_health_snapshots` table. Both device-metrics sweeps write into
 * that one table: the RouterOS-API sweep every 600s and the SNMP sweep
 * every 300s, the latter tagging `metrics_source="snmp"` and attaching
 * `interface_traffic_counters` the router-API path has no equivalent for.
 * So a page of history is an interleaving of both sources, and the
 * per-interface breakdown is present on only some rows -- see
 * `toInterfaceSeries` in `@/lib/device-health`, which is where that gets
 * separated out rather than being smeared over the chart.
 *
 * This module deliberately reads only metrics. The SNMP *configuration*
 * on a router (community string, version, port, enabled flag) is
 * Master-console territory and is never requested, mapped, or rendered
 * here.
 */
import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  DeviceHealthHistory,
  DeviceHealthReading,
  InterfaceTrafficCounter,
  MetricsSource,
} from "@/types/deviceHealth";

/* ── Backend wire shapes ───────────────────────────────────── */

interface BackendInterfaceTrafficCounter {
  if_index: number;
  if_name: string;
  up: boolean | null;
  in_octets: number | null;
  out_octets: number | null;
}

interface BackendHealthSnapshot {
  id: string;
  router_id: string;
  recorded_at: string;
  health_status: string | null;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
  uptime_seconds: number | null;
  connected_clients_count: number | null;
  metrics_source: string | null;
  interface_traffic_counters: BackendInterfaceTrafficCounter[] | null;
}

interface BackendHealthHistory {
  items: BackendHealthSnapshot[];
  total_items: number;
}

/**
 * The backend's vocabulary is `"routeros_api"` / `"snmp"` / `null`. Any
 * other string is a source this client does not know how to describe, so
 * it reports `null` ("not recorded") rather than inventing a label --
 * same posture as the `null` case itself.
 */
function toMetricsSource(raw: string | null): MetricsSource {
  if (raw === "snmp") return "snmp";
  if (raw === "routeros_api") return "routerApi";
  return null;
}

function toCounter(raw: BackendInterfaceTrafficCounter): InterfaceTrafficCounter {
  return {
    ifIndex: raw.if_index,
    ifName: raw.if_name,
    up: raw.up ?? null,
    inOctets: raw.in_octets ?? null,
    outOctets: raw.out_octets ?? null,
  };
}

function toReading(raw: BackendHealthSnapshot): DeviceHealthReading {
  return {
    id: raw.id,
    routerId: raw.router_id,
    recordedAt: raw.recorded_at,
    healthStatus: raw.health_status,
    cpuUsagePercent: raw.cpu_usage_percent,
    memoryUsagePercent: raw.memory_usage_percent,
    uptimeSeconds: raw.uptime_seconds,
    connectedClientsCount: raw.connected_clients_count,
    metricsSource: toMetricsSource(raw.metrics_source),
    // Preserved as null rather than defaulted to [] -- "no per-interface
    // reading was taken" is not "zero interfaces exist".
    interfaceTrafficCounters: raw.interface_traffic_counters
      ? raw.interface_traffic_counters.map(toCounter)
      : null,
  };
}

/**
 * Most recent readings the API will return in one page (its own
 * `page_size` ceiling). At the sweep cadences above that is roughly five
 * to six hours of history -- the UI states the real span it received
 * rather than promising a fixed window.
 */
export const HEALTH_HISTORY_PAGE_SIZE = 100;

/* ── Demo seed ─────────────────────────────────────────────── */

/**
 * Demo mode never talks to the backend. The seed spans the states that
 * actually matter to the view, so they are demonstrable rather than
 * theoretical: two interfaces, a WAN uplink climbing toward saturation,
 * an interleaved router-API reading carrying no per-interface data, and a
 * counter reset partway through (the device rebooted) which must render
 * as a gap, never as a negative or a spike.
 */
function demoHistory(routerId: string): DeviceHealthHistory {
  const now = Date.now();
  const step = 5 * 60_000;
  const readings: DeviceHealthReading[] = [];

  // Cumulative counters, climbing. ether1 = WAN, ether2 = LAN.
  let wanIn = 4_000_000_000;
  let wanOut = 900_000_000;
  let lanIn = 1_200_000_000;
  let lanOut = 3_100_000_000;

  for (let i = 23; i >= 0; i--) {
    const at = new Date(now - i * step).toISOString();

    // Ramp the WAN toward the evening peak, then a reboot at i === 6.
    const busy = i < 14 && i > 5;
    wanIn += busy ? 3_600_000_000 : 700_000_000;
    wanOut += busy ? 420_000_000 : 90_000_000;
    lanIn += 500_000_000;
    lanOut += busy ? 3_300_000_000 : 640_000_000;

    if (i === 6) {
      // Device rebooted: counters restart from near zero.
      wanIn = 12_000_000;
      wanOut = 3_000_000;
      lanIn = 8_000_000;
      lanOut = 11_000_000;
    }

    // Every third reading is the router-API sweep: no interface detail.
    const isRouterApi = i % 3 === 0;
    readings.push({
      id: `demo-snap-${i}`,
      routerId,
      recordedAt: at,
      healthStatus: i === 6 ? "unhealthy" : "healthy",
      cpuUsagePercent: busy ? 68 + (i % 4) * 3 : 21 + (i % 5),
      memoryUsagePercent: 44 + (i % 6),
      uptimeSeconds: i >= 6 ? 900_000 - i * 300 : (6 - i) * 300,
      connectedClientsCount: isRouterApi ? 40 + (i % 9) : null,
      metricsSource: isRouterApi ? "routerApi" : "snmp",
      interfaceTrafficCounters: isRouterApi
        ? null
        : [
            { ifIndex: 1, ifName: "ether1", up: true, inOctets: wanIn, outOctets: wanOut },
            { ifIndex: 2, ifName: "ether2", up: true, inOctets: lanIn, outOctets: lanOut },
          ],
    });
  }

  return { readings, totalItems: readings.length };
}

/* ── Service ───────────────────────────────────────────────── */

export const deviceHealthService = {
  /**
   * Readings for one device, oldest-first so they chart directly. The API
   * paginates newest-first; the reversal happens here so no component has
   * to remember to do it.
   */
  async history(routerId: string, organizationId: string): Promise<DeviceHealthHistory> {
    if (isDemo()) return demoHistory(routerId);
    const { data } = await api.get<BackendHealthHistory>(`/routers/${routerId}/health-history`, {
      params: { page: 1, page_size: HEALTH_HISTORY_PAGE_SIZE },
      headers: { "X-Organization-Id": organizationId },
    });
    const readings = data.items.map(toReading);
    readings.reverse();
    return { readings, totalItems: data.total_items };
  },
};
