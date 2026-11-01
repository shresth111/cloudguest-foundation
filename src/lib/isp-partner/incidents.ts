/** INCIDENTS-1 pure helpers: labels, tones, the next allowed step. */
import type {
  IncidentScopeKind,
  IncidentSeverity,
  IncidentStatus,
  RfoReason,
} from "@/services/isp-partner/incidents-types";

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  identified: "Cause identified",
  resolved: "Resolved",
};

/** MTag tone keys that exist in the kit. */
export function statusTone(s: IncidentStatus): string {
  return s === "resolved" ? "resolved" : s === "identified" ? "warning" : "overdue";
}

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
};

export function severityTone(s: IncidentSeverity): string {
  return s === "critical" ? "urgent" : s === "major" ? "high" : "normal";
}

export const SCOPE_LABEL: Record<IncidentScopeKind, string> = {
  router: "Router",
  fiber_node: "Fiber node",
  zone: "Zone",
};

export const RFO_REASONS: RfoReason[] = [
  "fiber_cut",
  "power_olt",
  "cpe_fault",
  "upstream",
  "other",
];

export const RFO_LABEL: Record<RfoReason, string> = {
  fiber_cut: "Fiber cut",
  power_olt: "Power / OLT",
  cpe_fault: "Customer device fault",
  upstream: "Upstream provider",
  other: "Other",
};

/** Status only moves forward; identified may be skipped. */
export function nextStatuses(s: IncidentStatus): ("identified" | "resolved")[] {
  if (s === "investigating") return ["identified", "resolved"];
  if (s === "identified") return ["resolved"];
  return [];
}

/** "2 h 05 min", "45 min", "3 d 4 h". */
export function formatMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "–";
  const mins = Math.max(0, Math.floor(m));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ${String(mins % 60).padStart(2, "0")} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/** Health tone for the headline: >= 99 good, >= 95 watch, else bad. */
export function healthTone(pct: number | null): "success" | "warning" | "danger" | "default" {
  if (pct === null) return "default";
  if (pct >= 99) return "success";
  if (pct >= 95) return "warning";
  return "danger";
}

export const EVENT_LABEL: Record<string, string> = {
  created: "Opened",
  status: "Status",
  note: "Note",
  affected_refreshed: "Affected list refreshed",
  broadcast: "Message sent",
  grace: "Grace granted",
};

export function graceHoursError(h: number): string | null {
  return Number.isInteger(h) && h >= 1 && h <= 168 ? null : "1 to 168 hours.";
}
