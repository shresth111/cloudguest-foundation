/** One incident: timeline, status (investigating -> identified ->
 * resolved, with the reason for outage), the affected subscribers, the
 * broadcast (WhatsApp automation only; otherwise share links + CSV, nothing
 * sent), and optional grace after it is resolved (dry run first). */
import { useState } from "react";
import { toast } from "sonner";
import { Download, MessageCircle, RefreshCw } from "lucide-react";
import {
  MButton,
  MDrawer,
  MField,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, FormError, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useIncident, useIncidentsMutation } from "@/hooks/isp-partner/useIncidents";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  EVENT_LABEL,
  RFO_LABEL,
  RFO_REASONS,
  STATUS_LABEL,
  formatMinutes,
  graceHoursError,
  nextStatuses,
  statusTone,
} from "@/lib/isp-partner/incidents";
import { incidentsService } from "@/services/isp-partner/incidents";
import type {
  BroadcastKind,
  BroadcastResult,
  GraceResult,
  IncidentDetail,
  RfoReason,
} from "@/services/isp-partner/incidents-types";

export function IncidentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useIncident(id);
  const d = q.data;
  return (
    <MDrawer
      open
      onClose={onClose}
      title={d ? `${d.code} · ${d.title}` : "Incident"}
      subtitle={d?.scope_label}
    >
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this incident" />
      ) : !d ? (
        <LoadingBlock />
      ) : (
        <Body d={d} />
      )}
    </MDrawer>
  );
}

function Body({ d }: { d: IncidentDetail }) {
  const { can } = usePartner();
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <MTag label={STATUS_LABEL[d.status]} tone={statusTone(d.status)} />
        <span className="text-xs text-muted-foreground">
          Since {formatDateTime(d.started_at)} · {formatMinutes(d.duration_minutes)}
        </span>
      </div>
      {d.rfo_label && (
        <p>
          <span className="text-muted-foreground">Reason for outage:</span> {d.rfo_label}
          {d.rfo_note ? ` – ${d.rfo_note}` : ""}
        </p>
      )}
      {can("isp_incidents.manage") && <StatusForm d={d} />}
      {can("isp_incidents.execute") && <BroadcastCard d={d} />}
      {can("isp_incidents.execute") && can("isp_subscribers.update") && d.status === "resolved" && (
        <GraceCard d={d} />
      )}
      <Affected d={d} />
      <Timeline d={d} />
    </div>
  );
}

function StatusForm({ d }: { d: IncidentDetail }) {
  const next = nextStatuses(d.status);
  const [to, setTo] = useState<"identified" | "resolved" | "">(next[0] ?? "");
  const [rfo, setRfo] = useState<RfoReason | "">("");
  const [rfoNote, setRfoNote] = useState("");
  const [note, setNote] = useState("");
  const status = useIncidentsMutation(() =>
    incidentsService.setStatus(d.id, {
      status: to as "identified" | "resolved",
      note: note.trim() || undefined,
      rfo_reason: rfo || undefined,
      rfo_note: rfoNote.trim() || undefined,
    }),
  );
  const addNote = useIncidentsMutation(() => incidentsService.addNote(d.id, note.trim()));
  const refresh = useIncidentsMutation(() => incidentsService.refresh(d.id));
  const needRfo = to === "resolved" && !rfo;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <MField label="Note">
        <textarea
          className={M_INPUT}
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </MField>
      {next.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <MField label="Move to">
            <select
              className={M_INPUT}
              value={to}
              onChange={(e) => setTo(e.target.value as "identified" | "resolved")}
            >
              {next.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </MField>
          {to === "resolved" && (
            <MField label="Reason for outage">
              <select
                className={M_INPUT}
                value={rfo}
                onChange={(e) => setRfo(e.target.value as RfoReason | "")}
              >
                <option value="">Pick one</option>
                {RFO_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {RFO_LABEL[r]}
                  </option>
                ))}
              </select>
            </MField>
          )}
        </div>
      )}
      {to === "resolved" && (
        <MField label="What was done (optional)">
          <input
            className={M_INPUT}
            maxLength={2000}
            value={rfoNote}
            onChange={(e) => setRfoNote(e.target.value)}
          />
        </MField>
      )}
      <FormError
        message={
          status.error || addNote.error || refresh.error
            ? ispErrorMessage(status.error ?? addNote.error ?? refresh.error)
            : null
        }
      />
      <div className="flex flex-wrap gap-2">
        {next.length > 0 && (
          <MButton
            disabled={!to || needRfo || status.isPending}
            onClick={() =>
              status.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`Marked ${STATUS_LABEL[to as "resolved"].toLowerCase()}`);
                  setNote("");
                },
              })
            }
          >
            Update status
          </MButton>
        )}
        <MButton
          variant="outline"
          disabled={!note.trim() || addNote.isPending}
          onClick={() => addNote.mutate(undefined, { onSuccess: () => setNote("") })}
        >
          Add note only
        </MButton>
        {d.status !== "resolved" && (
          <MButton
            variant="ghost"
            disabled={refresh.isPending}
            onClick={() =>
              refresh.mutate(undefined, {
                onSuccess: (x) => toast.success(`${x.affected_total} affected`),
              })
            }
          >
            <RefreshCw /> Re-check affected
          </MButton>
        )}
      </div>
    </div>
  );
}

