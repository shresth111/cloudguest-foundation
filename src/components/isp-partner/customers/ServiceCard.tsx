/**
 * Customer "Service" card (ADDENDUM_01 §A, FE task list in §A.10).
 *
 * Suspending a customer now CUTS ITS GUESTS' INTERNET: its routers' RADIUS
 * clients are disabled on the platform hub and live sessions are kicked.
 * The confirm says exactly that, with the number of locations affected. The
 * per-router steps, warnings and the count of bypass entries that are not
 * cut are shown as the backend sends them. Nothing here claims "done"
 * before the state says so.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  RotateCw,
  XCircle,
} from "lucide-react";
import { MButton, MDialog, MTag, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useResumeService,
  useRetryService,
  useServiceState,
  useSuspendService,
} from "@/hooks/isp-partner/useBilling";
import { newIdempotencyKey } from "@/services/isp-partner/billing";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { SERVICE_STATE_LABEL, serviceTone } from "@/lib/isp-partner/service-state";
import type { ServiceStep, SuspendReason } from "@/services/isp-partner/billing-types";

const REASON_LABEL: Record<SuspendReason, string> = {
  non_payment: "Non-payment",
  customer_request: "Customer asked",
  abuse: "Abuse",
  other: "Other",
};

const STEP_LABEL: Record<string, string> = {
  nas_disable: "Stop guest sign-ins (RADIUS)",
  kick_sessions: "End live guest sessions",
  portal_suspended_page: "Show the 'service paused' page",
  device_fallback: "Router-side block",
  nas_activate: "Allow guest sign-ins again",
  portal_restore: "Restore the normal portal",
  device_fallback_remove: "Remove router-side block",
};

function StepIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-rose-600" />;
  if (status === "skipped")
    return <span className="h-3.5 w-3.5 text-center text-[10px] text-muted-foreground">–</span>;
  return <Clock className="h-3.5 w-3.5 text-amber-500" />;
}

function StepRow({ step }: { step: ServiceStep }) {
  return (
    <li className="flex flex-wrap items-start gap-x-2 gap-y-0.5 text-xs">
      <StepIcon status={step.status} />
      <span className="font-medium">{STEP_LABEL[step.kind] ?? step.kind}</span>
      <span className="text-muted-foreground">
        {step.status}
        {step.attempts > 1 && ` · ${step.attempts} attempts`}
      </span>
      {step.detail && <span className="text-muted-foreground">· {step.detail}</span>}
      {step.last_error && <span className="basis-full pl-5 text-rose-600">{step.last_error}</span>}
    </li>
  );
}

export function ServiceCard({
  customerId,
  customerName,
  locationCount,
}: {
  customerId: string;
  customerName: string;
  locationCount: number;
}) {
  const { can } = usePartner();
  const manage = can("isp_partner.manage");
  const q = useServiceState(customerId);
  const suspend = useSuspendService(customerId);
  const resume = useResumeService(customerId);
  const retry = useRetryService(customerId);
  const [dialog, setDialog] = useState<null | "suspend" | "resume">(null);
  const [reason, setReason] = useState<SuspendReason>("customer_request");
  const [note, setNote] = useState("");
  const [showPage, setShowPage] = useState(true);
  const [key, setKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);

  const open = (d: "suspend" | "resume") => {
    setDialog(d);
    setNote("");
    setError(null);
    setKey(newIdempotencyKey());
  };

  const s = q.data;
  const state = s?.state ?? "active";
  const cutting = state === "suspend_pending" || state === "suspended";
  const hasPending = s?.routers.some((r) =>
    r.steps.some((st) => st.status === "pending" || st.status === "failed"),
  );

  const confirm = async () => {
    setError(null);
    try {
      if (dialog === "suspend") {
        const res = await suspend.mutateAsync({
          body: {
            reason,
            note: note.trim().slice(0, 255) || undefined,
            show_suspended_page: showPage,
          },
          key,
        });
        toast(
          res.state === "suspended"
            ? `${customerName} suspended. Guest internet is cut.`
            : `${customerName}: guest sign-ins stopped; some routers are still being reached.`,
        );
      } else {
        const res = await resume.mutateAsync({ note: note.trim().slice(0, 255), key });
        toast(
          res.state === "active"
            ? `${customerName} resumed. Guests can sign in again.`
            : `${customerName}: resuming; some steps are still running.`,
        );
      }
      setDialog(null);
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };
  const busy = suspend.isPending || resume.isPending;

  return (
    <Card
      title="Service"
      actions={
        s && (
          <>
            <MTag label={SERVICE_STATE_LABEL[state] ?? state} tone={serviceTone(state)} />
            {manage && hasPending && (
              <MButton
                variant="outline"
                disabled={retry.isPending}
                onClick={async () => {
                  try {
                    await retry.mutateAsync();
                  } catch (err) {
                    toast.error(ispErrorMessage(err));
                  }
                }}
              >
                {retry.isPending ? <Spinner /> : <RotateCw />} Retry now
              </MButton>
            )}
            {manage &&
              (cutting ? (
                <MButton onClick={() => open("resume")}>
                  <PlayCircle /> Resume service
                </MButton>
              ) : (
                <MButton
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => open("suspend")}
                >
                  <PauseCircle /> Suspend service
                </MButton>
              ))}
          </>
        )
      }
    >
      {q.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner /> Loading…
        </p>
      ) : q.error || !s ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the service state" />
      ) : (
        <div className="space-y-3 text-sm">
          {state === "active" && !s.requested_at ? (
            <p className="text-muted-foreground">
              Guest internet is on at all of this customer&apos;s locations.
            </p>
          ) : (
            <p className="text-muted-foreground">
              {state === "active"
                ? "Resumed"
                : state === "resume_pending"
                  ? "Resume requested"
                  : "Suspended"}
              {s.reason && ` · ${REASON_LABEL[s.reason as SuspendReason] ?? s.reason}`}
              {s.requested_by && ` · by ${s.requested_by.name}`}
              {s.requested_at && ` · ${formatDateTime(s.requested_at)}`}
              {s.note && ` · “${s.note}”`}
            </p>
          )}
          {s.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
              {s.warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {w}
                </li>
              ))}
            </ul>
          )}
          {s.bypass_entries_not_cut > 0 && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
              {s.bypass_entries_not_cut} bypass entr
              {s.bypass_entries_not_cut === 1 ? "y is" : "ies are"} not cut: those devices skip
              guest sign-in on the router and keep internet.
            </p>
          )}
          {s.routers.length > 0 && (
            <div className="space-y-2">
              {s.routers.map((r) => (
                <div key={r.isp_router_id} className="rounded-lg border border-border p-2.5">
                  <p className="mb-1 flex items-center gap-2 text-xs font-semibold">
                    {r.name}
                    <MTag
                      label={r.online ? "Online" : "Offline"}
                      tone={r.online ? "online" : "offline"}
                    />
                  </p>
                  <ul className="space-y-1">
                    {r.steps.map((st, i) => (
                      <StepRow key={`${st.kind}-${i}`} step={st} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            TR-069 devices stay manageable while suspended (refresh works, reboot is refused); their
            own internet is not cut by this.
          </p>
        </div>
      )}

      <MDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === "suspend" ? `Cut internet for ${customerName}?` : `Resume ${customerName}?`
        }
        footer={
          <>
            <MButton variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </MButton>
            <MButton
              onClick={confirm}
              disabled={busy}
              className={
                dialog === "suspend" ? "bg-destructive text-destructive-foreground" : undefined
              }
            >
              {busy && <Spinner />}{" "}
              {dialog === "suspend" ? "Suspend and cut internet" : "Resume service"}
            </MButton>
          </>
        }
      >
        {dialog === "suspend" ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 font-medium text-foreground">
              Guests at {locationCount} location{locationCount === 1 ? "" : "s"} lose internet now.
              New sign-ins are refused and connected guests are disconnected.
            </p>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Reason</span>
              <select
                className={M_INPUT}
                value={reason}
                onChange={(e) => setReason(e.target.value as SuspendReason)}
              >
                {(Object.keys(REASON_LABEL) as SuspendReason[]).map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Note (optional)</span>
              <input
                className={M_INPUT}
                maxLength={255}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPage}
                onChange={(e) => setShowPage(e.target.checked)}
              />
              Show guests a &quot;service paused, contact your ISP&quot; page
            </label>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Guest sign-ins are allowed again at every location and the normal portal comes back.
            </p>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Note (optional)</span>
              <input
                className={M_INPUT}
                maxLength={255}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="mt-3">
          <FormError message={error} />
        </div>
      </MDialog>
    </Card>
  );
}
