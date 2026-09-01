/**
 * Device health readings and per-interface traffic counters.
 *
 * NAMING (deliberate -- see `docs/ipdr-logs-syslog-spec.md` §5)
 * ------------------------------------------------------------
 * The customer request that prompted this asked for "SNMP logs". This is
 * not a log, and the customer-facing name must not say "SNMP" or "logs":
 *
 *  - It is not a log. Nothing here is an event stream. Every row is a
 *    periodic *measurement* of one device -- CPU, memory, uptime, and a
 *    cumulative octet counter per interface.
 *  - "SNMP" is a transport, not a thing a venue owner has. Naming the page
 *    after it promises protocol-level access the dashboard deliberately
 *    does not give (SNMP *configuration* -- community string, version,
 *    port -- is Master-console-only, the same rule WireGuard internals
 *    follow).
 *
 * So the surface is called **Device health & interface traffic**, which is
 * exactly what the data is. `metricsSource` still reports "snmp" vs
 * "routerApi" because that is *provenance of a reading* -- which
 * measurement path took it, and therefore how much detail it carries --
 * not a configuration knob.
 *
 * What this data genuinely cannot answer, and must never be captioned as
 * answering: *where* a guest went. There is no NetFlow, syslog or DPI
 * ingestion anywhere in this platform (same §3/§5 finding). These are
 * byte counters on an interface, nothing more.
 */

/**
 * Which measurement path took a reading.
 *
 * `null` is a real, distinct answer and is never collapsed into a
 * default: rows recorded before the backend's `0079` migration have no
 * recorded source at all, and claiming one would fabricate provenance.
 */
export type MetricsSource = "snmp" | "routerApi" | null;

/**
 * One interface's counters within a single reading.
 *
 * `inOctets`/`outOctets` are **cumulative device counters, not rates** --
 * the backend serves exactly what the interface reported at `recordedAt`.
 * Turning two successive readings into a throughput figure is this
 * client's job; see `toInterfaceSeries`.
 *
 * Every field except `ifIndex`/`ifName` is nullable because an SNMP agent
 * that does not answer an OID yields no value -- never a `0`, which would
 * read as a real measurement of "no traffic".
 */
export interface InterfaceTrafficCounter {
  ifIndex: number;
  ifName: string;
  up: boolean | null;
  inOctets: number | null;
  outOctets: number | null;
}

/** One periodic health reading for one device. */
export interface DeviceHealthReading {
  id: string;
  routerId: string;
  recordedAt: string;
  healthStatus: string | null;
  cpuUsagePercent: number | null;
  memoryUsagePercent: number | null;
  uptimeSeconds: number | null;
  connectedClientsCount: number | null;
  metricsSource: MetricsSource;
  /**
   * `null` (never `[]`) when this reading carries no per-interface
   * breakdown -- either a router-API reading (that path has none) or an
   * SNMP poll that returned no interfaces. `[]` would claim we looked and
   * found zero interfaces.
   */
  interfaceTrafficCounters: InterfaceTrafficCounter[] | null;
}

export interface DeviceHealthHistory {
  /** Oldest-first, ready to chart. */
  readings: DeviceHealthReading[];
  totalItems: number;
}