function BroadcastCard({ d }: { d: IncidentDetail }) {
  const kind: BroadcastKind = d.status === "resolved" ? "restored" : "outage";
  const [res, setRes] = useState<BroadcastResult | null>(null);
  const run = useIncidentsMutation((dry: boolean) => incidentsService.broadcast(d.id, kind, dry));
  const csv = async () => {
    try {
      const f = await incidentsService.affectedCsv(d.id, d.code);
      saveBlob(f.blob, f.filename);
    } catch (err) {
      toast.error(ispErrorMessage(err, "Could not download the list."));
    }
  };
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">
          {kind === "outage" ? "Tell affected subscribers" : "Tell them it is back"}
        </h4>
        <div className="flex gap-2">
          <MButton
            variant="outline"
            disabled={run.isPending}
            onClick={() => run.mutate(true, { onSuccess: setRes })}
          >
            <MessageCircle /> Check
          </MButton>
          <MButton variant="ghost" onClick={csv}>
            <Download /> CSV
          </MButton>
        </div>
      </div>
      <FormError message={run.error ? ispErrorMessage(run.error) : null} />
      {res && (
        <div className="space-y-2 text-xs">
          <p>
            {res.recipients} will get it · {res.no_consent} have not opted in to WhatsApp ·{" "}
            {res.no_phone} without a mobile · {res.already} already told
          </p>
          {res.mode === "whatsapp" ? (
            res.dry_run ? (
              <MButton
                disabled={!res.recipients || run.isPending}
                onClick={() =>
                  run.mutate(false, {
                    onSuccess: (r) => {
                      setRes(r);
                      toast.success(`${r.sent} sent, ${r.failed} failed`);
                    },
                  })
                }
              >
                Send on WhatsApp to {res.recipients}
              </MButton>
            ) : (
              <p className="font-medium">
                {res.sent} sent, {res.failed} failed. Delivery shows in the message log.
              </p>
            )
          ) : (
            <>
              <div className="rounded-md bg-muted p-2">
                Nothing is sent from here: {res.unavailable_reasons.join("; ")}. Use the links below
                or the CSV.
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{res.message}</p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                {res.share.map((s) => (
                  <li key={s.subscriber_id}>
                    <a
                      className="text-primary underline"
                      href={s.whatsapp_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.label}
                    </a>{" "}
                    <span className="text-muted-foreground">{s.phone}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GraceCard({ d }: { d: IncidentDetail }) {
  const [hours, setHours] = useState(String(d.suggested_grace_hours));
  const [res, setRes] = useState<GraceResult | null>(null);
  const h = Number(hours);
  const err = graceHoursError(h);
  const run = useIncidentsMutation((dry: boolean) => incidentsService.grace(d.id, h, dry));
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <h4 className="font-semibold">Grace for the outage (optional)</h4>
      <p className="text-xs text-muted-foreground">
        Extends each affected subscriber&apos;s validity once, using the subscriber Grace action.
        Suggested: the outage length rounded up.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <MField label="Hours">
          <input
            className={M_INPUT}
            inputMode="numeric"
            value={hours}
            onChange={(e) => {
              setHours(e.target.value);
              setRes(null);
            }}
          />
        </MField>
        <MButton
          variant="outline"
          disabled={!!err || run.isPending}
          onClick={() => run.mutate(true, { onSuccess: setRes })}
        >
          Dry run
        </MButton>
        {res?.dry_run && (
          <MButton
            disabled={!res.eligible || run.isPending}
            onClick={() =>
              run.mutate(false, {
                onSuccess: (r) => {
                  setRes(r);
                  toast.success(`Grace given to ${r.applied}`);
                },
              })
            }
          >
            Give {h} h to {res.eligible}
          </MButton>
        )}
      </div>
      <FormError message={err ?? (run.error ? ispErrorMessage(run.error) : null)} />
      {res && (
        <p className="text-xs">
          {res.dry_run
            ? `${res.eligible} would get ${res.hours} h; ${res.skipped.length} skipped.`
            : `${res.applied} given ${res.hours} h; ${res.failed.length} could not be.`}
        </p>
      )}
    </div>
  );
}

function Affected({ d }: { d: IncidentDetail }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold">
        Affected ({d.affected_visible}
        {d.affected_visible !== d.affected_total ? ` of ${d.affected_total}` : ""})
      </h4>
      {d.affected.length === 0 ? (
        <p className="text-xs text-muted-foreground">No subscribers found behind it.</p>
      ) : (
        <MTable
          head={
            <>
              <MTh>Subscriber</MTh>
              <MTh>Where</MTh>
              <MTh>Told</MTh>
            </>
          }
        >
          {d.affected.slice(0, 200).map((a) => (
            <MTr key={a.subscriber_id}>
              <MTd>
                <div>{a.label ?? "–"}</div>
                <div className="text-xs text-muted-foreground">
                  {[a.identifier, a.customer_name].filter(Boolean).join(" · ")}
                </div>
              </MTd>
              <MTd className="text-xs">
                {a.node_name ? `${a.node_name}${a.port_no ? ` port ${a.port_no}` : ""}` : a.source}
                {a.grace_status && <div>Grace: {a.grace_detail ?? a.grace_status}</div>}
              </MTd>
              <MTd className="text-xs">
                {[
                  a.outage_message && `outage ${a.outage_message}`,
                  a.restored_message && `restored ${a.restored_message}`,
                ]
                  .filter(Boolean)
                  .join(", ") || "–"}
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
    </div>
  );
}

function Timeline({ d }: { d: IncidentDetail }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold">Timeline</h4>
      <ol className="space-y-2">
        {d.events.map((e) => (
          <li key={e.id} className="border-l-2 border-border pl-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="font-medium">
                {EVENT_LABEL[e.kind] ?? e.kind}
                {e.status ? `: ${STATUS_LABEL[e.status]}` : ""}
              </span>
              <span className="text-muted-foreground">{formatDateTime(e.at)}</span>
              {e.actor && <span className="text-muted-foreground">· {e.actor}</span>}
            </div>
            {e.body && <p className="mt-0.5 whitespace-pre-wrap text-xs">{e.body}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
