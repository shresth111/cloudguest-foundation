/**
 * Words for a monitored device's health: the backend's `health` object on
 * `GET /monitored-hardware` (codes only) turned into what a venue owner reads.
 * (Not to be confused with `@/lib/device-health`, which derives interface
 * traffic from SNMP counters for the dashboard.)
 *
 * ## The defects this replaces
 *
 * 1. "Up · connected 16d 22h" was time since an inactive->active flip the
 *    sweep happened to record, not uptime. A device that rebooted between two
 *    30-second sweeps never failed a ping, so the number never reset.
 * 2. "Down" with no reason. At HKM on 2026-10-19 the AP's router port ether3
 *    had been link-down since 07:09 (cable out or AP unpowered), and the owner
 *    read the bare "Down" as a Wyfy bug.
 *
 * ## The rules
 *
 * - "since" is when *this platform observed* the change. It is never called
 *   uptime: nothing behind a router reports uptime. A reboot shows up as a
 *   port link flap, which is counted.
 * - A DOWN always says why, in terms the owner can act on (port, cable,
 *   power), never in protocol words.
 * - One missed check is amber "Not responding", not red "Down". Red, and the
 *   alert, need a second miss in a row (backend debounce), or a dead link.
 */

export type HealthState = "up" | "degraded" | "down" | "unknown";

export interface DeviceHealthEvent {
  at: string;
  kind: "state" | "link_down" | "ip_changed" | string;
  fromState: string | null;
  toState: string | null;
  reason: string | null;
  count: number | null;
  detail: string | null;
}

export interface DeviceHealth {
  state: HealthState;
  reason: string;
  since: string;
  checkedAt: string;
  consecutiveFailures: number;
  lastOkAt: string | null;
  lastRttMs: number | null;
  probeMethod: "icmp" | "arp" | null;
  portName: string | null;
  portRunning: boolean | null;
  portLastLinkDownAt: string | null;
  portLastLinkUpAt: string | null;
  linkFlaps24h: number;
  clientsBehind: number | null;
  rxBps: number | null;
  txBps: number | null;
  events24h: DeviceHealthEvent[];
}

/** Backend wire shape (snake_case), mapped by `toDeviceHealth`. */
export interface RawDeviceHealth {
  state: HealthState;
  reason: string;
  since: string;
  checked_at: string;
  consecutive_failures: number;
  last_ok_at: string | null;
  last_rtt_ms: number | null;
  probe_method: "icmp" | "arp" | null;
  port_name: string | null;
  port_running: boolean | null;
  port_last_link_down_at: string | null;
  port_last_link_up_at: string | null;
  link_flaps_24h: number;
  clients_behind: number | null;
  rx_bps: number | null;
  tx_bps: number | null;
  events_24h: {
    at: string;
    kind: string;
    from_state: string | null;
    to_state: string | null;
    reason: string | null;
    count: number | null;
    detail: string | null;
  }[];
}

export function toDeviceHealth(raw: RawDeviceHealth | null | undefined): DeviceHealth | null {
  if (!raw) return null;
  return {
    state: raw.state,
    reason: raw.reason,
    since: raw.since,
    checkedAt: raw.checked_at,
    consecutiveFailures: raw.consecutive_failures,
    lastOkAt: raw.last_ok_at,
    lastRttMs: raw.last_rtt_ms,
    probeMethod: raw.probe_method,
    portName: raw.port_name,
    portRunning: raw.port_running,
    portLastLinkDownAt: raw.port_last_link_down_at,
    portLastLinkUpAt: raw.port_last_link_up_at,
    linkFlaps24h: raw.link_flaps_24h ?? 0,
    clientsBehind: raw.clients_behind,
    rxBps: raw.rx_bps,
    txBps: raw.tx_bps,
    events24h: (raw.events_24h ?? []).map((e) => ({
      at: e.at,
      kind: e.kind,
      fromState: e.from_state,
      toState: e.to_state,
      reason: e.reason,
      count: e.count,
      detail: e.detail,
    })),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "07:09" today, "yesterday 21:31", else "18 Oct 21:31" -- local time. */
export function formatWhen(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, new Date(now))) return hhmm;
  if (sameDay(d, new Date(now - 86_400_000))) return `yesterday ${hhmm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hhmm}`;
}

/** 1_200_000 -> "1.2 Mbps". */
export function formatBps(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${Math.round(bps / 1_000)} kbps`;
  return `${bps} bps`;
}

export interface HealthDescription {
  /** Badge word. */
  state: string;
  /** Short fact beside it -- always carries its own label ("since", "port"). */
  detail: string | null;
  /** One sentence for a tooltip: what it means and what to check. */
  explanation: string | null;
  tone: "up" | "down" | "warning" | "neutral";
}

const DOWN_WHY: Record<string, (h: DeviceHealth) => { detail: string; explanation: string }> = {
  port_link_down: (h) => ({
    detail: `port ${h.portName ?? "?"} link down`,
    explanation:
      `The router port ${h.portName ?? ""} has no link: the cable is unplugged or the device ` +
      "is powered off. Check the cable and the device's power.",
  }),
  port_disabled: (h) => ({
    detail: `port ${h.portName ?? "?"} disabled`,
    explanation: `Router port ${h.portName ?? ""} is disabled in the router's configuration.`,
  }),
  no_arp_reply: (h) => ({
    detail: h.portName ? `port ${h.portName} up, device not answering` : "device not answering",
    explanation:
      "The device is not answering on the network at all (ping or ARP). " +
      "It may be hung, or switched off behind a switch -- try restarting it.",
  }),
  no_ping_reply: () => ({
    detail: "not answering ping",
    explanation: "The device does not answer ping, and the router could not check it another way.",
  }),
  not_on_lan: () => ({
    detail: "router can't see it on the network",
    explanation:
      "The router has no trace of this MAC address. The device is off, unplugged, " +
      "or connected to a different network.",
  }),
};

