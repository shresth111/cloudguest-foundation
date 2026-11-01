/**
 * Compliance → LEA trace and Retention (IPDR-2, ADDENDUM_06).
 *
 * - LEA trace: public IP (+ port) at a time (IST) → NAT rows, the session and
 *   the subscriber. Owner/Admin only; the notice number and a reason are
 *   mandatory; every run, on screen or downloaded, is written to the audit
 *   log. Event time (from the router) and receipt time (by the platform) are
 *   shown side by side, never merged.
 * - Retention: oldest NAT / session row per router against the 2-year
 *   target, days with no NAT rows while the router was up, and the IPDR
 *   field-coverage statement.
 *
 * Both say "not switched on" while ISP_IPDR_LEA_ENABLED is off (404).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSearch } from "lucide-react";
import { MButton, MTable, MTag, MTd, MTh, MTr } from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { useQuery } from "@tanstack/react-query";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage, ispErrorStatus } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { CONFIDENCE_TONE, EMPTY_LEA, buildLeaBody, type LeaForm } from "@/lib/isp-partner/ipdr-lea";
import { ipdrLeaService, type LeaReport, type TimePair } from "@/services/isp-partner/ipdr-lea";

function Off() {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">
        This is not switched on for your account yet. Ask Wyfy Guest support to enable LEA reports.
      </p>
    </Card>
  );
}

function Times({ t }: { t: TimePair }) {
  return (
    <>
      <MTd className="text-xs">
        {t.event_time_reported ? (
          t.event_time_ist
        ) : (
          <span className="text-muted-foreground">Not reported by the router</span>
        )}
      </MTd>
      <MTd className="text-xs">
        {t.receipt_time_ist ?? "–"}
        {t.receipt_basis === "collector_window" && (
          <span className="block text-xs text-muted-foreground">collector window</span>
        )}
      </MTd>
      <MTd className="text-xs tabular-nums">
        {t.gap_minutes ?? "–"}
        {t.gap_flag && <MTag label="Gap" tone="pending" />}
      </MTd>
    </>
  );
}

function ReportView({ r }: { r: LeaReport }) {
  return (
    <div className="space-y-3">
      <Card title="Result">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Reference</dt>
          <dd>{r.lea_reference}</dd>
          <dt className="text-muted-foreground">Asked</dt>
          <dd>
            {r.query.public_ip}:{r.query.public_port ?? "any port"} at {r.query.at_ist}
            <span className="block text-xs text-muted-foreground">
              Window {r.query.window_start_ist} – {r.query.window_end_ist}
            </span>
          </dd>
          <dt className="text-muted-foreground">Verdict</dt>
          <dd>{r.verdict.replace(/_/g, " ")}</dd>
          <dt className="text-muted-foreground">NAT data</dt>
          <dd>{r.nat_data_in_window ? "Present in the window" : "None received in the window"}</dd>
        </dl>
        <p className="mt-2 text-[11px] text-muted-foreground">{r.time_basis}</p>
      </Card>
      <Card title={`NAT rows (${r.nat_rows.length})`}>
        {r.nat_rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No NAT row for this address and port.</p>
        ) : (
          <MTable
            head={
              <>
                <MTh>Router</MTh>
                <MTh>Private</MTh>
                <MTh>Public</MTh>
                <MTh>Destination</MTh>
                <MTh>Event time (IST)</MTh>
                <MTh>Receipt time (IST)</MTh>
                <MTh>Gap (min)</MTh>
              </>
            }
          >
            {r.nat_rows.map((n, i) => (
              <MTr key={i}>
                <MTd className="text-xs">{n.router_name ?? "–"}</MTd>
                <MTd className="font-mono text-xs">
                  {n.private_ip}:{n.private_port ?? "–"}
                </MTd>
                <MTd className="font-mono text-xs">
                  {n.public_ip}:{n.public_port ?? "–"}
                </MTd>
                <MTd className="font-mono text-xs">
                  {n.dst_ip}:{n.dst_port ?? "–"}
                </MTd>
                <Times t={n} />
              </MTr>
            ))}
          </MTable>
        )}
      </Card>
      <Card title={`Session and subscriber (${r.matches.length})`}>
        {r.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No session held that address at that time.
          </p>
        ) : (
          <div className="space-y-3">
            {r.matches.map((m, i) => (
              <div key={i} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">Candidate {m.candidate}</span>
                  <MTag
                    label={`Confidence: ${m.confidence}`}
                    tone={CONFIDENCE_TONE[m.confidence]}
                  />
                  {m.nat_source && (
                    <span className="text-xs text-muted-foreground">
                      translation: {m.nat_source.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr_auto_1fr]">
                  <dt className="text-muted-foreground">User id</dt>
                  <dd>{m.user_id ?? "–"}</dd>
                  <dt className="text-muted-foreground">MAC</dt>
                  <dd className="font-mono">{m.mac ?? "–"}</dd>
                  <dt className="text-muted-foreground">NAS / router</dt>
                  <dd>{m.router_name ?? "–"}</dd>
                  <dt className="text-muted-foreground">Interface</dt>
                  <dd>{m.interface ?? "Not recorded"}</dd>
                  <dt className="text-muted-foreground">Private</dt>
                  <dd className="font-mono">
                    {m.private_ip ?? "–"}:{m.private_port ?? "–"}
                  </dd>
                  <dt className="text-muted-foreground">Lease</dt>
                  <dd>
                    {m.lease_start_ist ?? "–"} → {m.lease_end_ist ?? "still active"}
                  </dd>
                  <dt className="text-muted-foreground">Event time</dt>
                  <dd>{m.event_time_reported ? m.event_time_ist : "Not reported by the router"}</dd>
                  <dt className="text-muted-foreground">Receipt time</dt>
                  <dd>{m.receipt_time_ist ?? "–"}</dd>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{m.name ?? "–"}</dd>
                  <dt className="text-muted-foreground">Phone / email</dt>
                  <dd>{[m.phone, m.email].filter(Boolean).join(" · ") || "–"}</dd>
                  <dt className="text-muted-foreground">Installation address</dt>
                  <dd>{m.installation_address ?? "–"}</dd>
                  <dt className="text-muted-foreground">Permanent address</dt>
                  <dd>{m.permanent_address ?? "–"}</dd>
                  <dt className="text-muted-foreground">ID</dt>
                  <dd>
                    {m.id_proof_type ?? "–"} {m.id_number_masked ?? ""}
                  </dd>
                  <dt className="text-muted-foreground">CAF</dt>
                  <dd>{m.caf_number ?? "–"}</dd>
                </dl>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Aadhaar numbers are held as the last four digits only, so the full number never
              appears.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

export function LeaTraceView() {
  const [f, setF] = useState<LeaForm>(EMPTY_LEA);
  const [errors, setErrors] = useState<Partial<Record<keyof LeaForm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"json" | "pdf" | "xlsx" | null>(null);
  const [report, setReport] = useState<LeaReport | null>(null);
  const [off, setOff] = useState(false);
  const set = (k: keyof LeaForm, v: string) => setF((x) => ({ ...x, [k]: v }));
  if (off) return <Off />;

  const run = async (format: "json" | "pdf" | "xlsx") => {
    const res = buildLeaBody(f);
    if (!res.ok) return setErrors(res.errors);
    setErrors({});
    setError(null);
    setBusy(format);
    try {
      if (format === "json") setReport(await ipdrLeaService.trace(res.body));
      else {
        const file = await ipdrLeaService.traceFile(res.body, format);
        saveBlob(file.blob, file.filename);
        toast.success("Report downloaded. The download is recorded in the audit log.");
      }
    } catch (err) {
      if (ispErrorStatus(err) === 404 && !report) setOff(true);
      else setError(ispErrorMessage(err, "Could not run the trace."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Reverse IP trace for a law-enforcement request">
        <p className="mb-3 text-xs text-muted-foreground">
          Owner and Admin only. Every run, on screen or downloaded, is recorded in the audit log
          with the reference below.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="Public IP"
            value={f.public_ip}
            onChange={(v) => set("public_ip", v)}
            error={errors.public_ip}
            required
          />
          <TextField
            label="Public port (optional)"
            value={f.public_port}
            onChange={(v) => set("public_port", v)}
            error={errors.public_port}
          />
          <TextField
            label="Date and time (IST)"
            type="datetime-local"
            value={f.at}
            onChange={(v) => set("at", v)}
            error={errors.at}
            required
          />
          <TextField
            label="Window ± seconds"
            value={f.tolerance_seconds}
            onChange={(v) => set("tolerance_seconds", v)}
            error={errors.tolerance_seconds}
          />
          <TextField
            label="Flag receipt gaps over (min)"
            value={f.gap_minutes}
            onChange={(v) => set("gap_minutes", v)}
            error={errors.gap_minutes}
          />
          <TextField
            label="Notice / LEA reference"
            value={f.lea_reference}
            onChange={(v) => set("lea_reference", v)}
            error={errors.lea_reference}
            required
          />
        </div>
        <div className="mt-3">
          <TextField
            label="Reason"
            value={f.reason}
            onChange={(v) => set("reason", v)}
            error={errors.reason}
            required
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <MButton onClick={() => run("json")} disabled={!!busy}>
            {busy === "json" ? <Spinner /> : <FileSearch />} Run trace
          </MButton>
          <MButton variant="outline" onClick={() => run("pdf")} disabled={!!busy}>
            {busy === "pdf" ? <Spinner /> : <Download />} PDF
          </MButton>
          <MButton variant="outline" onClick={() => run("xlsx")} disabled={!!busy}>
            {busy === "xlsx" ? <Spinner /> : <Download />} XLSX
          </MButton>
        </div>
        <FormError message={error} />
      </Card>
      {report && <ReportView r={report} />}
    </div>
  );
}

export function RetentionView() {
  const [gap, setGap] = useState(90);
  const q = useQuery({
    queryKey: ["isp", "compliance", "retention", gap],
    queryFn: () => ipdrLeaService.retention(gap),
    retry: retryUnless4xx,
  });
  const cov = useQuery({
    queryKey: ["isp", "compliance", "ipdr-coverage"],
    queryFn: () => ipdrLeaService.coverage(),
    retry: retryUnless4xx,
  });
  if (ispErrorStatus(q.error) === 404) return <Off />;
  return (
    <div className="space-y-4">
      <Card
        title="Log retention"
        actions={
          <select
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
            value={gap}
            aria-label="Gap window"
            onChange={(e) => setGap(Number(e.target.value))}
          >
            <option value={30}>Gaps: last 30 days</option>
            <option value={90}>Gaps: last 90 days</option>
            <option value={365}>Gaps: last 365 days</option>
          </select>
        }
      >
        {q.isLoading ? (
          <LoadingBlock />
        ) : q.error || !q.data ? (
          <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="retention" />
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              Target: {q.data.target_days} days (2 years). {q.data.up_basis} These tables are never
              pruned: {q.data.never_pruned.join(", ")}.
            </p>
            <MTable
              head={
                <>
                  <MTh>Router</MTh>
                  <MTh>Oldest NAT row</MTh>
                  <MTh>Oldest session</MTh>
                  <MTh>Held</MTh>
                  <MTh>Target</MTh>
                  <MTh>Days with no NAT rows while up</MTh>
                </>
              }
            >
              {q.data.routers.map((r) => (
                <MTr key={r.isp_router_id}>
                  <MTd className="text-xs font-medium">{r.router_name}</MTd>
                  <MTd className="text-xs">{r.oldest_nat_ist ?? "None yet"}</MTd>
                  <MTd className="text-xs">{r.oldest_session_ist ?? "None yet"}</MTd>
                  <MTd className="text-xs tabular-nums">
                    {r.nat_days_held ?? "–"} / {r.session_days_held ?? "–"} d
                  </MTd>
                  <MTd>
                    <MTag
                      label={
                        r.target_met
                          ? "Met"
                          : r.days_to_target === null
                            ? "No data"
                            : `${r.days_to_target} d to go`
                      }
                      tone={r.target_met ? "online" : "pending"}
                    />
                  </MTd>
                  <MTd className="text-xs">
                    {r.zero_row_day_count === 0 ? (
                      "None"
                    ) : (
                      <span title={r.zero_row_days.join(", ")}>
                        {r.zero_row_day_count} ({r.zero_row_days.slice(-3).join(", ")}
                        {r.zero_row_day_count > 3 ? ", …" : ""})
                      </span>
                    )}
                  </MTd>
                </MTr>
              ))}
            </MTable>
          </>
        )}
      </Card>
      <Card title="IPDR field coverage">
        {cov.isLoading ? (
          <LoadingBlock />
        ) : cov.error || !cov.data ? (
          <ErrorBlock error={cov.error} onRetry={() => cov.refetch()} what="field coverage" />
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">{cov.data.note}</p>
            <MTable
              head={
                <>
                  <MTh>Field</MTh>
                  <MTh>Status</MTh>
                  <MTh>Where it comes from</MTh>
                </>
              }
            >
              {cov.data.fields.map((x) => (
                <MTr key={x.field}>
                  <MTd className="text-xs font-medium">{x.field}</MTd>
                  <MTd>
                    <MTag
                      label={x.status.replace(/_/g, " ")}
                      tone={
                        x.status === "available"
                          ? "online"
                          : x.status === "partial"
                            ? "pending"
                            : "normal"
                      }
                    />
                  </MTd>
                  <MTd className="text-xs">{x.source}</MTd>
                </MTr>
              ))}
            </MTable>
          </>
        )}
      </Card>
    </div>
  );
}
