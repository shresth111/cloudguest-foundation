/**
 * Device Logs wording, in one pure module so a script can test it
 * (scripts/test-device-logs-presentation.mjs).
 *
 * The rule this file exists to keep: an unknown is never shown as a definite
 * answer. A router that was configured but has never sent a line is
 * "No message received yet", not "0 events"; a line without a syslog
 * priority has severity "Unknown", not "Info"; a line we could not tie to a
 * router says so instead of borrowing the name its tag claims.
 */
import type { Attribution, ReceivingState, RouterLoggingBlocker } from "@/types/deviceLogs";

export interface StatePresentation {
  label: string;
  /** MTag tone. */
  tone: "online" | "pending" | "offline" | "normal" | "warning";
  detail: string;
}

export const RECEIVING_STATE: Record<ReceivingState, StatePresentation> = {
  feature_off: {
    label: "Switched off",
    tone: "normal",
    detail:
      "Device logging is switched off on this platform (CLOUDGUEST_DEVICE_LOGS_ENABLED). Nothing is collected and no router is written.",
  },
  not_configured: {
    label: "Not set up",
    tone: "normal",
    detail: "Wyfy has not set up remote logging on this router, and nothing has arrived from it.",
  },
  awaiting_first_message: {
    label: "No message received yet",
    tone: "pending",
    detail:
      "Remote logging is set up, but no line has reached the platform. Unknown, not quiet: check the hub forwarding rule and the collector before assuming the router has nothing to say.",
  },
  receiving: {
    label: "Receiving",
    tone: "online",
    detail: "Lines from this router are arriving.",
  },
  silent: {
    label: "Silent",
    tone: "warning",
    detail:
      "This router used to send lines and has sent none in the last hour. It may be offline, or its tunnel or logging config changed.",
  },
};

const SEVERITY_LABELS = [
  "Emergency",
  "Alert",
  "Critical",
  "Error",
  "Warning",
  "Notice",
  "Info",
  "Debug",
];

export function severityLabel(severity: number | null): string {
  if (severity === null || severity < 0 || severity > 7) return "Unknown";
  return SEVERITY_LABELS[severity];
}

export function severityTone(severity: number | null): StatePresentation["tone"] {
  if (severity === null) return "normal";
  if (severity <= 3) return "offline";
  if (severity === 4) return "warning";
  return "normal";
}

/** Options for the "minimum severity" filter. "" keeps every line,
 * including those without a priority; any number hides those. */
export const SEVERITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All lines" },
  { value: "3", label: "Errors and worse" },
  { value: "4", label: "Warnings and worse" },
  { value: "6", label: "Info and worse (hides debug)" },
];

export function attributionNote(
  attribution: Attribution,
  claimedTag: string | null,
): string | null {
  if (attribution === "tunnel_ip") return null;
  if (attribution === "tag_mismatch") {
    return `Arrived from this router's tunnel address, but its tag names another router (wyfy-${claimedTag ?? "?"}). The hub may be rewriting source addresses.`;
  }
  return claimedTag
    ? `Not matched to any router's tunnel address. Its tag claims wyfy-${claimedTag}, which is not trusted on its own.`
    : "Not matched to any router's tunnel address.";
}

export const BLOCKER_LABEL: Record<RouterLoggingBlocker, string> = {
  NOT_MIKROTIK: "Not a MikroTik",
  NO_TUNNEL: "No WireGuard tunnel",
  NO_API_CREDENTIALS: "No API credentials",
};

/** "3 min ago" / "2 h ago" / "never". `now` injected for tests. */
export function formatAgo(iso: string | null, now: number): string {
  if (!iso) return "never";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "unknown";
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 0) return "just now";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Read-back verdict wording. `null` = never verified, which is different
 * from verified-and-wrong. */
export function verdictLabel(verifiedOk: boolean | null): {
  label: string;
  tone: StatePresentation["tone"];
} {
  if (verifiedOk === true) return { label: "Verified on the router", tone: "online" };
  if (verifiedOk === false) return { label: "Router does not match", tone: "offline" };
  return { label: "Not verified", tone: "normal" };
}
