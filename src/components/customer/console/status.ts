import type { LivenessTone } from "@/lib/location-liveness";
import type { ConsoleStatus } from "./StatusDot";

/** Maps `livenessTone()` to a console status: neutral ("no router yet", "can't tell") is grey, never red. */
export function livenessToStatus(tone: LivenessTone): ConsoleStatus {
  switch (tone) {
    case "live":
      return "ok";
    case "warn":
      return "warn";
    case "down":
      return "crit";
    default:
      return "offline";
  }
}

/**
 * The console's default English word per state, for when a screen has no
 * more specific word of its own. One map, here; screens translate through
 * their own namespace and fall back to this.
 *
 * TODO(design-review issue 6): the review settles on Online / Degraded /
 * Down / Not checking in / Unknown. `ok` still reads "Up" because the
 * Dashboard topology copy and its tests use it; switch it with that copy.
 */
export const CONSOLE_STATUS_WORD = {
  ok: "Up",
  warn: "Degraded",
  crit: "Down",
  info: "Info",
  offline: "Offline",
  unknown: "Unknown",
} as const satisfies Record<ConsoleStatus | "unknown", string>;
