import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hardwareLivenessIsMeasured, isRouterUnreadable } from "@/lib/device-liveness";
import { useFormat } from "@/lib/useFormat";
import { customerFeatureHref } from "@/lib/customerNav";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import type { MonitoredDeviceRow } from "@/services/deviceHardware.service";
import { Panel } from "@/components/customer/console";
import { PanelLink, PanelTitle } from "./overview/console-ui";
import { DEVICE_TYPE_META } from "@/lib/device-presentation";
import { BackgroundBoxes } from "@/components/aceternity/background-boxes";
import {
  BUCKET_ORDER,
  BUCKET_TO_PARAM,
  countBuckets,
  hardwareRow,
  topAttention,
  type FleetBucket,
} from "@/components/customer/devices/fleet-model";
import { BucketDot } from "@/components/customer/devices/ui";
import {
  BUCKET_TEXT,
  useBucketLabel,
  useDevicesT,
  useRowWords,
} from "@/components/customer/devices/ui-shared";

/**
 * The Overview's "Network Hardware" card: a compact summary of the Devices
 * page. A status strip (each count opens Devices pre-filtered to that status
 * via `?status=`), the few devices that most need attention -- faults first,
 * each with its reason in plain words -- and a one-line verdict.
 *
 * Data: exactly the `useMonitoredHardware` rows the dashboard already holds
 * (it reads them once for the topology map and this card). Status words and
 * buckets come from `describeLiveness` via `@/components/customer/devices/
 * fleet-model`, the same mapping the Devices page uses, so the two screens
 * cannot disagree.
 */

/** How many devices the card names before handing off to the Devices page. */
const MAX_LISTED_DEVICES = 5;

/** Always shown, even at 0 (a 0 is an answer); the other two only when
 * something is in them. */
const ALWAYS: Record<FleetBucket, boolean> = {
  ok: true,
  warn: true,
  crit: true,
  unknown: true,
  unmeasured: false,
};

export function DeviceStatusCard({
  locationId,
  onManage,
}: {
  locationId: string;
  onManage: () => void;
}) {
  const { devices } = useMonitoredHardware(locationId);
  return <DeviceStatusCardView devices={devices} onManage={onManage} />;
}

/** The card for a caller that already holds the rows -- the dashboard reads
 * them once for the topology map and this card. `useMonitoredHardware` is
 * plain state, so a second call would be a second `/monitored-hardware`. */
