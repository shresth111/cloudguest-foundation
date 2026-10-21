/**
 * ISP reports (PRD §4.10, TASKS FE-9) from `GET /isp/reports/summary`.
 * Range ≤ 92 days, optional customer. CSV per section, one PDF of all.
 * Null availability renders "Not measured yet", never 0 %.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileBarChart } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MStat,
  MTable,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  Card,
  CustomerSelect,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
} from "@/components/isp-partner/kit";
import { saveBlob } from "@/lib/isp-partner/download";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIspCustomerOptions, useIspReport } from "@/hooks/isp-partner/useIsp";
import { ispService } from "@/services/isp-partner/isp";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatBytes, formatNumber, isoDay } from "@/lib/isp-partner/format";
import type {
  IspReportQuery,
  IspReportSection,
  IspReportSummary,
} from "@/services/isp-partner/types";

const MAX_DAYS = 92;
const DAY = 86_400_000;

function dayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Single-series daily bars: one hue (primary), hover tooltip per bar, and
 * the same numbers in the table below for anyone who cannot use the chart. */
function DailyLoginsChart({ rows }: { rows: IspReportSummary["guest_activity"]["by_day"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.logins));
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No sign-ins in this range.</p>;
  const h = hover !== null ? rows[hover] : null;
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs text-muted-foreground">
        Guest sign-ins per day (peak {formatNumber(max)})
        {h && (
          <span className="ml-2 text-foreground">
            {h.day}: {formatNumber(h.logins)} sign-ins · {formatNumber(h.unique_guests)} unique ·{" "}
            {formatBytes(h.bytes)}
          </span>
        )}
      </figcaption>
      <div
        className="flex h-40 items-end gap-[2px] border-b border-border"
        role="img"
        aria-label="Daily guest sign-ins; the table below has the numbers"
        onMouseLeave={() => setHover(null)}
      >
        {rows.map((r, i) => (
          <div
            key={r.day}
            className="flex h-full min-w-[3px] flex-1 items-end"
            onMouseEnter={() => setHover(i)}
          >
            <div
              className={`w-full rounded-t-[4px] ${hover === i ? "bg-primary" : "bg-primary/70"}`}
              style={{ height: `${Math.max(r.logins > 0 ? 2 : 0, (r.logins / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{rows[0].day}</span>
        <span>{rows[rows.length - 1].day}</span>
      </div>
    </figure>
  );
}

export function ReportsView({ fixedCustomerId }: { fixedCustomerId?: string }) {
  const { can } = usePartner();
  const customers = useIspCustomerOptions(!fixedCustomerId);
  const today = isoDay(new Date());
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 29 * DAY)));
  const [to, setTo] = useState(today);
  const [customerId, setCustomerId] = useState(fixedCustomerId ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  const rangeError = useMemo(() => {
    if (!from || !to) return "Pick both dates.";
    if (from > to) return "The start date is after the end date.";
    const days = Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / DAY) + 1;
    if (days > MAX_DAYS) return `Pick a range of ${MAX_DAYS} days or less (this one is ${days}).`;
    return null;
  }, [from, to]);

  const query: IspReportQuery = useMemo(
    () => ({
      since: dayStart(from).toISOString(),
      until: new Date(dayStart(to).getTime() + DAY).toISOString(),
      isp_customer_id: (fixedCustomerId ?? customerId) || undefined,
    }),
    [from, to, customerId, fixedCustomerId],
  );
  const q = useIspReport(query, !rangeError);
  const r = q.data;
  const canExport = can("isp_partner.export");

  const exportIt = async (format: "csv" | "pdf", section: IspReportSection) => {
    const key = `${format}-${section}`;
    setBusy(key);
    try {
      const { blob, filename } = await ispService.exportReport(format, section, query);
      saveBlob(blob, filename);
    } catch (err) {
      toast.error(ispErrorMessage(err, "The export failed."));
    } finally {
      setBusy(null);
    }
  };
  const csv = (section: IspReportSection) =>
    canExport && (
      <MButton variant="outline" disabled={busy !== null} onClick={() => exportIt("csv", section)}>
        {busy === `csv-${section}` ? <Spinner /> : <Download />} CSV
      </MButton>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">From</span>
          <input
            type="date"
            className={`${M_INPUT} w-auto`}
            value={from}
            max={today}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">To</span>
          <input
            type="date"
            className={`${M_INPUT} w-auto`}
            value={to}
            max={today}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {!fixedCustomerId && (
          <div className="w-full max-w-[240px]">
            <CustomerSelect
              value={customerId}
              onChange={setCustomerId}
              customers={customers.data}
            />
          </div>
        )}
        {canExport && (
          <MButton disabled={busy !== null || !!rangeError} onClick={() => exportIt("pdf", "all")}>
            {busy === "pdf-all" ? <Spinner /> : <FileBarChart />} Download PDF (all sections)
          </MButton>
        )}
      </div>
      <FormError message={rangeError} />

      {rangeError ? null : q.isLoading ? (
        <LoadingBlock label="Building the report…" />
      ) : q.error || !r ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the report" />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Days are counted in {r.timezone}.</p>
          <Card title="Portfolio" actions={csv("portfolio")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MStat
                label="Customers"
                value={`${r.portfolio.customers.active} active`}
                delta={`${r.portfolio.customers.suspended} suspended`}
              />
              <MStat
                label="Locations"
                value={`${r.portfolio.locations.active} active`}
                delta={`${r.portfolio.locations.suspended} suspended`}
              />
              <MStat
                label="Routers (now)"
                value={`${r.portfolio.routers.online} online`}
                delta={`${r.portfolio.routers.offline} offline · ${r.portfolio.routers.pending} awaiting setup`}
              />
            </div>
            <div className="mt-3">
              {r.portfolio.router_availability.length === 0 ||
              r.portfolio.router_availability.every((a) => a.availability_percentage === null) ? (
                <p className="text-sm text-muted-foreground">
                  Router availability: not measured yet.
                </p>
              ) : (
                <MTable
                  head={
                    <>
                      <MTh>Router</MTh>
                      <MTh>Customer</MTh>
                      <MTh className="text-right">Availability</MTh>
                    </>
                  }
                >
                  {r.portfolio.router_availability.map((a) => (
                    <MTr key={a.isp_router_id}>
                      <MTd>{a.name}</MTd>
                      <MTd className="text-xs">{a.customer_name}</MTd>
                      <MTd className="text-right tabular-nums">
                        {a.availability_percentage === null
                          ? "Not measured yet"
                          : `${a.availability_percentage.toFixed(1)} %`}
                      </MTd>
                    </MTr>
                  ))}
                </MTable>
              )}
            </div>
          </Card>

          <Card title="Guest activity" actions={csv("guest_activity")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MStat label="Sign-ins" value={r.guest_activity.logins} />
              <MStat label="Unique guests" value={r.guest_activity.unique_guests} />
              <MStat
                label="Avg session"
                value={
                  r.guest_activity.avg_session_minutes === null
                    ? "–"
                    : `${r.guest_activity.avg_session_minutes.toFixed(1)} min`
                }
              />
            </div>
            <div className="mt-4">
              <DailyLoginsChart rows={r.guest_activity.by_day} />
            </div>
            {r.guest_activity.by_day.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Show as table
                </summary>
                <div className="mt-2">
                  <MTable
                    head={
                      <>
                        <MTh>Day</MTh>
                        <MTh className="text-right">Sign-ins</MTh>
                        <MTh className="text-right">Unique</MTh>
                        <MTh className="text-right">Data</MTh>
                      </>
                    }
                  >
                    {r.guest_activity.by_day.map((d) => (
                      <MTr key={d.day}>
                        <MTd>{d.day}</MTd>
                        <MTd className="text-right tabular-nums">{formatNumber(d.logins)}</MTd>
                        <MTd className="text-right tabular-nums">
                          {formatNumber(d.unique_guests)}
                        </MTd>
                        <MTd className="text-right tabular-nums">{formatBytes(d.bytes)}</MTd>
                      </MTr>
                    ))}
                  </MTable>
                </div>
              </details>
            )}
          </Card>

          <Card title="Data usage by customer" actions={csv("usage_by_customer")}>
            {r.usage_by_customer.length === 0 ? (
              <MEmptyState icon={FileBarChart} title="No usage in this range" />
            ) : (
              <MTable
                head={
                  <>
                    <MTh>Customer</MTh>
                    <MTh className="text-right">Sign-ins</MTh>
                    <MTh className="text-right">Unique guests</MTh>
                    <MTh className="text-right">Download</MTh>
                    <MTh className="text-right">Upload</MTh>
                    <MTh className="text-right">Total</MTh>
                  </>
                }
              >
                {r.usage_by_customer.map((u) => (
                  <MTr key={u.isp_customer_id}>
                    <MTd>{u.name}</MTd>
                    <MTd className="text-right tabular-nums">{formatNumber(u.logins)}</MTd>
                    <MTd className="text-right tabular-nums">{formatNumber(u.unique_guests)}</MTd>
                    <MTd className="text-right tabular-nums">{formatBytes(u.bytes_down)}</MTd>
                    <MTd className="text-right tabular-nums">{formatBytes(u.bytes_up)}</MTd>
                    <MTd className="text-right font-medium tabular-nums">
                      {formatBytes(u.bytes_total)}
                    </MTd>
                  </MTr>
                ))}
              </MTable>
            )}
            {r.top_customers.length > 0 && !fixedCustomerId && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  Top customers by data
                </p>
                <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                  {r.top_customers.map((t) => (
                    <li key={t.isp_customer_id}>
                      {t.name}{" "}
                      <span className="text-muted-foreground">· {formatBytes(t.bytes_total)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>

          <Card title="TR-069 devices" actions={csv("tr069")}>
            <p className="mb-2 text-sm">
              {r.tr069.total} devices · {r.tr069.online} online · {r.tr069.offline} offline ·{" "}
              {r.tr069.unassigned} unassigned
            </p>
            {r.tr069.by_model.length > 0 && (
              <MTable
                head={
                  <>
                    <MTh>Make</MTh>
                    <MTh>Model</MTh>
                    <MTh>Software</MTh>
                    <MTh className="text-right">Devices</MTh>
                    <MTh className="text-right">Online</MTh>
                  </>
                }
              >
                {r.tr069.by_model.map((m, i) => (
                  <MTr key={`${m.model}-${m.software_version}-${i}`}>
                    <MTd>{m.manufacturer ?? "–"}</MTd>
                    <MTd>{m.model ?? "–"}</MTd>
                    <MTd className="text-xs">{m.software_version ?? "–"}</MTd>
                    <MTd className="text-right tabular-nums">{m.count}</MTd>
                    <MTd className="text-right tabular-nums">{m.online}</MTd>
                  </MTr>
                ))}
              </MTable>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
