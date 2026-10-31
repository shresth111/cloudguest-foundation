import { cn } from "@/lib/utils";
import {
  formatWhen,
  healthFacts,
  healthTimeline,
  type DeviceHealth,
  type HealthState,
} from "@/lib/hardware-health";

/**
 * The evidence under a hardware row's status badge: port, latency, devices
 * on the port, traffic, link drops, and a 24h up/down strip. Renders nothing
 * for a row with no `health` (demo store, older backend, never probed), so
 * those rows look exactly as before.
 *
 * Also the duplicate-registration notice: the same MAC registered at several
 * locations can only ever be seen by the one whose router it is plugged into
 * (prod 2026-10-19: one AP registered at three venues, two of them "Never
 * observed" forever, with nothing saying why).
 */

const SEGMENT_TONE: Record<HealthState, string> = {
  up: "bg-[var(--wy-ok)]",
  degraded: "bg-[var(--wy-warn)]",
  down: "bg-[var(--wy-crit)]",
  unknown: "bg-[var(--wy-surface-2)]",
};

const STATE_WORD: Record<HealthState, string> = {
  up: "up",
  degraded: "unstable",
  down: "down",
  unknown: "not checked",
};

export function HardwareHealthDetails({
  health,
  duplicateLocations,
  registeredElsewhere,
  now = Date.now(),
  showFacts = true,
  wide = false,
}: {
  health?: DeviceHealth | null;
  duplicateLocations?: string[];
  registeredElsewhere?: boolean;
  now?: number;
  /** The one-line facts list; off where the caller lays them out itself. */
  showFacts?: boolean;
  /** Full-width 24 h strip with start/end labels (the Devices drawer). */
  wide?: boolean;
}) {
  const facts = health && showFacts ? healthFacts(health) : [];
  const segments = health ? healthTimeline(health, now) : [];
  const dupes = duplicateLocations ?? [];
  if (!health && dupes.length === 0 && !registeredElsewhere) return null;

  return (
    <div className="mt-1 space-y-1">
      {facts.length > 0 && (
        <div className="text-[11px] text-[var(--wy-text-muted)]">{facts.join(" · ")}</div>
      )}
      {segments.length > 0 && (
        <div
          className={cn(
            "flex overflow-hidden rounded-full bg-[var(--wy-surface-2)]",
            wide ? "h-2.5 w-full" : "h-1.5 w-40",
          )}
          role="img"
          aria-label={`Last 24 hours: ${segments
            .map((seg) => STATE_WORD[seg.state])
            .filter((w, i, a) => a.indexOf(w) === i)
            .join(", ")}`}
          data-testid="hardware-health-timeline"
        >
          {segments.map((seg, i) => {
            const startIso = new Date(now - (1 - seg.start) * 86_400_000).toISOString();
            return (
              <span
                key={i}
                title={`${STATE_WORD[seg.state]} from ${formatWhen(startIso, now)}`}
                className={cn("h-full", SEGMENT_TONE[seg.state])}
                style={{ width: `${(seg.end - seg.start) * 100}%` }}
              />
            );
          })}
        </div>
      )}
      {wide && segments.length > 0 && (
        <div className="flex justify-between text-[10px] text-[var(--wy-text-faint)]" aria-hidden>
          <span>24 h ago</span>
          <span>now</span>
        </div>
      )}
      {dupes.length > 0 && (
        <div className="text-[11px] text-[var(--wy-warn)]">
          Also added at {dupes.join(", ")}. Only the location whose router it is plugged into can
          show its status.
        </div>
      )}
      {registeredElsewhere && (
        <div className="text-[11px] text-[var(--wy-warn)]">
          This MAC is also registered at another venue, and this location's router has never seen
          it. Check the MAC, or that the device is plugged into this venue's router.
        </div>
      )}
    </div>
  );
}