export function DeviceStatusCardView({
  devices,
  onManage,
}: {
  devices: MonitoredDeviceRow[];
  onManage: () => void;
}) {
  const t = useDevicesT();
  const words = useRowWords();
  const fmt = useFormat();
  const bucketLabel = useBucketLabel();
  const navigate = useNavigate();
  const openFiltered = (b: FleetBucket) =>
    navigate({
      to: customerFeatureHref("devices"),
      // The Devices page reads `?status=` once on mount (bucketFromSearch).
      search: { status: BUCKET_TO_PARAM[b] } as never,
    });

  const rows = useMemo(() => devices.map((d) => hardwareRow(d)), [devices]);
  const counts = countBuckets(rows);
  const listed = topAttention(rows, MAX_LISTED_DEVICES);

  // A device behind a router this platform cannot read is counted apart
  // from both "down" and "not yet observed": its status is a fact about the
  // router, and folding it into either bucket tells the owner something
  // false about working hardware.
  const unreadable = (d: (typeof devices)[number]) =>
    d.status !== "up" && isRouterUnreadable(d.observationIssue);
  const unreachableCount = devices.filter(unreadable).length;
  const downCount = devices.filter((d) => d.status === "down" && !unreadable(d)).length;
  // Split out of `unknownCount` deliberately. At a venue whose network is run
  // by a vendor controller nothing on this platform probes these MACs at all,
  // so every row is `unknown` forever -- and "not yet observed" promises a
  // "yet" that will never come, while falling through to "All devices up"
  // would be flatly false. Both of those are what this tile said before.
  const unmeasuredCount = devices.filter((d) => !hardwareLivenessIsMeasured(d)).length;
  const unknownCount = devices.filter(
    (d) => d.status === "unknown" && hardwareLivenessIsMeasured(d) && !unreadable(d),
  ).length;
  // "All up" only when every one of them IS up -- never "none is down", which
  // once read "all up" for a single never-observed access point. Counted off
  // the same buckets as the strip above it, so a device the strip calls
  // Degraded (answering, but its link keeps dropping) is never "up" here.
  const upCount = counts.ok;
  const degradedCount = Math.max(0, counts.warn - unreachableCount);

  return (
    <Panel
      className="flex h-full flex-col"
      bodyClassName="flex flex-1 flex-col"
      title={<PanelTitle icon={<HardDrive />}>{t("card.title", "Network Hardware")}</PanelTitle>}
      actions={<PanelLink onClick={onManage}>{t("card.viewAll", "View all →")}</PanelLink>}
    >
      <div className="flex flex-1 flex-col" data-wy="device-card">
        {devices.length === 0 ? (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border-strong)] px-4 py-6 text-center">
            {/* The one Aceternity moment this surface gets (design v3 Part
             * 4): a low-frequency, first-run empty state. See
             * background-boxes.tsx's own comment. */}
            <BackgroundBoxes />
            <div className="relative flex flex-col items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)]">
                <HardDrive aria-hidden className="h-4 w-4 text-[var(--wy-text-faint)]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">
                  {t("card.emptyTitle", "No hardware set up yet")}
                </p>
                {/* This card tracks the hardware you add yourself (APs,
                 * printers...). Your router is monitored automatically and
                 * is counted above -- said explicitly, because a bare "no
                 * hardware" under a "routers online" KPI read as a
                 * contradiction in a product review. */}
                <p className="mt-1 text-xs text-[var(--wy-text-muted)]">
                  {t(
                    "card.emptyBody",
                    "Add a device by MAC address to start monitoring it. Your router is already tracked separately above.",
                  )}
                </p>
              </div>
              <Button size="sm" variant="outline" className="mt-1 text-xs" onClick={onManage}>
                {t("card.setUp", "Set up hardware")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            {/* Status strip. Each count opens Devices filtered to it. */}
            <ul
              className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              aria-label={t("card.stripLabel", "Hardware by status")}
            >
              {BUCKET_ORDER.filter((b) => ALWAYS[b] || counts[b] > 0).map((b) => (
                <li key={b}>
                  <button
                    type="button"
                    disabled={counts[b] === 0}
                    onClick={() => openFiltered(b)}
                    aria-label={t("card.stripItem", "{{count}} {{status}} — show on Devices", {
                      count: counts[b],
                      status: bucketLabel(b),
                    })}
                    className="flex w-full items-center gap-2 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-2.5 py-1.5 text-left transition-colors duration-150 enabled:hover:border-[var(--wy-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] disabled:cursor-default motion-reduce:transition-none"
                  >
                    <BucketDot bucket={b} label={bucketLabel(b)} />
                    <span
                      className={cn(
                        "text-base font-semibold tabular-nums",
                        counts[b] > 0 ? BUCKET_TEXT[b] : "text-[var(--wy-text-faint)]",
                      )}
                    >
                      {counts[b]}
                    </span>
                    <span className="truncate text-[11px] text-[var(--wy-text-muted)]">
                      {bucketLabel(b)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* The devices that most need a look, faults first, each with
             * its reason. Same words as the Devices table (describeLiveness). */}
            <ul
              className="flex-1 divide-y divide-[var(--wy-border)]"
              aria-label={t("card.listLabel", "Devices, problems first")}
            >
              {listed.map((r) => {
                const Icon = DEVICE_TYPE_META[r.hardware!.type]?.icon ?? HardDrive;
                return (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => (r.bucket === "ok" ? onManage() : openFiltered(r.bucket))}
                      className="group flex w-full items-start gap-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                    >
                      <BucketDot
                        bucket={r.bucket}
                        label={bucketLabel(r.bucket)}
                        className="mt-1.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <Icon
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0 text-[var(--wy-text-faint)]"
                          />
                          <span className="truncate text-[13px] font-medium">{r.name}</span>
                          {r.floor && (
                            <span className="shrink-0 text-[11px] text-[var(--wy-text-faint)]">
                              · {r.floor}
                            </span>
                          )}
                        </span>
                        {(r.detail || r.explanation) && (
                          <span
                            className="mt-0.5 block truncate text-[11px] text-[var(--wy-text-faint)]"
                            title={[r.detail, r.explanation].filter(Boolean).join(" — ")}
                          >
                            {r.detail ?? r.explanation}
                          </span>
                        )}
                      </span>
                      <span className={cn("shrink-0 text-xs font-medium", BUCKET_TEXT[r.bucket])}>
                        {words.status(r.statusWord)}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--wy-text-faint)] opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--wy-border)] pt-2.5 text-xs">
              <span className="text-[var(--wy-text-muted)]">
                {devices.length > MAX_LISTED_DEVICES ? (
                  <button
                    type="button"
                    onClick={onManage}
                    className="rounded font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                  >
                    {t("card.more", "+{{count}} more on Devices", {
                      count: devices.length - MAX_LISTED_DEVICES,
                    })}
                  </button>
                ) : (
                  t("card.total", "{{count}} devices total", { count: devices.length })
                )}
              </span>
              {downCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-[var(--wy-crit)]">
                  {/* For a device that is DOWN, time since we last heard from
                   * it IS how long it has been down, so this duration is
                   * honestly named -- unlike the same arithmetic beside the
                   * word "Up", which is the bug @/lib/device-liveness exists
                   * to prevent. */}
                  {t("card.downCount", "{{count}} down", { count: downCount })}
                  {(() => {
                    // `last_seen_at` is nullable: "N down" alone is still true.
                    const oldest = devices
                      .filter(
                        (d): d is typeof d & { lastSeenAt: string } =>
                          d.status === "down" && d.lastSeenAt != null,
                      )
                      .sort(
                        (a, b) =>
                          new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime(),
                      )[0];
                    return oldest
                      ? t("card.longest", " · longest {{d}}", {
                          d: fmt.duration(Date.now() - new Date(oldest.lastSeenAt).getTime()),
                        })
                      : "";
                  })()}
                </span>
              ) : unreachableCount > 0 ? (
                // The router could not be read, so these devices are not
                // known to be missing or down -- say what actually failed.
                <span className="font-medium text-[var(--wy-warn)]">
                  {t("card.unreachable", "Can't reach router · {{count}} unconfirmed", {
                    count: unreachableCount,
                  })}
                </span>
              ) : degradedCount > 0 ? (
                <span className="font-medium text-[var(--wy-warn)]">
                  {t("card.degradedCount", "{{count}} degraded", { count: degradedCount })}
                </span>
              ) : unknownCount > 0 ? (
                // Never conflated with "up": a device just registered (or whose
                // router hasn't synced yet) hasn't been confirmed reachable.
                <span className="font-medium text-[var(--wy-text-muted)]">
                  {t("card.notObserved", "{{count}} not checked yet", { count: unknownCount })}
                </span>
              ) : unmeasuredCount > 0 ? (
                <span
                  title={t(
                    "card.unmeasuredHint",
                    "This venue's network is run by a controller, so nothing here pings these devices. Your controller reports its own access points on the Devices page.",
                  )}
                  className="font-medium text-[var(--wy-text-muted)]"
                >
                  {t("card.unmeasured", "{{count}} not measured here", { count: unmeasuredCount })}
                </span>
              ) : upCount === devices.length ? (
                <span className="font-medium text-[var(--wy-ok)]">
                  {t("card.allUp", "All devices up")}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
