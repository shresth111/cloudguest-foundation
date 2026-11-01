/** J17: TRAI PMR monthly pack, AGR, and the monthly email schedules. */
import { useEffect, useState } from "react";
import { MButton, MStat, MTable, MTd, MTh, MTr, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useAgr,
  useComplianceMutation,
  useReportSchedules,
  useTraiPmr,
} from "@/hooks/isp-partner/useCompliance";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import { complianceService, type ReportSchedule } from "@/services/isp-partner/compliance";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

function lastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function download(p: Promise<{ blob: Blob; filename: string }>, onErr: (m: string) => void) {
  try {
    const f = await p;
    saveBlob(f.blob, f.filename);
  } catch (e) {
    onErr(ispErrorMessage(e));
  }
}

const TRAI_FILES = [
  { key: "subscriptions", label: "Subscriptions by speed" },
  { key: "hotspots", label: "Public Wi-Fi hotspots" },
  { key: "gigabit", label: "Subscribers above 1 Gbps" },
  { key: "data_usage", label: "Data usage" },
];

export function FilingsView() {
  const { can } = usePartner();
  return (
    <div className="space-y-4">
      <TraiCard canExport={can("isp_partner.export")} />
      {can("isp_billing.read") && <AgrCard canExport={can("isp_billing.export")} />}
      <SchedulesCard canManage={can("isp_partner.manage")} />
    </div>
  );
}

function TraiCard({ canExport }: { canExport: boolean }) {
  const [period, setPeriod] = useState(lastMonth());
  const [err, setErr] = useState<string | null>(null);
  const q = useTraiPmr(period);
  const d = q.data;
  return (
    <Card
      title="TRAI PMR (monthly)"
      actions={
        <input
          type="month"
          aria-label="Month"
          className={`${M_FILTER}`}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        />
      }
    >
      {q.error && <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the TRAI report" />}
      <div className="grid gap-3 sm:grid-cols-4">
        <MStat
          label="Subscriptions"
          value={d ? formatNumber(d.subscriptions_total) : "—"}
          loading={q.isLoading}
        />
        <MStat
          label="Hotspot venues"
          value={d ? formatNumber(d.public_wifi_hotspots.venues) : "—"}
          loading={q.isLoading}
        />
        <MStat
          label={`At or above ${d?.gigabit_threshold_mbps ?? 1000} Mbps`}
          value={d ? formatNumber(d.gigabit_subscribers.length) : "—"}
          loading={q.isLoading}
        />
        <MStat
          label="Data used (down / up)"
          value={
            d
              ? `${formatBytes(d.data_usage.download_bytes)} / ${formatBytes(d.data_usage.upload_bytes)}`
              : "—"
          }
          loading={q.isLoading}
        />
      </div>
      {d && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <MTable
            head={
              <MTr>
                <MTh>Speed tier</MTh>
                <MTh>Subscribers</MTh>
              </MTr>
            }
          >
            {d.subscriptions_by_speed.map((r) => (
              <MTr key={r.tier}>
                <MTd>{r.tier}</MTd>
                <MTd>{formatNumber(r.subscribers)}</MTd>
              </MTr>
            ))}
          </MTable>
          <MTable
            head={
              <MTr>
                <MTh>Public Wi-Fi</MTh>
                <MTh>Value</MTh>
              </MTr>
            }
          >
            <MTr>
              <MTd>Venues</MTd>
              <MTd>{formatNumber(d.public_wifi_hotspots.venues)}</MTd>
            </MTr>
            <MTr>
              <MTd>Routers (NAS)</MTd>
              <MTd>{formatNumber(d.public_wifi_hotspots.nas_routers)}</MTd>
            </MTr>
            <MTr>
              <MTd>Access points</MTd>
              <MTd>
                <span title={d.public_wifi_hotspots.access_points_note}>Not tracked</span>
              </MTd>
            </MTr>
            <MTr>
              <MTd>Registered users</MTd>
              <MTd>{formatNumber(d.public_wifi_hotspots.registered_users)}</MTd>
            </MTr>
            <MTr>
              <MTd>Users active in month</MTd>
              <MTd>{formatNumber(d.public_wifi_hotspots.users_active_in_period)}</MTd>
            </MTr>
            <MTr>
              <MTd>Sessions in month</MTd>
              <MTd>{formatNumber(d.public_wifi_hotspots.sessions_in_period)}</MTd>
            </MTr>
          </MTable>
        </div>
      )}
      {canExport && (
        <div className="mt-3 flex flex-wrap gap-2">
          {TRAI_FILES.map((f) => (
            <MButton
              key={f.key}
              variant="outline"
              onClick={() => download(complianceService.traiExport(period, f.key), setErr)}
            >
              {f.label} (CSV)
            </MButton>
          ))}
        </div>
      )}
      <FormError message={err} />
      {d && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[11px] text-muted-foreground">
          {d.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>{d.data_usage.source}</li>
        </ul>
      )}
    </Card>
  );
}

