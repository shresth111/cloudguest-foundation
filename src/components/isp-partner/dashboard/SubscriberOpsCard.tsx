/**
 * Overview → Subscribers (DASH-1). Extends JAZE-3's counters: while the
 * dashboard API is switched off (404) it renders `fallback` (the existing
 * `CountersCard`) unchanged.
 *
 * - Online sessions ring (hotspot, plus PPPoE when that is on).
 * - Eight state tiles that add up to the total, plus expiring / renewing /
 *   new-in-period. Each tile opens the subscriber list for exactly that tile;
 *   the list's count is the tile's number (same backend rows).
 * - Filters: period (today / 7 days / 30 days / custom, plain dates), router,
 *   package, connection type. Zone comes from the header's Switch zone.
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  MDrawer,
  MSeg,
  MStat,
  MTable,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock, Pager } from "@/components/isp-partner/kit";
import { useIspRouters } from "@/hooks/isp-partner/useIsp";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { useDashboardList, useSubscriberDashboard } from "@/hooks/isp-partner/useDashboard";
import { ispErrorStatus } from "@/lib/isp-partner/errors";
import { formatDate, formatNumber } from "@/lib/isp-partner/format";
import {
  BUCKET_LABEL,
  OVERLAY_TILES,
  PARTITION_TILES,
  TILE_LABEL,
  arcPath,
  customRangeError,
  onlineSegments,
} from "@/lib/isp-partner/dashboard";
import type {
  DashFilters,
  DashPeriod,
  DashTile,
  SubscriberDashboard,
} from "@/services/isp-partner/dashboard-types";

const SEGMENT_COLOR = { hotspot: "var(--chart-1)", pppoe: "var(--chart-2)" } as const;
const R = 46;
const W = 12;

function OnlineRing({ d }: { d: SubscriberDashboard }) {
  const segs = onlineSegments(d.online);
  const size = 2 * (R + W);
  return (
    <figure className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${d.online.total_sessions} sessions online: ${segs
          .map((s) => `${s.label} ${s.value}`)
          .join(", ")}`}
      >
        <circle cx={R + W} cy={R + W} r={R} fill="none" stroke="var(--muted)" strokeWidth={W} />
        {segs.map((s) =>
          s.value > 0 ? (
            <path
              key={s.key}
              d={arcPath(s.from, s.to, R, W)}
              fill="none"
              stroke={SEGMENT_COLOR[s.key]}
              strokeWidth={W}
              strokeLinecap="butt"
            >
              <title>
                {s.label}: {s.value}
              </title>
            </path>
          ) : null,
        )}
        <text
          x={R + W}
          y={R + W - 2}
          textAnchor="middle"
          className="fill-foreground text-xl font-semibold tabular-nums"
        >
          {formatNumber(d.online.total_sessions)}
        </text>
        <text
          x={R + W}
          y={R + W + 14}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          sessions
        </text>
      </svg>
      <figcaption className="space-y-1 text-xs">
        <p className="text-sm font-semibold">Online now</p>
        {segs.map((s) => (
          <p key={s.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: SEGMENT_COLOR[s.key] }}
            />
            {s.label}: <span className="tabular-nums">{formatNumber(s.value)}</span>
          </p>
        ))}
        {!d.online.pppoe_enabled && (
          <p className="text-muted-foreground">PPPoE is not switched on.</p>
        )}
        <p className="text-muted-foreground">
          {formatNumber(d.online.subscribers)} subscribers online
        </p>
      </figcaption>
    </figure>
  );
}

function Tile({
  tile,
  d,
  onOpen,
  extra,
}: {
  tile: DashTile;
  d: SubscriberDashboard;
  onOpen: (t: DashTile) => void;
  extra?: string;
}) {
  const n = d.tiles[tile] ?? 0;
  const tone =
    tile === "active"
      ? "success"
      : tile === "suspended" || tile === "blocked"
        ? "danger"
        : tile === "expiring_7d" || tile === "pending"
          ? "warning"
          : "default";
  return (
    <button
      type="button"
      className="rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title={d.definitions[tile]}
      aria-label={`${TILE_LABEL[tile]}: ${n}. Show these subscribers`}
      onClick={() => onOpen(tile)}
    >
      <MStat label={TILE_LABEL[tile]} value={formatNumber(n)} tone={tone} delta={extra} />
    </button>
  );
}

function DrillDrawer({
  tile,
  filters,
  onClose,
}: {
  tile: DashTile | null;
  filters: DashFilters;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const q = useDashboardList(filters, tile, page);
  if (!tile) return null;
  const d = q.data;
  return (
    <MDrawer
      open
      onClose={onClose}
      title={`${TILE_LABEL[tile]}${d ? ` (${formatNumber(d.total)})` : ""}`}
      subtitle="Exactly the subscribers counted in this tile, with the same filters and zone."
    >
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="these subscribers" />
      ) : !q.isLoading && d && d.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody in this tile.</p>
      ) : (
        <div className="space-y-3">
          <MTable
            loading={q.isLoading}
            head={
              <>
                <MTh>Subscriber</MTh>
                <MTh>Customer</MTh>
                <MTh>Package</MTh>
                <MTh>State</MTh>
                <MTh>Valid until</MTh>
              </>
            }
          >
            {d?.items.map((i) => (
              <MTr key={i.id}>
                <MTd>
                  <Link
                    to="/partner/subscribers/$subscriberId"
                    params={{ subscriberId: i.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {i.display_name || i.identifier || "–"}
                  </Link>
                  {i.circuit_id != null && (
                    <span className="block text-[11px] text-muted-foreground">
                      Circuit {i.circuit_id}
                    </span>
                  )}
                </MTd>
                <MTd className="text-xs">{i.customer_name ?? "–"}</MTd>
                <MTd className="text-xs">{i.package_name ?? "–"}</MTd>
                <MTd className="text-xs">{BUCKET_LABEL[i.bucket] ?? i.bucket}</MTd>
                <MTd className="text-xs">{formatDate(i.valid_until)}</MTd>
              </MTr>
            ))}
          </MTable>
          {d && <Pager page={d.page} pages={d.pages} total={d.total} onPage={setPage} />}
        </div>
      )}
    </MDrawer>
  );
}

const PERIODS: { value: DashPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom" },
];

export function SubscriberOpsCard({ fallback }: { fallback: ReactNode }) {
  const [period, setPeriod] = useState<DashPeriod>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [routerId, setRouterId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [conn, setConn] = useState("");
  const [open, setOpen] = useState<DashTile | null>(null);
  const rangeError = period === "custom" ? customRangeError(from, to) : null;
  const filters: DashFilters = {
    period,
    ...(period === "custom" ? { date_from: from, date_to: to } : {}),
    isp_router_id: routerId || undefined,
    package_id: packageId || undefined,
    connection_type: conn || undefined,
  };
  const q = useSubscriberDashboard(filters, !rangeError);
  // 404: switched off; 403: the role cannot read subscribers. Either way the
  // JAZE-3 counters stay as they were.
  const status = ispErrorStatus(q.error);
  const off = (status === 404 || status === 403) && !q.data;
  const routers = useIspRouters({ page_size: 100 }, !off);
  const packages = usePackages({ page_size: 100 }, !off);

  if (off) return <>{fallback}</>;
  const d = q.data;

  return (
    <Card title="Subscribers">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MSeg<DashPeriod> value={period} onChange={setPeriod} options={PERIODS} />
        {period === "custom" && (
          <>
            <input
              type="date"
              className={`${M_INPUT} w-auto py-1`}
              aria-label="From"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              type="date"
              className={`${M_INPUT} w-auto py-1`}
              aria-label="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        )}
        <select
          className={`${M_INPUT} w-auto py-1`}
          aria-label="Router"
          value={routerId}
          onChange={(e) => setRouterId(e.target.value)}
        >
          <option value="">All routers</option>
          {(routers.data?.items ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          className={`${M_INPUT} w-auto py-1`}
          aria-label="Package"
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
        >
          <option value="">All packages</option>
          {(packages.data?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={`${M_INPUT} w-auto py-1`}
          aria-label="Connection type"
          value={conn}
          onChange={(e) => setConn(e.target.value)}
        >
          <option value="">Any connection</option>
          <option value="fiber">Fiber</option>
          <option value="wireless">Wireless</option>
          <option value="ethernet">Ethernet</option>
          <option value="other">Other</option>
        </select>
      </div>
      {rangeError ? (
        <p className="text-xs text-destructive">{rangeError}</p>
      ) : q.error && !d ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="subscriber counts" />
      ) : !d ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
          <button
            type="button"
            className="self-start rounded-xl p-2 text-left hover:bg-accent/40"
            onClick={() => setOpen("online")}
            aria-label="Show subscribers online now"
          >
            <OnlineRing d={d} />
          </button>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PARTITION_TILES.map((t) => (
                <Tile
                  key={t}
                  tile={t}
                  d={d}
                  onOpen={setOpen}
                  extra={
                    t === "pending" && d.pending_leads
                      ? `+ ${formatNumber(d.pending_leads)} leads`
                      : undefined
                  }
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OVERLAY_TILES.map((t) => (
                <Tile key={t} tile={t} d={d} onOpen={setOpen} />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Every subscriber is in exactly one of the first eight tiles, so they add up to the
              total. Hover a tile for its meaning; click it for the list.
              {d.pending_leads != null &&
                ` Leads waiting on feasibility or installation (${formatNumber(
                  d.pending_leads,
                )}) are not subscribers yet and are not in the total.`}
            </p>
          </div>
        </div>
      )}
      <DrillDrawer
        key={`${open}-${JSON.stringify(filters)}`}
        tile={open}
        filters={filters}
        onClose={() => setOpen(null)}
      />
    </Card>
  );
}
