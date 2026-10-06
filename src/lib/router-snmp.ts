/**
 * Master console SNMP for one fleet device: wire mapping and the honest
 * presentation of its state. Pure, so `scripts/test-router-snmp.mjs` can
 * execute it for real.
 *
 * MASTER ONLY. SNMP credentials and the poller's source addresses are
 * platform internals. No customer-facing module may import this file --
 * `scripts/test-device-health.mjs` already fails the build if a customer
 * module mentions an SNMP config field, and `test-router-snmp.mjs` checks
 * this file's importers.
 *
 * WHAT IS TRUE PER VENDOR (the backend decides; this only renders it)
 * -------------------------------------------------------------------
 *  - MikroTik: supported. RouterOS has a standard SNMP agent, polled over the
 *    management tunnel every 5 minutes.
 *  - TP-Link Omada: not reachable. The APs have an agent, but no network path
 *    from the platform reaches them; health comes from the Omada controller.
 *  - Aruba Instant On: not supported. No SNMP on the device at all; health
 *    comes from the Instant On cloud.
 *
 * NEVER A NUMBER NOBODY MEASURED
 * ------------------------------
 * A router that was never polled shows "—", not "0" and not "OK". A failed
 * poll shows the failure and the time of the last *good* reading, which a
 * failure never moves.
 */

export type SnmpSupport = "supported" | "not_reachable" | "not_supported" | "unknown";
export type SnmpPollStatus = "ok" | "no_response" | "error" | "not_configured";

export interface RouterSnmpStatus {
  routerId: string;
  vendor: string;
  support: SnmpSupport;
  supportReason: string;
  metricsVia: string | null;
  enabled: boolean;
  version: "2c" | "3" | string;
  port: number;
  hasCommunity: boolean;
  usesPlatformDefaultCommunity: boolean;
  v3AuthProtocol: string | null;
  hasV3AuthPassword: boolean;
  v3PrivProtocol: string | null;
  hasV3PrivPassword: boolean;
  allowedSources: string[];
  pollIntervalSeconds: number;
  lastPollAt: string | null;
  lastPollStatus: SnmpPollStatus | null;
  lastPollDetail: string | null;
  lastSuccessAt: string | null;
  deviceAppliedAt: string | null;
}

export interface RouterSnmpTestResult {
  ok: boolean;
  status: SnmpPollStatus | string;
  detail: string | null;
  sysName: string | null;
  sysDescr: string | null;
  uptimeSeconds: number | null;
  targetHost: string | null;
  targetPort: number | null;
  version: string | null;
  testedAt: string;
}

export interface RouterSnmpDeviceState {
  agentEnabled: boolean;
  communityPresent: boolean;
  communityDisabled: boolean;
  communityAddresses: string | null;
  communitySecurity: string | null;
  communityReadOnly: boolean | null;
  defaultPublicOpen: boolean;
  otherCommunities: number;
}

export interface RouterSnmpApplyResult {
  action: "apply" | "remove" | string;
  verified: boolean;
  changed: string[];
  mismatches: string[];
  unverified: string[];
  state: RouterSnmpDeviceState | null;
  allowedSources: string[];
  appliedAt: string;
}

/** Only fields the operator actually changed are sent; secrets are sent only
 * when typed (an empty box means "keep the stored one"). */
export interface RouterSnmpConfigInput {
  enabled?: boolean;
  version?: "2c" | "3";
  community?: string;
  v3Username?: string;
  v3AuthProtocol?: "SHA1" | "MD5";
  v3AuthPassword?: string;
  v3PrivProtocol?: "AES" | "DES";
  v3PrivPassword?: string;
  v3ClearPrivacy?: boolean;
}

/* ── wire mapping ────────────────────────────────────────────── */

const SUPPORT: readonly SnmpSupport[] = ["supported", "not_reachable", "not_supported", "unknown"];
const POLL: readonly SnmpPollStatus[] = ["ok", "no_response", "error", "not_configured"];

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function toSnmpStatus(raw: Raw): RouterSnmpStatus {
  return {
    routerId: String(raw.router_id ?? ""),
    vendor: String(raw.vendor ?? ""),
    // An unrecognised value is "unknown", never "supported".
    support: SUPPORT.find((s) => s === raw.support) ?? "unknown",
    supportReason: str(raw.support_reason) ?? "",
    metricsVia: str(raw.metrics_via),
    enabled: raw.enabled === true,
    version: str(raw.version) ?? "2c",
    port: num(raw.port) ?? 161,
    hasCommunity: raw.has_community === true,
    usesPlatformDefaultCommunity: raw.uses_platform_default_community === true,
    v3AuthProtocol: str(raw.v3_auth_protocol),
    hasV3AuthPassword: raw.has_v3_auth_password === true,
    v3PrivProtocol: str(raw.v3_priv_protocol),
    hasV3PrivPassword: raw.has_v3_priv_password === true,
    allowedSources: Array.isArray(raw.allowed_sources) ? raw.allowed_sources.map(String) : [],
    pollIntervalSeconds: num(raw.poll_interval_seconds) ?? 300,
    lastPollAt: str(raw.last_poll_at),
    lastPollStatus: POLL.find((s) => s === raw.last_poll_status) ?? null,
    lastPollDetail: str(raw.last_poll_detail),
    lastSuccessAt: str(raw.last_success_at),
    deviceAppliedAt: str(raw.device_applied_at),
  };
}

