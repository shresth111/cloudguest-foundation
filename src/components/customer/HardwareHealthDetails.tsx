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
  up: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
  unknown: "bg-muted",
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
}: {
  health?: DeviceHealth | null;
  duplicateLocations?: string[];
  registeredElsewhere?: boolean;
  now?: number;
}) {
  const facts = health ? healthFacts(health) : [];
  const segments = health ? healthTimeline(health, now) : [];
  const dupes = duplicateLocations ?? [];
  if (!health && dupes.length === 0 && !registeredElsewhere) return null;

  return (
    <div className="mt-1 space-y-1">
      {facts.length > 0 && (
        <div className="text-[11px] text-muted-foreground">{facts.join(" · ")}</div>
      )}
      {segments.length > 0 && (
        <div
          className="flex h-1.5 w-40 overflow-hidden rounded-full bg-muted"
          aria-label="Last 24 hours"
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
      {dupes.length > 0 && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400">
          Also added at {dupes.join(", ")}. Only the location whose router it is plugged into can
          show its status.
        </div>
      )}
      {registeredElsewhere && (
        <div className="text-[11px] text-amber-700 dark:text-amber-400">
          This MAC is also registered at another venue, and this location's router has never seen
          it. Check the MAC, or that the device is plugged into this venue's router.
        </div>
      )}
    </div>
  );
}
