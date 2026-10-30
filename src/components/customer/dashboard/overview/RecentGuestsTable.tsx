/**
 * Recent guests, dense and sortable. Rows are `d.recentUsers` from the
 * dashboard summary (`getDashboard()` -> `/guest-sessions` + `/guests`),
 * passed in; nothing is fetched here.
 *
 * That source carries no MAC or IP for a guest, so the table shows none --
 * an address column of dashes would read as broken, and a made-up one would
 * be worse. "Time" is the API's own relative string; sorting by it uses the
 * API's order (newest first), never a parse of "5 min ago".
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { StatusDot, type OverviewStatus } from "./console-ui";

export interface RecentGuestRow {
  id: string;
  name: string;
  email: string;
  device: string;
  time: string;
  status: string;
}

type SortKey = "name" | "device" | "time" | "status";

const STATUS_RANK: Record<string, number> = { online: 0, idle: 1, offline: 2 };

function guestStatus(s: string): OverviewStatus {
  if (s === "online") return "ok";
  if (s === "idle") return "warn";
  if (s === "offline") return "offline";
  return "unknown";
}

export function RecentGuestsTable({
  rows,
  maskEmail,
  onOpenRow,
  limit = 6,
}: {
  rows: RecentGuestRow[];
  /** Applied to every email when data masking is on. */
  maskEmail: (email: string) => string;
  /** Row click / Enter. There is no per-guest page; this opens Guests. */
  onOpenRow: (row: RecentGuestRow) => void;
  limit?: number;
}) {
  const { t } = useTranslation("dashboard", { i18n });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "time", dir: 1 });

  const sorted = useMemo(() => {
    const withIdx = rows.slice(0, limit).map((r, idx) => ({ r, idx }));
    const cmp = (a: (typeof withIdx)[number], b: (typeof withIdx)[number]) => {
      switch (sort.key) {
        case "name":
          return a.r.name.localeCompare(b.r.name);
        case "device":
          return a.r.device.localeCompare(b.r.device);
        case "status":
          return (STATUS_RANK[a.r.status] ?? 9) - (STATUS_RANK[b.r.status] ?? 9) || a.idx - b.idx;
        case "time":
        default:
          return a.idx - b.idx;
      }
    };
    return withIdx.sort((a, b) => cmp(a, b) * sort.dir).map((x) => x.r);
  }, [rows, sort, limit]);

  const statusLabel = (s: string) =>
    s === "online"
      ? t("recentUsers.statusOnline", "online")
      : s === "offline"
        ? t("recentUsers.statusOffline", "offline")
        : s === "idle"
          ? t("recentUsers.statusIdle", "idle")
          : s;

  const head = (key: SortKey, label: string, className?: string) => {
    const on = sort.key === key;
    const Icon = !on ? ArrowUpDown : sort.dir === 1 ? ArrowDown : ArrowUp;
    return (
      <th
        scope="col"
        aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
        className={cn("px-3 py-2 font-medium", className)}
      >
        <button
          type="button"
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
          className="inline-flex items-center gap-1 rounded uppercase tracking-[0.06em] hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
        >
          {label}
          <Icon className={cn("h-3 w-3", !on && "opacity-40")} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs" data-testid="recent-guests-table">
        <thead className="border-b border-[var(--wy-border)] bg-[var(--wy-surface-2)] text-[10px] text-[var(--wy-text-faint)]">
          <tr>
            {head("name", t("recentUsers.colUser", "User"))}
            {head("device", t("recentUsers.colDevice", "Device"))}
            {head("time", t("recentUsers.colTime", "Time"))}
            {head("status", t("recentUsers.colStatus", "Status"), "text-right")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((u) => (
            <tr
              key={u.id}
              tabIndex={0}
              onClick={() => onOpenRow(u)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenRow(u);
                }
              }}
              className="cursor-pointer border-b border-[var(--wy-border)] transition-colors duration-150 last:border-0 hover:bg-[var(--wy-surface-2)] focus-visible:bg-[var(--wy-surface-2)] focus-visible:outline-none"
            >
              <td className="max-w-[14rem] px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={guestStatus(u.status)} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--wy-text)]">{u.name}</p>
                    {u.email && (
                      <p className="truncate font-[family-name:var(--wy-font-mono)] text-[11px] text-[var(--wy-text-faint)]">
                        {maskEmail(u.email)}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="max-w-[10rem] truncate px-3 py-2 text-[var(--wy-text-muted)]">
                {u.device}
              </td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--wy-text-muted)]">
                {u.time}
              </td>
              <td className="px-3 py-2 text-right">
                {/* `status` is a free string from the API; an unknown value
                    shows as sent. */}
                <span className="text-[11px] font-medium text-[var(--wy-text-muted)]">
                  {statusLabel(u.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
