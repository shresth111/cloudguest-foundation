/**
 * Small presentation helpers shared by the Devices page sections and the
 * Overview's hardware card. Console tokens only (`--wy-*`).
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import i18n from "@/lib/i18n";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  StatusDot,
  type OverviewStatus,
} from "@/components/customer/dashboard/overview/console-ui";
import type { FleetBucket, FleetKind } from "./fleet-model";
import { BUCKET_STATUS } from "./ui-shared";

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

/** A filter chip (toggle button). Lives in the shared console primitives now. */
export { FilterChip as Chip } from "@/components/customer/console";

export const MONO = "font-[family-name:var(--wy-font-mono)]";
