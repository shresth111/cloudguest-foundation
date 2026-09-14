import { HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DEVICE_TYPES } from "@/stores/deviceStore";
import { formatAge } from "@/lib/device-liveness";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import { DEVICE_TYPE_META } from "@/lib/device-presentation";
import { BackgroundBoxes } from "@/components/aceternity/background-boxes";

/**
 * Per-device-type hardware summary for this location's monitored network
 * hardware (Access Points, Printers, Routers, Cameras, Other) -- the same
 * `useDeviceStore` records and `d.locationId === locationId` filter the
 * Devices page's own `NetworkHardwareView` (BasicFeatureViews.tsx) already
 * uses, and the exact same `DEVICE_TYPE_META` icon/color map, imported from
 * there rather than re-declared here, so a "Router" reads as the same
 * indigo-violet `Router` icon everywhere in the app, not a second
 * lookalike-but-different palette. Up/down counts are real, derived from
 * each device's own `deriveStatus`-computed `status`, not decorative.
 * Sibling to WanStatusCard immediately above it in the layout -- same card
 * shell, header badge, and "Manage ->" pattern, just pointed at the
 * Devices feature page instead of Internet Connection.
 */
export function DeviceStatusCard({
  locationId,
  onManage,
}: {
  locationId: string;
  onManage: () => void;
}) {
  const { devices } = useMonitoredHardware(locationId);
  const downCount = devices.filter((d) => d.status === "down").length;
  const unknownCount = devices.filter((d) => d.status === "unknown").length;

  return (
    <Card className="premium-card premium-card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <HardDrive className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Network Hardware</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={onManage}>
          Manage →
        </Button>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-lg border border-dashed border-border bg-card/40 px-4 py-6 text-center">
            {/* The one Aceternity moment this surface gets (design v3 Part
             * 4): a low-frequency, first-run "connect your first
             * router"-adjacent empty state, and nowhere else on this page.
             * See background-boxes.tsx's own comment for why it's a small
             * static re-author, not the registry component verbatim. */}
            <BackgroundBoxes />
            {/* Everything a user actually reads/clicks stays in its own
             * `relative` stacking layer, painted after (so: above) the
             * absolutely-positioned decorative grid regardless of DOM
             * order inside it -- otherwise the plain-flow Button below
             * would paint *under* an `absolute` sibling per normal CSS
             * stacking rules. */}
            <div className="relative flex flex-col items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No hardware set up yet</p>
                {/* Sitting right below the "routers online" KPI at the top of
                 * this same dashboard, an unqualified "no hardware" read as
                 * contradicting it (bug report from a product review: "wait,
                 * don't I have a router?"). This card only tracks *other*
                 * hardware you add yourself (APs, printers, etc.) -- your
                 * router is already monitored automatically and isn't meant
                 * to show up here, so that needs to be said explicitly. */}
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a device by MAC address to start monitoring it. Your router is already tracked
                  separately above.
                </p>
              </div>
              <Button size="sm" variant="outline" className="mt-1 text-xs" onClick={onManage}>
                Set up hardware
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {DEVICE_TYPES.map((type) => {
                const typeDevices = devices.filter((d) => d.type === type);
                if (typeDevices.length === 0) return null;
                const meta = DEVICE_TYPE_META[type];
                const Icon = meta.icon;
                const typeDown = typeDevices.filter((d) => d.status === "down").length;
                return (
                  <div key={type} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span
                        title={type}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white",
                          meta.gradient,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {type}
                        {typeDevices.length !== 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{typeDevices.length}</span>
                      {typeDown > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400"> · {typeDown} down</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400"> · all up</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
              <span className="text-muted-foreground">
                {devices.length} device{devices.length !== 1 ? "s" : ""} total
              </span>
              {downCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {/* For a device that is DOWN, time since we last heard from
                   * it IS how long it has been down, so this duration is
                   * honestly named -- unlike the same arithmetic beside the
                   * word "Up", which is the bug @/lib/device-liveness exists
                   * to prevent. */}
                  {downCount} down
                  {(() => {
                    // `ConnectedDevice.last_seen_at` is nullable, so a device
                    // can be DOWN with no timestamp at all -- in which case
                    // this filter empties and indexing [0] threw, taking the
                    // whole card down. "N down" on its own is still true; a
                    // crash is not a better answer than a missing clause.
                    const oldest = devices
                      .filter(
                        (d): d is typeof d & { lastSeenAt: string } =>
                          d.status === "down" && d.lastSeenAt != null,
                      )
                      .sort(
                        (a, b) =>
                          new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime(),
                      )[0];
                    return oldest ? ` · longest ${formatAge(oldest.lastSeenAt, Date.now())}` : "";
                  })()}
                </span>
              ) : unknownCount > 0 ? (
                // Never conflated with "up" -- a device just registered (or
                // whose router hasn't synced yet) hasn't actually been
                // confirmed reachable, see useMonitoredHardware's own
                // honesty note on "unknown" status.
                <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  {unknownCount} not yet observed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  All devices up
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
