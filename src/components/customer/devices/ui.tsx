/**
 * Small presentation helpers shared by the Devices page sections and the
 * Overview's hardware card. Console tokens only (`--wy-*`).
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  StatusDot,
  type OverviewStatus,
} from "@/components/customer/dashboard/overview/console-ui";
import type { FleetBucket, FleetKind } from "./fleet-model";

/** `t` bound to the `devices` namespace. */
export function useDevicesT() {
  return useTranslation("devices", { i18n }).t;
}

export const BUCKET_STATUS: Record<FleetBucket, OverviewStatus> = {
  ok: "ok",
  warn: "warn",
  crit: "crit",
  unknown: "unknown",
  unmeasured: "offline",
};

export const BUCKET_TEXT: Record<FleetBucket, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  unknown: "text-[var(--wy-text-muted)]",
  unmeasured: "text-[var(--wy-text-faint)]",
};

export function useBucketLabel() {
  const t = useDevicesT();
  return (b: FleetBucket) =>
    ({
      ok: t("bucket.ok", "Online"),
      warn: t("bucket.warn", "Degraded"),
      crit: t("bucket.crit", "Down"),
      unknown: t("bucket.unknown", "Unknown"),
      unmeasured: t("bucket.unmeasured", "Not measured"),
    })[b];
}

export function useKindLabel() {
  const t = useDevicesT();
  return (k: FleetKind) =>
    ({
      router: t("kind.router", "Routers"),
      ap: t("kind.ap", "Access points"),
      other: t("kind.other", "Other hardware"),
    })[k];
}

/**
 * The state dot for a bucket. An unmeasured row gets a dashed ring, not a
 * dot: a dot is a reading, and there is none. Both carry an accessible name.
 */
export function BucketDot({
  bucket,
  label,
  className,
}: {
  bucket: FleetBucket;
  label: string;
  className?: string;
}) {
  if (bucket === "unmeasured") {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          "inline-block h-2 w-2 shrink-0 rounded-full border border-dashed border-[var(--wy-text-faint)]",
          className,
        )}
      />
    );
  }
  return <StatusDot status={BUCKET_STATUS[bucket]} label={label} className={className} />;
}

/** A sortable column header button with `aria-sort` on its `<th>`. */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = "left",
}: {
  label: ReactNode;
  sortKey: K;
  sort: { key: K; dir: 1 | -1 };
  onSort: (k: K) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={cn(
        "h-8 whitespace-nowrap px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
          active && "text-[var(--wy-text-muted)]",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("h-3 w-3", !active && "opacity-40")} />
      </button>
    </th>
  );
}

/** A filter chip (toggle button). */
export function Chip({
  pressed,
  onClick,
  children,
  className,
  ...rest
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] motion-reduce:transition-none",
        pressed
          ? "border-[var(--wy-accent)] bg-[var(--wy-accent-soft)] text-[var(--wy-accent)]"
          : "border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text-muted)] hover:border-[var(--wy-border-strong)] hover:text-[var(--wy-text)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** "4m ago" style relative time, or an em dash. Locale-free on purpose: the
 * rest of the page's durations use the same compact form. */
export function relTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const MONO = "font-[family-name:var(--wy-font-mono)]";