export function toSnmpTestResult(raw: Raw): RouterSnmpTestResult {
  const identity = (raw.identity ?? null) as Raw | null;
  return {
    ok: raw.ok === true,
    status: str(raw.status) ?? "error",
    detail: str(raw.detail),
    sysName: identity ? str(identity.sys_name) : null,
    sysDescr: identity ? str(identity.sys_descr) : null,
    uptimeSeconds: identity ? num(identity.uptime_seconds) : null,
    targetHost: str(raw.target_host),
    targetPort: num(raw.target_port),
    version: str(raw.version),
    testedAt: str(raw.tested_at) ?? new Date().toISOString(),
  };
}

export function toSnmpDeviceState(raw: Raw | null | undefined): RouterSnmpDeviceState | null {
  if (!raw) return null;
  return {
    agentEnabled: raw.agent_enabled === true,
    communityPresent: raw.community_present === true,
    communityDisabled: raw.community_disabled === true,
    communityAddresses: str(raw.community_addresses),
    communitySecurity: str(raw.community_security),
    communityReadOnly:
      typeof raw.community_read_only === "boolean" ? raw.community_read_only : null,
    defaultPublicOpen: raw.default_public_open === true,
    otherCommunities: num(raw.other_communities) ?? 0,
  };
}

export function toSnmpApplyResult(raw: Raw): RouterSnmpApplyResult {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    action: str(raw.action) ?? "apply",
    verified: raw.verified === true,
    changed: list(raw.changed),
    mismatches: list(raw.mismatches),
    unverified: list(raw.unverified),
    state: toSnmpDeviceState(raw.state as Raw | null),
    allowedSources: list(raw.allowed_sources),
    appliedAt: str(raw.applied_at) ?? new Date().toISOString(),
  };
}

/** Request body: snake_case, only what was set, secrets only when typed. */
export function toSnmpConfigBody(input: RouterSnmpConfigInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.enabled !== undefined) body.enabled = input.enabled;
  if (input.version) body.version = input.version;
  const put = (key: string, value: string | undefined) => {
    const v = value?.trim();
    if (v) body[key] = v;
  };
  if (input.version !== "3") put("community", input.community);
  if (input.version !== "2c") {
    put("v3_username", input.v3Username);
    put("v3_auth_password", input.v3AuthPassword);
    put("v3_priv_password", input.v3PrivPassword);
    if (input.v3AuthProtocol) body.v3_auth_protocol = input.v3AuthProtocol;
    if (input.v3PrivProtocol) body.v3_priv_protocol = input.v3PrivProtocol;
    if (input.v3ClearPrivacy) body.v3_clear_privacy = true;
  }
  return body;
}

/* ── presentation ────────────────────────────────────────────── */

export type SnmpTone = "online" | "warning" | "offline" | "muted";

export interface SnmpHeadline {
  label: string;
  tone: SnmpTone;
}

/** The one-tag summary for the panel header. */
export function snmpHeadline(s: RouterSnmpStatus | null | undefined): SnmpHeadline {
  if (!s) return { label: "Not checked", tone: "muted" };
  if (s.support === "not_supported") return { label: "Not available", tone: "muted" };
  if (s.support === "not_reachable") return { label: "Not polled", tone: "muted" };
  if (s.support === "unknown") return { label: "Unknown", tone: "muted" };
  if (!s.enabled) return { label: "Off", tone: "muted" };
  switch (s.lastPollStatus) {
    case "ok":
      return { label: "Working", tone: "online" };
    case "no_response":
      return { label: "No response", tone: "offline" };
    case "error":
      return { label: "Error", tone: "offline" };
    case "not_configured":
      return { label: "Not configured", tone: "warning" };
    default:
      // Enabled but the sweep has not reached it yet. Not "working".
      return { label: "Waiting for first poll", tone: "warning" };
  }
}

export const POLL_STATUS_TEXT: Record<SnmpPollStatus, string> = {
  ok: "Answered",
  no_response: "No reply",
  error: "Agent returned an error",
  not_configured: "Not configured",
};

/** "—" when there is no value -- never a fabricated time or number. */
export function whenText(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

export function uptimeText(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Is the stored config complete enough to turn on? Mirrors the backend's
 * refusal so the button explains itself instead of failing with a 422. */
export function missingForEnable(s: RouterSnmpStatus, draft: RouterSnmpConfigInput): string | null {
  const version = draft.version ?? s.version;
  if (version === "3") {
    if (!s.hasCommunity && !draft.v3Username?.trim()) return "Enter an SNMPv3 user name.";
    if (!s.hasV3AuthPassword && !draft.v3AuthPassword?.trim())
      return "Enter an authentication passphrase (8+ characters).";
    return null;
  }
  if (!s.hasCommunity && !s.usesPlatformDefaultCommunity && !draft.community?.trim())
    return "Enter a community string.";
  return null;
}

/** Plain-language mismatch names from the apply read-back. */
export function mismatchText(code: string): string {
  const map: Record<string, string> = {
    "community:missing": "The monitoring community is not on the router.",
    "community:duplicate": "More than one monitoring community is on the router.",
    "community:disabled": "The monitoring community is disabled on the router.",
    "agent:enabled": "The SNMP agent is still off on the router.",
    "community:still-present": "The monitoring community is still on the router.",
  };
  if (map[code]) return map[code];
  if (code.startsWith("default-public:")) return "The factory 'public' community is still open.";
  if (code.startsWith("community:")) return `The router holds a different ${code.slice(10)}.`;
  return code;
}
