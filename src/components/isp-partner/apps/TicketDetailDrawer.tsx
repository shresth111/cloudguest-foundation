/** One ticket (Apps -> Helpdesk): status (reason for outage on resolve when
 * the type asks for one), priority, type, assignee, and the comment thread. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MButton, MDrawer, M_INPUT } from "@/components/master/MasterKit";
import { ErrorBlock, FormError, LoadingBlock, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  AssigneeSelect,
  Select,
  StatusTag,
  appsKeys,
  useAppsMutation,
} from "@/components/isp-partner/apps/appsKit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  DONE_TICKET,
  RFO_LABEL,
  TICKET_STATUS_LABEL,
  appsCan,
  humanize,
  minutesText,
  needsRfo,
  slaText,
  ticketStatusBody,
} from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import {
  RFO_REASONS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketDetail,
  type TicketPatch,
  type TicketTypeFull,
} from "@/services/isp-partner/apps-types";

export function TicketDetailDrawer({
  ticketId,
  types,
  onClose,
}: {
  ticketId: string;
  types: TicketTypeFull[];
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: appsKeys.one("ticket", ticketId),
    queryFn: () => appsService.ticket(ticketId),
    retry: false,
  });
  return (
    <MDrawer
      open
      onClose={onClose}
      title={q.data ? `${q.data.number} · ${q.data.subject}` : "Ticket"}
    >
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this ticket" />
      ) : (
        <Body key={`${q.data.status}-${q.data.events.length}`} t={q.data} types={types} />
      )}
    </MDrawer>
  );
}

function Body({ t, types }: { t: TicketDetail; types: TicketTypeFull[] }) {
  const { can } = usePartner();
  const c = appsCan(can);
  const type = types.find((x) => x.id === t.type_id);
  const [target, setTarget] = useState(t.status);
  const [rfo, setRfo] = useState(t.rfo_reason ?? "");
  const [note, setNote] = useState(t.resolution_note ?? "");
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const patch = useAppsMutation((body: TicketPatch) => appsService.patchTicket(t.id, body));
  const addComment = useAppsMutation((body: string) => appsService.comment(t.id, body));
  const send = async (body: TicketPatch, ok: string) => {
    setErr(null);
    try {
      await patch.mutateAsync(body);
      toast.success(ok);
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <StatusTag map={TICKET_STATUS_LABEL} value={t.status} />
        </dd>
        <dt className="text-muted-foreground">Customer</dt>
        <dd>
          {t.customer_name ?? "–"}
          {t.subscriber_label ? ` · ${t.subscriber_label}` : ""}
        </dd>
        <dt className="text-muted-foreground">Opened</dt>
        <dd>
          {formatDateTime(t.opened_at)} via {humanize(t.source)}
        </dd>
        <dt className="text-muted-foreground">SLA</dt>
        <dd className={t.sla_state === "breached" ? "text-rose-600 dark:text-rose-400" : ""}>
          {slaText(t)}
          {t.tat_minutes !== null && ` · turnaround ${minutesText(t.tat_minutes)}`}
        </dd>
        {t.rfo_reason && (
          <>
            <dt className="text-muted-foreground">Reason for outage</dt>
            <dd>{RFO_LABEL[t.rfo_reason] ?? humanize(t.rfo_reason)}</dd>
          </>
        )}
        {t.description && (
          <>
            <dt className="text-muted-foreground">Description</dt>
            <dd className="whitespace-pre-wrap">{t.description}</dd>
          </>
        )}
      </dl>

      {c.update && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Priority</span>
              <Select
                ariaLabel="Priority"
                value={t.priority}
                onChange={(v) =>
                  send({ priority: v as TicketPatch["priority"] }, "Priority changed.")
                }
                options={TICKET_PRIORITIES.map((p) => [p, humanize(p)] as [string, string])}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <Select
                ariaLabel="Type"
                value={t.type_id ?? ""}
                onChange={(v) => send({ type_id: v || null }, "Type changed.")}
                options={[["", "No type"], ...types.map((x) => [x.id, x.name] as [string, string])]}
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Assignee</span>
              <AssigneeSelect
                value={t.assignee_user_id ?? ""}
                onChange={(v) => send({ assignee_user_id: v || null }, "Assigned.")}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Move to</span>
              <Select
                ariaLabel="Status"
                value={target}
                onChange={setTarget}
                options={TICKET_STATUSES.map(
                  (s) => [s, TICKET_STATUS_LABEL[s]] as [string, string],
                )}
              />
            </label>
            {DONE_TICKET.has(target) && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Reason for outage{needsRfo(type) ? " (required)" : ""}
                </span>
                <Select
                  ariaLabel="Reason for outage"
                  value={rfo}
                  onChange={setRfo}
                  options={[
                    ["", "Pick…"],
                    ...RFO_REASONS.map((r) => [r, RFO_LABEL[r]] as [string, string]),
                  ]}
                />
              </label>
            )}
            {DONE_TICKET.has(target) && (
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Resolution note</span>
                <textarea
                  className={`${M_INPUT} min-h-[56px]`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            )}
          </div>
          <MButton
            disabled={patch.isPending || target === t.status}
            onClick={() => {
              const r = ticketStatusBody(target, t, type, rfo, note);
              if ("error" in r) return setErr(r.error);
              send(r.body, `Ticket ${TICKET_STATUS_LABEL[target]?.toLowerCase() ?? target}.`);
            }}
          >
            {patch.isPending && <Spinner />} Update status
          </MButton>
        </div>
      )}
      <FormError message={err} />

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">History</h4>
        <ol className="space-y-2">
          {t.events.map((e, i) => (
            <li key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                {formatDateTime(e.at)} · {e.actor_name ?? "System"} · {humanize(e.kind)}
              </span>
              {e.body && <p className="mt-1 whitespace-pre-wrap text-sm">{e.body}</p>}
            </li>
          ))}
        </ol>
        {c.update && (
          <div className="space-y-2">
            <textarea
              className={`${M_INPUT} min-h-[64px]`}
              placeholder="Add a comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <MButton
              variant="outline"
              disabled={addComment.isPending || !comment.trim()}
              onClick={async () => {
                setErr(null);
                try {
                  await addComment.mutateAsync(comment.trim());
                  setComment("");
                } catch (e) {
                  setErr(ispErrorMessage(e));
                }
              }}
            >
              {addComment.isPending && <Spinner />} Comment
            </MButton>
          </div>
        )}
      </div>
    </div>
  );
}
