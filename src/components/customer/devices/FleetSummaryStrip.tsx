/**
 * The Devices page's at-a-glance strip: one block per kind of hardware
 * (routers, access points, other), each a total and a dot + count per
 * status. A count is a button: it filters the inventory below to that kind
 * and status. A count of 0 is shown for online/down/unknown (a 0 is an
 * answer) and hidden for degraded/not-measured unless something is in them.
 *
 * Data: the inventory rows the page already built -- nothing fetched here.
 */
import { Router, Wifi, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUCKET_ORDER,
  KIND_ORDER,
  countByKind,
  totalOf,
  type FleetBucket,
  type FleetKind,
  type InventoryFilter,
  type InventoryRow,
} from "./fleet-model";
import { BUCKET_TEXT, BucketDot, useBucketLabel, useDevicesT, useKindLabel } from "./ui";

const KIND_ICON: Record<FleetKind, typeof Router> = {
  router: Router,
  ap: Wifi,
  other: HardDrive,
};

const ALWAYS: Record<FleetBucket, boolean> = {
  ok: true,
  crit: true,
  unknown: true,
  warn: false,
  unmeasured: false,
};

export function FleetSummaryStrip({
  rows,
  filter,
  onFilter,
  routersUnread,
}: {
  rows: readonly InventoryRow[];
  filter: InventoryFilter;
  onFilter: (kind: FleetKind | "all", bucket: FleetBucket | "all") => void;
  /** The venue's router list could not be read: say so instead of "0". */
  routersUnread: boolean;
}) {
  const t = useDevicesT();
  const bucketLabel = useBucketLabel();
  const kindLabel = useKindLabel();
  const counts = countByKind(rows);

  return (
    <div
      role="group"
      aria-label={t("fleet.label", "Fleet status")}
      className="grid divide-y divide-[var(--wy-border)] rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] shadow-[var(--wy-shadow)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      data-wy="fleet-strip"
    >
      {KIND_ORDER.map((kind) => {
        const c = counts[kind];
        const total = totalOf(c);
        const Icon = KIND_ICON[kind];
        const kindActive = filter.kind === kind && filter.bucket === "all";
        const unread = kind === "router" && routersUnread && total === 0;
        return (
          <div key={kind} className="flex min-w-0 flex-col gap-2 px-4 py-3">
            <button
              type="button"
              aria-pressed={kindActive}
              onClick={() => onFilter(kindActive ? "all" : kind, "all")}
              className={cn(
                "-mx-1 flex items-center gap-2 rounded px-1 text-left text-xs font-medium text-[var(--wy-text-muted)] hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
                kindActive && "text-[var(--wy-accent)]",
              )}
            >
              <Icon aria-hidden className="h-3.5 w-3.5 text-[var(--wy-text-faint)]" />
              <span className="truncate">{kindLabel(kind)}</span>
              <span className="ml-auto text-xl font-semibold tabular-nums tracking-tight text-[var(--wy-text)]">
                {unread ? "—" : total}
              </span>
            </button>
            {unread ? (
              <p className="text-[11px] text-[var(--wy-text-faint)]">
                {t("fleet.routersUnread", "Couldn't read this venue's routers just now.")}
              </p>
            ) : total === 0 ? (
              <p className="text-[11px] text-[var(--wy-text-faint)]">
                {kind === "router"
                  ? t("fleet.noRouters", "No router at this venue yet.")
                  : t("fleet.noneRegistered", "None added yet.")}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1">
                {BUCKET_ORDER.filter((b) => ALWAYS[b] || c[b] > 0).map((b) => {
                  const active = filter.kind === kind && filter.bucket === b;
                  const word = bucketLabel(b);
                  return (
                    <li key={b}>
                      <button
                        type="button"
                        aria-pressed={active}
                        disabled={c[b] === 0}
                        aria-label={`${kindLabel(kind)}: ${c[b]} ${word}`}
                        onClick={() => onFilter(active ? "all" : kind, active ? "all" : b)}
                        className={cn(
                          "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] disabled:cursor-default motion-reduce:transition-none",
                          active
                            ? "border-[var(--wy-accent)] bg-[var(--wy-accent-soft)]"
                            : "border-transparent bg-[var(--wy-surface-2)] enabled:hover:border-[var(--wy-border-strong)]",
                          c[b] === 0 && "opacity-60",
                        )}
                      >
                        <BucketDot bucket={b} label={word} />
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            c[b] > 0 ? BUCKET_TEXT[b] : "text-[var(--wy-text-faint)]",
                          )}
                        >
                          {c[b]}
                        </span>
                        <span className="text-[var(--wy-text-muted)]">{word}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
