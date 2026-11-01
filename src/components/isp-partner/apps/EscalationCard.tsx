/** Helpdesk escalation (APPS-2): rules ("open longer than N hours ->
 * a role and/or a staff member, plus a Telegram notice when Telegram alerts
 * are on") and the log of what was escalated. The backend checks every two
 * minutes and escalates each ticket once per rule. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { MButton, MTable, MTag, MTd, MTh, MTr, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, Pager, Spinner } from "@/components/isp-partner/kit";
import {
  AssigneeSelect,
  Select,
  appsKeys,
  useAppsMutation,
} from "@/components/isp-partner/apps/appsKit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  ISP_ROLE_LABEL,
  TELEGRAM_STATUS_LABEL,
  escalationRuleBody,
  humanize,
  minutesText,
} from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import {
  TICKET_PRIORITIES,
  type EscalationRuleBody,
  type TicketTypeFull,
} from "@/services/isp-partner/apps-types";

export function EscalationCard({
  types,
  canManage,
}: {
  types: TicketTypeFull[];
  canManage: boolean;
}) {
  const rules = useQuery({
    queryKey: appsKeys.list("escalation-rules"),
    queryFn: () => appsService.escalationRules(),
    retry: false,
  });
  const [page, setPage] = useState(1);
  const log = useQuery({
    queryKey: appsKeys.list("escalations", { page }),
    queryFn: () => appsService.escalations(page),
    retry: false,
    refetchInterval: 60_000,
  });
  const [d, setD] = useState({
    name: "",
    hours: "4",
    type_id: "",
    priority: "",
    role: "isp-noc",
    user: "",
    telegram: true,
  });
  const [err, setErr] = useState<string | null>(null);
  const create = useAppsMutation((body: EscalationRuleBody) =>
    appsService.createEscalationRule(body),
  );
  const patch = useAppsMutation((v: { id: string; body: EscalationRuleBody }) =>
    appsService.patchEscalationRule(v.id, v.body),
  );
  const del = useAppsMutation((id: string) => appsService.deleteEscalationRule(id));
  const typeName = (id: string | null) =>
    id ? (types.find((t) => t.id === id)?.name ?? "Type") : "Any type";
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };
  return (
    <div className="space-y-4">
      <Card title="Escalation rules">
        {rules.error ? (
          <ErrorBlock error={rules.error} what="escalation rules" />
        ) : (
          <MTable
            loading={rules.isLoading}
            head={
              <>
                <MTh>Rule</MTh>
                <MTh>Applies to</MTh>
                <MTh>Open longer than</MTh>
                <MTh>Escalate to</MTh>
                <MTh>Telegram</MTh>
                <MTh>Active</MTh>
                <MTh />
              </>
            }
          >
            {(rules.data ?? []).map((r) => (
              <MTr key={r.id}>
                <MTd>{r.name}</MTd>
                <MTd className="text-xs">
                  {typeName(r.type_id)}
                  {r.priority ? ` · ${humanize(r.priority)}` : ""}
                </MTd>
                <MTd className="text-xs">{minutesText(r.after_minutes)}</MTd>
                <MTd className="text-xs">
                  {[
                    r.escalate_to_role
                      ? (ISP_ROLE_LABEL[r.escalate_to_role] ?? r.escalate_to_role)
                      : null,
                    r.escalate_to_name,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "–"}
                </MTd>
                <MTd>
                  <input
                    type="checkbox"
                    aria-label={`${r.name} Telegram`}
                    checked={r.notify_telegram}
                    disabled={!canManage}
                    onChange={(e) =>
                      act(
                        () =>
                          patch.mutateAsync({
                            id: r.id,
                            body: { notify_telegram: e.target.checked },
                          }),
                        "Saved.",
                      )
                    }
                  />
                </MTd>
                <MTd>
                  <input
                    type="checkbox"
                    aria-label={`${r.name} active`}
                    checked={r.active}
                    disabled={!canManage}
                    onChange={(e) =>
                      act(
                        () => patch.mutateAsync({ id: r.id, body: { active: e.target.checked } }),
                        "Saved.",
                      )
                    }
                  />
                </MTd>
                <MTd className="text-right">
                  {canManage && (
                    <MButton
                      variant="ghost"
                      title="Delete"
                      aria-label={`Delete ${r.name}`}
                      onClick={() => act(() => del.mutateAsync(r.id), "Rule deleted.")}
                    >
                      <Trash2 />
                    </MButton>
                  )}
                </MTd>
              </MTr>
            ))}
          </MTable>
        )}
        {canManage && (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
            <input
              className={M_INPUT}
              placeholder="Rule name"
              value={d.name}
              onChange={(e) => setD({ ...d, name: e.target.value })}
              aria-label="Rule name"
            />
            <input
              className={M_INPUT}
              placeholder="Open longer than (hours)"
              value={d.hours}
              onChange={(e) => setD({ ...d, hours: e.target.value })}
              aria-label="Hours"
            />
            <Select
              ariaLabel="Ticket type"
              value={d.type_id}
              onChange={(v) => setD({ ...d, type_id: v })}
              options={[["", "Any type"], ...types.map((t) => [t.id, t.name] as [string, string])]}
            />
            <Select
              ariaLabel="Priority"
              value={d.priority}
              onChange={(v) => setD({ ...d, priority: v })}
              options={[
                ["", "Any priority"],
                ...TICKET_PRIORITIES.map((p) => [p, humanize(p)] as [string, string]),
              ]}
            />
            <Select
              ariaLabel="Role"
              value={d.role}
              onChange={(v) => setD({ ...d, role: v })}
              options={[["", "No role"], ...Object.entries(ISP_ROLE_LABEL)]}
            />
            <AssigneeSelect
              value={d.user}
              onChange={(v) => setD({ ...d, user: v })}
              ariaLabel="Staff member"
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={d.telegram}
                onChange={(e) => setD({ ...d, telegram: e.target.checked })}
              />
              Telegram notice (when Telegram alerts are on)
            </label>
            <MButton
              disabled={create.isPending}
              onClick={() => {
                const r = escalationRuleBody(d);
                if ("error" in r) return setErr(r.error);
                act(async () => {
                  await create.mutateAsync(r.body);
                  setD({ ...d, name: "" });
                }, "Rule added.");
              }}
            >
              {create.isPending && <Spinner />} Add rule
            </MButton>
          </div>
        )}
        <FormError message={err} />
      </Card>
      <Card title="Escalated tickets">
        {log.error ? (
          <ErrorBlock error={log.error} what="escalations" />
        ) : (log.data?.items.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing has been escalated.</p>
        ) : (
          <>
            <MTable
              head={
                <>
                  <MTh>When</MTh>
                  <MTh>Ticket</MTh>
                  <MTh>Rule</MTh>
                  <MTh>To</MTh>
                  <MTh>Telegram</MTh>
                </>
              }
            >
              {(log.data?.items ?? []).map((e) => (
                <MTr key={e.id}>
                  <MTd className="text-xs">{formatDateTime(e.escalated_at)}</MTd>
                  <MTd className="text-xs">
                    <span className="font-mono">{e.ticket_number}</span> {e.subject}
                    <p className="text-muted-foreground">{e.customer_name}</p>
                  </MTd>
                  <MTd className="text-xs">{e.rule_name}</MTd>
                  <MTd className="text-xs">
                    {[e.to_role ? (ISP_ROLE_LABEL[e.to_role] ?? e.to_role) : null, e.to_user_name]
                      .filter(Boolean)
                      .join(" · ") || "–"}
                  </MTd>
                  <MTd>
                    <MTag
                      label={TELEGRAM_STATUS_LABEL[e.telegram_status] ?? e.telegram_status}
                      tone={
                        e.telegram_status === "failed"
                          ? "failed"
                          : e.telegram_status === "sent"
                            ? "active"
                            : "normal"
                      }
                    />
                  </MTd>
                </MTr>
              ))}
            </MTable>
            {log.data && log.data.pages > 1 && (
              <Pager
                page={log.data.page}
                pages={log.data.pages}
                total={log.data.total}
                onPage={setPage}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
