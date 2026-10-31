/**
 * The hardware inventory: every router and registered device at this venue
 * in one dense, sortable, filterable table (a stacked list under `md`).
 * A row opens the detail drawer. Filters: free-text search (name, type,
 * floor, status words, MAC with or without separators), kind, status and
 * floor; the fleet strip above drives kind + status too.
 *
 * Data: the rows the parent built from reads it already holds. Nothing is
 * fetched here.
 */
import { Fragment, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronRight, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/device-liveness";
import { sortFloors } from "@/lib/device-floors";
import { DEVICE_TYPE_META } from "@/lib/device-presentation";
import { SegmentedControl } from "@/components/customer/console";
import type { DeviceType } from "@/stores/deviceStore";
import {
  BUCKET_ORDER,
  KIND_ORDER,
  NO_FILTER,
  filterInventory,
  sortInventory,
  type InventoryFilter,
  type InventoryRow,
  type InventorySort,
  type InventorySortKey,
} from "./fleet-model";
import {
  BUCKET_TEXT,
  BucketDot,
  Chip,
  MONO,
  SortHeader,
  relTime,
  useBucketLabel,
  useDevicesT,
  useKindLabel,
} from "./ui";

function TypeIcon({ row, className }: { row: InventoryRow; className?: string }) {
  const meta =
    DEVICE_TYPE_META[(row.hardware?.type ?? "Router") as DeviceType] ?? DEVICE_TYPE_META.Other;
  const Icon = meta.icon;
  return (
    <Icon
      aria-hidden
      className={cn("h-3.5 w-3.5 shrink-0 text-[var(--wy-text-faint)]", className)}
    />
  );
}

export function HardwareInventory({
  rows,
  filter,
  onFilter,
  onOpen,
  now = Date.now(),
}: {
  rows: readonly InventoryRow[];
  filter: InventoryFilter;
  onFilter: (f: InventoryFilter) => void;
  onOpen: (row: InventoryRow) => void;
  now?: number;
}) {
  const t = useDevicesT();
  const bucketLabel = useBucketLabel();
  const kindLabel = useKindLabel();
  const [sort, setSort] = useState<InventorySort>({ key: "status", dir: 1 });
  const [view, setView] = useState<"list" | "floor">("list");

  const floors = useMemo(
    () =>
      sortFloors(
        new Set(rows.filter((r) => r.source === "hardware" && r.floor).map((r) => r.floor)),
      ),
    [rows],
  );
  const hasUnplacedHardware = rows.some((r) => r.source === "hardware" && !r.floor);
  const kindsPresent = KIND_ORDER.filter((k) => rows.some((r) => r.kind === k));
  const bucketsPresent = BUCKET_ORDER.filter((b) => rows.some((r) => r.bucket === b));

  const shown = useMemo(
    () => sortInventory(filterInventory(rows, filter), sort),
    [rows, filter, sort],
  );
  const grouped = view === "floor" && floors.length > 0;
  const groups = useMemo(() => {
    if (!grouped) return [{ key: "all", label: null as string | null, rows: shown }];
    const out = floors
      .map((f) => ({ key: `f:${f}`, label: f, rows: shown.filter((r) => r.floor === f) }))
      .filter((g) => g.rows.length > 0);
    const rest = shown.filter((r) => !r.floor);
    if (rest.length) out.push({ key: "f:none", label: "", rows: rest });
    return out;
  }, [grouped, floors, shown]);

  const onSort = (key: InventorySortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const filtered = filter !== NO_FILTER && JSON.stringify(filter) !== JSON.stringify(NO_FILTER);
  const set = (patch: Partial<InventoryFilter>) => onFilter({ ...filter, ...patch });
  const rowKey = (e: KeyboardEvent, r: InventoryRow) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(r);
    }
  };
  const groupLabel = (label: string | null) =>
    label === "" ? t("inventory.noFloor", "No floor / venue routers") : label;

  return (
    <div className="min-w-0" data-wy="hw-inventory">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-[var(--wy-border)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">{t("inventory.search", "Search hardware")}</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--wy-text-faint)]"
            />
            <input
              type="search"
              value={filter.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder={t("inventory.searchPlaceholder", "Search name, floor, MAC…")}
              className="h-8 w-full rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] pl-8 pr-2 text-[13px] text-[var(--wy-text)] placeholder:text-[var(--wy-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
            />
          </label>
          {floors.length > 0 && (
            <SegmentedControl
              ariaLabel={t("inventory.viewLabel", "Layout")}
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: t("inventory.viewList", "List") },
                { value: "floor", label: t("inventory.viewFloor", "By floor") },
              ]}
            />
          )}
        </div>
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {kindsPresent.length > 1 &&
            kindsPresent.map((k) => (
              <Chip
                key={k}
                pressed={filter.kind === k}
                onClick={() => set({ kind: filter.kind === k ? "all" : k })}
              >
                {kindLabel(k)}
              </Chip>
            ))}
          {kindsPresent.length > 1 && (
            <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-[var(--wy-border)]" />
          )}
          {bucketsPresent.map((b) => (
            <Chip
              key={b}
              pressed={filter.bucket === b}
              onClick={() => set({ bucket: filter.bucket === b ? "all" : b })}
            >
              <BucketDot bucket={b} label={bucketLabel(b)} />
              {bucketLabel(b)}
            </Chip>
          ))}
          {floors.length > 0 && (
            <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-[var(--wy-border)]" />
          )}
          {floors.map((f) => (
            <Chip
              key={f}
              pressed={filter.floor === f}
              onClick={() => set({ floor: filter.floor === f ? "all" : f })}
              aria-label={t("inventory.floorChip", "Floor {{floor}}", { floor: f })}
            >
              <MapPin aria-hidden className="h-3 w-3" />
              {f}
            </Chip>
          ))}
          {floors.length > 0 && hasUnplacedHardware && (
            <Chip
              pressed={filter.floor === ""}
              onClick={() => set({ floor: filter.floor === "" ? "all" : "" })}
            >
              {t("inventory.noFloorChip", "No floor")}
            </Chip>
          )}
          {filtered && (
            <button
              type="button"
              onClick={() => onFilter(NO_FILTER)}
              className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded px-2 text-xs font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
            >
              <X aria-hidden className="h-3 w-3" />
              {t("inventory.clear", "Clear filters")}
            </button>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {t("inventory.count", "{{shown}} of {{total}} devices shown", {
          shown: shown.length,
          total: rows.length,
        })}
      </p>

      {shown.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-[var(--wy-text-muted)]">
          {t("inventory.noMatch", "Nothing matches these filters.")}{" "}
          <button
            type="button"
            onClick={() => onFilter(NO_FILTER)}
            className="font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
          >
            {t("inventory.clear", "Clear filters")}
          </button>
        </div>
      ) : (
        <>
          {/* md+: dense table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">
                {t("inventory.caption", "Network hardware at this venue")}
              </caption>
              <thead className="bg-[var(--wy-surface-2)]">
                <tr className="border-b border-[var(--wy-border)]">
                  <SortHeader
                    label={t("col.status", "Status")}
                    sortKey="status"
                    sort={sort}
                    onSort={onSort}
                    className="pl-4"
                  />
                  <SortHeader
                    label={t("col.name", "Name")}
                    sortKey="name"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t("col.type", "Type")}
                    sortKey="type"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t("col.floor", "Floor")}
                    sortKey="floor"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t("col.mac", "MAC")}
                    sortKey="mac"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t("col.lastSeen", "Last seen")}
                    sortKey="lastSeen"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t("col.uptime", "Uptime")}
                    sortKey="uptime"
                    sort={sort}
                    onSort={onSort}
                    align="right"
                  />
                  <th scope="col" className="w-8 pr-3">
                    <span className="sr-only">{t("col.open", "Details")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {g.label != null && (
                      <tr className="border-b border-[var(--wy-border)] bg-[var(--wy-bg)]">
                        <th
                          scope="colgroup"
                          colSpan={8}
                          className="px-4 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {g.label !== "" && <MapPin aria-hidden className="h-3 w-3" />}
                            {groupLabel(g.label)}
                            <span className="tabular-nums">· {g.rows.length}</span>
                          </span>
                        </th>
                      </tr>
                    )}
                    {g.rows.map((r) => (
                      <tr
                        key={r.key}
                        data-wy="hw-row"
                        tabIndex={-1}
                        onClick={() => onOpen(r)}
                        onKeyDown={(e) => rowKey(e, r)}
                        className="group cursor-pointer border-b border-[var(--wy-border)] last:border-b-0 hover:bg-[var(--wy-surface-2)]"
                      >
                        <td className="max-w-[18rem] py-2 pl-4 pr-3 align-top">
                          <div className="flex items-center gap-1.5">
                            <BucketDot bucket={r.bucket} label={bucketLabel(r.bucket)} />
                            <span className={cn("font-medium", BUCKET_TEXT[r.bucket])}>
                              {r.statusWord}
                            </span>
                          </div>
                          {r.detail && (
                            <p
                              className="mt-0.5 truncate pl-3.5 text-[11px] text-[var(--wy-text-faint)]"
                              title={[r.detail, r.explanation].filter(Boolean).join(" — ")}
                            >
                              {r.detail}
                            </p>
                          )}
                        </td>
                        <td className="max-w-[16rem] px-3 py-2 align-top">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen(r);
                            }}
                            className="flex max-w-full items-center gap-2 rounded text-left font-medium text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                            aria-haspopup="dialog"
                          >
                            <TypeIcon row={r} />
                            <span className="truncate">{r.name}</span>
                          </button>
                          {r.model && (
                            <p className="truncate pl-5.5 text-[11px] text-[var(--wy-text-faint)]">
                              {r.model}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top text-[var(--wy-text-muted)]">
                          {r.typeLabel}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top text-[var(--wy-text-muted)]">
                          {r.floor || <span className="text-[var(--wy-text-faint)]">—</span>}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 align-top text-xs text-[var(--wy-text-muted)] ${MONO}`}
                        >
                          {r.mac ?? <span className="text-[var(--wy-text-faint)]">—</span>}
                        </td>
                        <td
                          className="whitespace-nowrap px-3 py-2 align-top text-xs tabular-nums text-[var(--wy-text-muted)]"
                          title={r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : undefined}
                        >
                          {relTime(r.lastSeenAt, now)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-top text-xs tabular-nums text-[var(--wy-text-muted)]">
                          {r.uptimeSeconds != null ? (
                            formatDuration(r.uptimeSeconds)
                          ) : (
                            <span className="text-[var(--wy-text-faint)]">—</span>
                          )}
                        </td>
                        <td className="pr-3 align-middle">
                          <ChevronRight
                            aria-hidden
                            className="h-4 w-4 text-[var(--wy-text-faint)] opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* < md: stacked list */}
          <ul className="divide-y divide-[var(--wy-border)] md:hidden">
            {groups.map((g) => (
              <Fragment key={g.key}>
                {g.label != null && (
                  <li className="bg-[var(--wy-bg)] px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
                    {groupLabel(g.label)} · {g.rows.length}
                  </li>
                )}
                {g.rows.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      data-wy="hw-row"
                      onClick={() => onOpen(r)}
                      aria-haspopup="dialog"
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wy-accent)]"
                    >
                      <BucketDot
                        bucket={r.bucket}
                        label={bucketLabel(r.bucket)}
                        className="mt-1.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <TypeIcon row={r} />
                          <span className="truncate text-[13px] font-medium text-[var(--wy-text)]">
                            {r.name}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs">
                          <span className={cn("font-medium", BUCKET_TEXT[r.bucket])}>
                            {r.statusWord}
                          </span>
                          {r.detail && (
                            <span className="text-[var(--wy-text-faint)]"> · {r.detail}</span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--wy-text-faint)]">
                          {[r.typeLabel, r.floor].filter(Boolean).join(" · ")}
                          {r.mac && <span className={MONO}> · {r.mac}</span>}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="mt-1 h-4 w-4 shrink-0 text-[var(--wy-text-faint)]"
                      />
                    </button>
                  </li>
                ))}
              </Fragment>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
