/**
 * Pure helpers for the JAZE-2 screens: the package policy form (string inputs
 * <-> `PackagePolicyBody`, with the backend's own bounds and cross-field rules
 * from `PolicyRequest` / `put_package_policy`), boost-window clock maths, and
 * display labels. No React, no requests: `scripts/test-isp-partner-jaze2.mjs`
 * pins them.
 */
import type {
  EnforcementEvent,
  FupReset,
  OpticalBand,
  PackagePolicy,
  PackagePolicyBody,
  ValidityStarts,
} from "@/services/isp-partner/network-types";

/** 0..1439 -> "HH:MM". */
export function minuteToClock(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isInteger(m) || m < 0 || m > 1439) return "";
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "HH:MM" (an `<input type="time">` value) -> 0..1439, or null. */
export function clockToMinute(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "23:00 → 07:00 (overnight)" style label for a boost window. */
export function boostWindowLabel(start: number | null, end: number | null): string {
  if (start === null || end === null) return "Off";
  const overnight = end < start;
  return `${minuteToClock(start)} → ${minuteToClock(end)}${overnight ? " (overnight)" : ""}`;
}

/** The form keeps every number as typed text; empty means "not set". */
export interface PolicyForm {
  fup_limit_mb: string;
  fup_reset: FupReset;
  fup_fallback_speed_group_id: string;
  fup_exclude_upload: boolean;
  fup_carry_forward: boolean;
  boost_speed_group_id: string;
  boost_start: string;
  boost_end: string;
  validity_starts: ValidityStarts;
  queue_priority: string;
  mac_bind_count: string;
  mac_restriction: boolean;
  ip_restriction: boolean;
  max_simultaneous: string;
  /** Minutes in the form; seconds on the wire. */
  idle_timeout_min: string;
  /** Hours in the form; seconds on the wire. */
  hard_timeout_h: string;
}

const numText = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function policyToForm(p: PackagePolicy | PackagePolicyBody | null | undefined): PolicyForm {
  return {
    fup_limit_mb: numText(p?.fup_limit_mb),
    fup_reset: (p?.fup_reset as FupReset) ?? "cycle",
    fup_fallback_speed_group_id: p?.fup_fallback_speed_group_id ?? "",
    fup_exclude_upload: !!p?.fup_exclude_upload,
    fup_carry_forward: !!p?.fup_carry_forward,
    boost_speed_group_id: p?.boost_speed_group_id ?? "",
    boost_start: minuteToClock(p?.boost_start_minute),
    boost_end: minuteToClock(p?.boost_end_minute),
    validity_starts: (p?.validity_starts as ValidityStarts) ?? "activation",
    queue_priority: numText(p?.queue_priority),
    mac_bind_count: numText(p?.mac_bind_count ?? 0),
    mac_restriction: !!p?.mac_restriction,
    ip_restriction: !!p?.ip_restriction,
    max_simultaneous: numText(p?.max_simultaneous),
    idle_timeout_min:
      p?.idle_timeout_s === null || p?.idle_timeout_s === undefined
        ? ""
        : String(Math.round(p.idle_timeout_s / 60)),
    hard_timeout_h:
      p?.hard_timeout_s === null || p?.hard_timeout_s === undefined
        ? ""
        : String(Math.round((p.hard_timeout_s / 3600) * 100) / 100),
  };
}

type IntResult = { ok: true; value: number | null } | { ok: false };

function optInt(text: string, min: number, max: number): IntResult {
  const t = text.trim();
  if (!t) return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  if (n < min || n > max) return { ok: false };
  return { ok: true, value: n };
}

export type PolicyResult =
  | { ok: true; body: PackagePolicyBody }
  | { ok: false; errors: Partial<Record<keyof PolicyForm, string>> };

/** Validate the form with the backend's bounds; on success, the PUT body. */
export function formToPolicyBody(f: PolicyForm): PolicyResult {
  const errors: Partial<Record<keyof PolicyForm, string>> = {};
  const fup = optInt(f.fup_limit_mb, 1, 1_000_000_000);
  if (!fup.ok) errors.fup_limit_mb = "Whole MB, at least 1, or empty for no FUP.";
  const fupMb = fup.ok ? fup.value : null;
  if (f.fup_fallback_speed_group_id && fup.ok && fupMb === null)
    errors.fup_fallback_speed_group_id = "A fallback speed needs an FUP limit.";

  const start = f.boost_start.trim() ? clockToMinute(f.boost_start) : null;
  const end = f.boost_end.trim() ? clockToMinute(f.boost_end) : null;
  if (f.boost_start.trim() && start === null) errors.boost_start = "A time, like 23:00.";
  if (f.boost_end.trim() && end === null) errors.boost_end = "A time, like 07:00.";
  const boostParts = [!!f.boost_speed_group_id, !!f.boost_start.trim(), !!f.boost_end.trim()];
  if (boostParts.some(Boolean) && !boostParts.every(Boolean))
    errors.boost_speed_group_id = "Night boost needs a speed group, a start and an end.";
  else if (start !== null && end !== null && start === end)
    errors.boost_end = "Start and end must differ.";

  const prio = optInt(f.queue_priority, 1, 8);
  if (!prio.ok) errors.queue_priority = "1 (highest) to 8, or empty.";
  const bind = optInt(f.mac_bind_count, 0, 16);
  if (!bind.ok) errors.mac_bind_count = "0 to 16.";
  const sim = optInt(f.max_simultaneous, 1, 64);
  if (!sim.ok) errors.max_simultaneous = "1 to 64, or empty for no limit.";
  const idle = optInt(f.idle_timeout_min, 1, 7 * 24 * 60);
  if (!idle.ok) errors.idle_timeout_min = "1 minute to 7 days (10080 min), or empty.";

  let hardS: number | null = null;
  const ht = f.hard_timeout_h.trim();
  if (ht) {
    const h = Number(ht);
    if (!/^\d+(\.\d{1,2})?$/.test(ht) || !Number.isFinite(h)) {
      errors.hard_timeout_h = "Hours, like 24 or 0.5.";
    } else {
      hardS = Math.round(h * 3600);
      if (hardS < 300 || hardS > 90 * 86400)
        errors.hard_timeout_h = "5 minutes (0.09 h) to 90 days (2160 h), or empty.";
    }
  }
  if (f.mac_restriction && bind.ok && (bind.value ?? 0) === 0)
    errors.mac_bind_count = "MAC restriction with 0 bound MACs would refuse every device.";

  if (Object.keys(errors).length) return { ok: false, errors };
  const idleS = idle.ok && idle.value !== null ? idle.value * 60 : null;
  return {
    ok: true,
    body: {
      fup_limit_mb: fupMb,
      fup_reset: f.fup_reset,
      fup_fallback_speed_group_id: f.fup_fallback_speed_group_id || null,
      fup_exclude_upload: f.fup_exclude_upload,
      fup_carry_forward: f.fup_carry_forward,
      boost_speed_group_id: f.boost_speed_group_id || null,
      boost_start_minute: start,
      boost_end_minute: end,
      validity_starts: f.validity_starts,
      queue_priority: prio.ok ? prio.value : null,
      mac_bind_count: bind.ok ? (bind.value ?? 0) : 0,
      mac_restriction: f.mac_restriction,
      ip_restriction: f.ip_restriction,
      max_simultaneous: sim.ok ? sim.value : null,
      idle_timeout_s: idleS,
      hard_timeout_s: hardS,
    },
  };
}

/** One-line summary of what a policy does, for the packages table. */
export function policySummary(p: PackagePolicy | null | undefined): string[] {
  if (!p || !p.configured) return [];
  const out: string[] = [];
  if (p.fup_limit_mb)
    out.push(
      `FUP ${formatMb(p.fup_limit_mb)}/${p.fup_reset}${
        p.fup_fallback_speed_group_name ? ` → ${p.fup_fallback_speed_group_name}` : ""
      }`,
    );
  if (p.boost_speed_group_id)
    out.push(`Boost ${boostWindowLabel(p.boost_start_minute, p.boost_end_minute)}`);
  if (p.mac_bind_count) out.push(`MAC ×${p.mac_bind_count}${p.mac_restriction ? " locked" : ""}`);
  if (p.max_simultaneous) out.push(`${p.max_simultaneous} at once`);
  if (p.validity_starts === "first_login") out.push("Starts at first login");
  return out;
}

/** 1024 -> "1 GB", 1536 -> "1.5 GB", 500 -> "500 MB". */
export function formatMb(mb: number): string {
  if (mb >= 1024 * 1024) return `${trim(mb / (1024 * 1024))} TB`;
  if (mb >= 1024) return `${trim(mb / 1024)} GB`;
  return `${mb} MB`;
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Share of the allowance used, 0..100, or null when there is no FUP. */
export function fupUsedPercent(
  used: number,
  allowance: number | null,
  carry = 0,
  topup = 0,
): number | null {
  if (!allowance) return null;
  const total = allowance + carry + topup;
  if (total <= 0) return null;
  return Math.min(100, Math.round((used / total) * 1000) / 10);
}

/** bits/s -> "12.3 Mbps". */
export function formatBps(bps: number | null | undefined): string {
  if (bps === null || bps === undefined || !Number.isFinite(bps)) return "–";
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} Kbps`;
  return `${Math.round(bps)} bps`;
}

/** MTag tone for an optical RX band (status colours: label always shown). */
export function opticalTone(band: OpticalBand | null): string {
  if (band === "good") return "online";
  if (band === "warn") return "pending";
  if (band === "bad") return "offline";
  return "normal";
}

export const OPTICAL_BAND_LABEL: Record<OpticalBand, string> = {
  good: "Good",
  warn: "Marginal",
  bad: "Out of range",
};

export const ROUTER_UNREACHABLE_LABEL: Record<string, string> = {
  not_mikrotik: "Live health is available for MikroTik routers only.",
  not_set_up: "This router has no management login yet. Run the setup script, then read again.",
  unreachable: "The router did not answer. Check that it is powered and its cloud link is up.",
};

export const ENFORCEMENT_EVENT_LABEL: Record<string, string> = {
  fup_throttle: "FUP limit reached: slowed to the fallback speed",
  fup_restore: "FUP speed restored",
  fup_topup: "Data top-up added",
  fup_reset: "FUP counter reset",
  boost_on: "Night boost started",
  boost_off: "Night boost ended",
  mac_bound: "Device MAC bound",
  mac_reject: "Session ended: device MAC not bound",
  ip_reject: "Session ended: IP not allowed",
  concurrency: "Session ended: too many devices at once",
  idle_timeout: "Session ended: idle timeout",
  hard_timeout: "Session ended: session time limit",
  validity_start: "Validity started at first login",
  reauth: "Session ended so the new speed applies",
};

export function enforcementEventLabel(e: Pick<EnforcementEvent, "kind">): string {
  return ENFORCEMENT_EVENT_LABEL[e.kind] ?? e.kind.replace(/_/g, " ");
}

/** A short "key: value" line from an event's detail, skipping nested values. */
export function enforcementEventDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
    .join(" · ");
}

/** "aa-bb-cc-dd-ee-ff" / "aabb.ccdd.eeff" -> "AA:BB:CC:DD:EE:FF", or null. */
export function normaliseMac(v: string): string | null {
  const hex = v.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12) return null;
  if (v.replace(/[0-9a-fA-F:.\-\s]/g, "").length) return null;
  return hex.match(/.{2}/g)!.join(":");
}