/**
 * The status cell's words for a device with a backend `health` object.
 * Callers without one fall back to `describeLiveness`, unchanged.
 */
export function describeHealth(h: DeviceHealth, now: number = Date.now()): HealthDescription {
  if (h.state === "unknown") {
    return {
      state: "Status stale",
      detail: `last checked ${formatWhen(h.checkedAt, now)}`,
      explanation:
        "This device has not been checked for over 5 minutes, so its last status is not shown " +
        "as current. The venue router may be unreachable.",
      tone: "warning",
    };
  }
  if (h.state === "down") {
    // The router's own link-down time is more precise than our sweep's.
    const at =
      h.reason === "port_link_down" && h.portLastLinkDownAt ? h.portLastLinkDownAt : h.since;
    const why = DOWN_WHY[h.reason]?.(h);
    return {
      state: "Down",
      detail: `since ${formatWhen(at, now)}${why ? ` · ${why.detail}` : ""}`,
      explanation: why?.explanation ?? null,
      tone: "down",
    };
  }
  if (h.state === "degraded" && h.reason === "probe_failing") {
    const n = h.consecutiveFailures;
    return {
      state: "Not responding",
      detail: `missed ${n} check${n === 1 ? "" : "s"} · rechecking`,
      explanation:
        "The last check got no reply. It is marked Down (and alerts fire) only if the next " +
        "check fails too.",
      tone: "warning",
    };
  }
  if (h.state === "degraded" && h.reason === "link_flapping") {
    return {
      state: "Unstable",
      detail:
        `up since ${formatWhen(h.since, now)} · ` +
        `port ${h.portName ?? "?"} dropped ${h.linkFlaps24h}× in 24h`,
      explanation:
        "The device answers, but its cable link keeps dropping: a loose cable, a failing port, " +
        "or the device rebooting.",
      tone: "warning",
    };
  }
  return {
    state: "Up",
    detail: `since ${formatWhen(h.since, now)}`,
    explanation:
      h.probeMethod === "arp"
        ? "This device ignores ping, so it is checked at the network level (ARP) instead."
        : null,
    tone: "up",
  };
}

/** Small evidence facts under the badge, each labelled. Empty when none. */
export function healthFacts(h: DeviceHealth): string[] {
  const facts: string[] = [];
  if (h.portName) facts.push(`port ${h.portName}`);
  if (h.lastRttMs != null && h.state !== "down") {
    facts.push(`${h.lastRttMs < 1 ? "<1" : Math.round(h.lastRttMs)} ms`);
  }
  if (h.clientsBehind != null && h.clientsBehind > 0) {
    facts.push(`${h.clientsBehind} device${h.clientsBehind === 1 ? "" : "s"} on port`);
  }
  if (h.txBps != null || h.rxBps != null) {
    facts.push(`↓${formatBps(h.txBps ?? 0)} ↑${formatBps(h.rxBps ?? 0)}`);
  }
  if (h.linkFlaps24h > 0 && h.reason !== "link_flapping") {
    facts.push(`${h.linkFlaps24h} link drop${h.linkFlaps24h === 1 ? "" : "s"} in 24h`);
  }
  return facts;
}

export interface TimelineSegment {
  /** 0..1 fractions of the 24h window. */
  start: number;
  end: number;
  state: HealthState;
}

const DAY_MS = 86_400_000;

/**
 * The last 24h as coloured segments, from `state` events plus the current
 * state. Before the first known observation the window is "unknown" --
 * never painted with a state nobody observed.
 */
export function healthTimeline(h: DeviceHealth, now: number = Date.now()): TimelineSegment[] {
  const windowStart = now - DAY_MS;
  const changes = h.events24h
    .filter((e) => e.kind === "state" && e.toState)
    .map((e) => ({
      at: new Date(e.at).getTime(),
      from: e.fromState as HealthState | null,
      to: e.toState as HealthState,
    }))
    .sort((a, b) => a.at - b.at);
  const segments: TimelineSegment[] = [];
  let cursor = windowStart;
  const push = (until: number, s: HealthState) => {
    const a = cursor;
    const b = Math.min(until, now);
    if (b > a) {
      segments.push({
        start: (a - windowStart) / DAY_MS,
        end: (b - windowStart) / DAY_MS,
        state: s,
      });
    }
    cursor = Math.max(cursor, b);
  };
  let state: HealthState;
  if (changes.length > 0) {
    state = changes[0].from ?? "unknown";
  } else {
    // No transition in the window: the current state has held since `since`.
    push(new Date(h.since).getTime(), "unknown");
    state = h.state;
  }
  for (const c of changes) {
    push(c.at, state);
    state = c.to;
  }
  push(now, state);
  return segments;
}