function AgrCard({ canExport }: { canExport: boolean }) {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const q = useAgr(since, until);
  const d = q.data;
  return (
    <Card
      title="AGR (adjusted gross revenue)"
      actions={
        <>
          <input
            type="date"
            aria-label="From"
            className={`${M_FILTER}`}
            value={since || d?.since || ""}
            onChange={(e) => setSince(e.target.value)}
          />
          <input
            type="date"
            aria-label="To"
            className={`${M_FILTER}`}
            value={until || d?.until || ""}
            onChange={(e) => setUntil(e.target.value)}
          />
          {canExport && (
            <MButton
              variant="outline"
              onClick={() =>
                download(
                  complianceService.agrExport(since || undefined, until || undefined),
                  setErr,
                )
              }
            >
              CSV
            </MButton>
          )}
        </>
      }
    >
      {q.error && <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="AGR" />}
      <div className="grid gap-3 sm:grid-cols-4">
        <MStat
          label="Telecom revenue (SAC 9984)"
          value={d ? formatRupees(d.telecom_taxable_paise) : "—"}
          loading={q.isLoading}
        />
        <MStat
          label="Other revenue"
          value={d ? formatRupees(d.other_taxable_paise) : "—"}
          loading={q.isLoading}
        />
        <MStat
          label="Gross (taxable)"
          value={d ? formatRupees(d.gross_taxable_paise) : "—"}
          loading={q.isLoading}
        />
        <MStat
          label="GST collected (excluded)"
          value={d ? formatRupees(d.gst_collected_paise) : "—"}
          loading={q.isLoading}
        />
      </div>
      {d?.partial_view && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Your role is limited to some customers, but AGR covers the whole ISP.
        </p>
      )}
      <FormError message={err} />
      {d && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[11px] text-muted-foreground">
          {d.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const SCHEDULE_LABEL: Record<string, string> = {
  trai_pmr: "TRAI PMR pack",
  agr: "AGR",
  subscriber_details_status: "Subscriber details with status",
};

function SchedulesCard({ canManage }: { canManage: boolean }) {
  const q = useReportSchedules();
  return (
    <Card title="Monthly emails">
      {q.error && <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="schedules" />}
      {q.data && !q.data.delivery_enabled && (
        <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
          Scheduled delivery is switched off on this platform for now. You can save schedules; they
          start sending once Wyfy turns delivery on.
        </p>
      )}
      <div className="space-y-3">
        {(q.data?.report_keys ?? []).map((key) => (
          <ScheduleRow
            key={key}
            reportKey={key}
            current={q.data?.schedules.find((s) => s.report_key === key)}
            canManage={canManage}
          />
        ))}
      </div>
    </Card>
  );
}

function ScheduleRow({
  reportKey,
  current,
  canManage,
}: {
  reportKey: string;
  current?: ReportSchedule;
  canManage: boolean;
}) {
  const [day, setDay] = useState(String(current?.day_of_month ?? 1));
  const [to, setTo] = useState((current?.recipients ?? []).join(", "));
  const [enabled, setEnabled] = useState(current?.enabled ?? true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setDay(String(current?.day_of_month ?? 1));
    setTo((current?.recipients ?? []).join(", "));
    setEnabled(current?.enabled ?? true);
  }, [current]);
  const save = useComplianceMutation(() =>
    complianceService.saveSchedule(reportKey, {
      day_of_month: Number(day),
      recipients: to.split(/[,\s]+/).filter(Boolean),
      enabled,
    }),
  );
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <span className="w-56 text-sm font-medium">{SCHEDULE_LABEL[reportKey] ?? reportKey}</span>
        <label className="text-xs text-muted-foreground">
          Day of month
          <input
            className={`${M_INPUT} w-20`}
            inputMode="numeric"
            disabled={!canManage}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label className="min-w-[16rem] flex-1 text-xs text-muted-foreground">
          Send to (comma separated)
          <input
            className={M_INPUT}
            disabled={!canManage}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          On
        </label>
        {canManage && (
          <MButton
            variant="outline"
            disabled={save.isPending}
            onClick={async () => {
              setErr(null);
              try {
                await save.mutateAsync(undefined);
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            Save
          </MButton>
        )}
      </div>
      {current?.last_sent_at && (
        <p className="mt-1 text-xs text-muted-foreground">
          Last sent {formatDateTime(current.last_sent_at)} for {current.last_period_sent} ·{" "}
          {current.last_status}
        </p>
      )}
      <FormError message={err} />
    </div>
  );
}
