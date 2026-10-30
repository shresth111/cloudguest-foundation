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
