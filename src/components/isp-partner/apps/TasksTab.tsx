/** Apps -> Tasks: field work (installs, repairs, surveys, removals).
 * Unclaimed / mine / all, claim, move through the allowed states, complete
 * with a note, reject with a reason. Allowed moves come from
 * `taskNext` (the backend's transition map); a state the API adds later
 * just shows with no buttons until the map knows it. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Hand, Plus } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSeg,
  MTable,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  CustomerSelect,
  ErrorBlock,
  FormError,
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  AssigneeSelect,
  CsvButton,
  Select,
  StatusTag,
  appsKeys,
  useAppsMutation,
} from "@/components/isp-partner/apps/appsKit";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  TASK_STATUS_LABEL,
  appsCan,
  canDecideTask,
  humanize,
  taskNext,
  taskQuery,
  taskStatusBody,
  type TaskView as TaskTab,
} from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import { TASK_KINDS, type TaskBody, type TaskView } from "@/services/isp-partner/apps-types";

export function TasksTab() {
  const { can, me } = usePartner();
  const c = appsCan(can);
  const [view, setView] = useState<TaskTab>("unclaimed");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<TaskView | null>(null);
  const [deciding, setDeciding] = useState<TaskView | null>(null);
  const q = taskQuery(view, { kind: (kind || undefined) as TaskBody["kind"], page, page_size: 25 });
  const list = useQuery({
    queryKey: appsKeys.list("tasks", q),
    queryFn: () => appsService.tasks(q),
    retry: false,
    refetchInterval: 60_000,
  });
  const claim = useAppsMutation((id: string) => appsService.claimTask(id));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MSeg<TaskTab>
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(1);
          }}
          options={[
            { value: "unclaimed", label: "Unclaimed" },
            { value: "mine", label: "Mine" },
            { value: "approval", label: "Awaiting approval" },
            { value: "all", label: "All" },
          ]}
        />
        <Select
          className="w-auto"
          ariaLabel="Kind"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPage(1);
          }}
          options={[
            ["", "Any kind"],
            ...TASK_KINDS.map((k) => [k, humanize(k)] as [string, string]),
          ]}
        />
        <div className="ml-auto flex gap-2">
          {c.export && <CsvButton run={() => appsService.tasksCsv(q)} />}
          {c.create && (
            <MButton onClick={() => setCreating(true)}>
              <Plus /> New task
            </MButton>
          )}
        </div>
      </div>
      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="tasks" />
      ) : list.data && list.data.items.length === 0 ? (
        <MEmptyState
          icon={ClipboardList}
          title="No tasks here"
          description="Change the view or add a task."
        />
      ) : (
        <>
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>Task</MTh>
                <MTh>Where</MTh>
                <MTh>When</MTh>
                <MTh>Status</MTh>
                <MTh>Assignee</MTh>
                <MTh />
              </>
            }
          >
            {(list.data?.items ?? []).map((t) => (
              <MTr key={t.id}>
                <MTd>
                  <span className="text-sm">{t.title}</span>
                  <p className="text-[11px] text-muted-foreground">{humanize(t.kind)}</p>
                </MTd>
                <MTd className="text-xs">
                  {t.customer_name ?? "–"}
                  {t.address && <p className="text-muted-foreground">{t.address}</p>}
                </MTd>
                <MTd className="text-xs">
                  {t.scheduled_at ? formatDateTime(t.scheduled_at) : "Not scheduled"}
                </MTd>
                <MTd>
                  <StatusTag map={TASK_STATUS_LABEL} value={t.status} />
                </MTd>
                <MTd className="text-xs">{t.assignee_name ?? "–"}</MTd>
                <MTd className="text-right">
                  {c.update && t.status === "unclaimed" && (
                    <MButton
                      variant="outline"
                      disabled={claim.isPending}
                      onClick={async () => {
                        try {
                          await claim.mutateAsync(t.id);
                          toast.success("Claimed. It is in Mine.");
                        } catch (e) {
                          ispToastError(e);
                        }
                      }}
                    >
                      <Hand /> Claim
                    </MButton>
                  )}
                  {c.update &&
                    taskNext(t.status).length > 0 &&
                    (t.status !== "unclaimed" || c.manage) && (
                      <MButton variant="ghost" onClick={() => setActing(t)}>
                        Update
                      </MButton>
                    )}
                  {c.manage && canDecideTask(t.status) && (
                    <MButton variant="outline" onClick={() => setDeciding(t)}>
                      Review
                    </MButton>
                  )}
                  {t.approval?.decision === "rejected" && t.status !== "completed" && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      Sent back: {t.rejected_reason}
                    </p>
                  )}
                </MTd>
              </MTr>
            ))}
          </MTable>
          {list.data && list.data.pages > 1 && (
            <Pager
              page={list.data.page}
              pages={list.data.pages}
              total={list.data.total}
              onPage={setPage}
            />
          )}
        </>
      )}
      {creating && <TaskDialog onClose={() => setCreating(false)} />}
      {acting && (
        <TaskStatusDialog task={acting} meId={me.user.id} onClose={() => setActing(null)} />
      )}
      {deciding && <TaskReviewDialog task={deciding} onClose={() => setDeciding(null)} />}
    </div>
  );
}

function TaskDialog({ onClose }: { onClose: () => void }) {
  const customers = useIspCustomerOptions();
  const [f, setF] = useState({
    kind: "install",
    title: "",
    customer: "",
    address: "",
    when: "",
    assignee: "",
    notes: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const create = useAppsMutation(() =>
    appsService.createTask({
      kind: f.kind as TaskBody["kind"],
      title: f.title.trim(),
      isp_customer_id: f.customer || null,
      address: f.address.trim() || null,
      scheduled_at: f.when ? new Date(f.when).toISOString() : null,
      assignee_user_id: f.assignee || null,
      notes: f.notes.trim() || null,
    }),
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title="New task"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={create.isPending}
            onClick={async () => {
              setErr(null);
              if (!f.title.trim()) return setErr("Give the task a title.");
              try {
                await create.mutateAsync(undefined);
                toast.success("Task added.");
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {create.isPending && <Spinner />} Add task
          </MButton>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <Select
          ariaLabel="Kind"
          value={f.kind}
          onChange={set("kind")}
          options={TASK_KINDS.map((k) => [k, humanize(k)] as [string, string])}
        />
        <TextField label="Title" required value={f.title} onChange={set("title")} />
        <CustomerSelect
          value={f.customer}
          onChange={set("customer")}
          customers={customers.data}
          allLabel="No customer"
        />
        <TextField label="Address" value={f.address} onChange={set("address")} />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">When</span>
          <input
            type="datetime-local"
            className={M_INPUT}
            value={f.when}
            onChange={(e) => set("when")(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Assign to</span>
          <AssigneeSelect value={f.assignee} onChange={set("assignee")} />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Notes</span>
          <textarea
            className={`${M_INPUT} min-h-[56px]`}
            value={f.notes}
            onChange={(e) => set("notes")(e.target.value)}
          />
        </label>
      </div>
      <FormError message={err} />
    </MDialog>
  );
}

function TaskStatusDialog({
  task,
  meId,
  onClose,
}: {
  task: TaskView;
  meId: string;
  onClose: () => void;
}) {
  const next = taskNext(task.status);
  const [target, setTarget] = useState(next[0] ?? "");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const save = useAppsMutation((body: TaskBody) => appsService.patchTask(task.id, body));
  return (
    <MDialog
      open
      onClose={onClose}
      title={task.title}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={save.isPending || !target}
            onClick={async () => {
              setErr(null);
              const r = taskStatusBody(target, note, reason);
              if ("error" in r) return setErr(r.error);
              const body: TaskBody = r.body as TaskBody;
              if (target === "assigned" && !task.assignee_user_id) body.assignee_user_id = meId;
              try {
                await save.mutateAsync(body);
                toast.success(`Task ${TASK_STATUS_LABEL[target]?.toLowerCase() ?? target}.`);
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {save.isPending && <Spinner />} Save
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <Select
          ariaLabel="New status"
          value={target}
          onChange={setTarget}
          options={next.map((s) => [s, TASK_STATUS_LABEL[s] ?? humanize(s)] as [string, string])}
        />
        {target === "completed" && (
          <TextField label="What was done (optional)" value={note} onChange={setNote} />
        )}
        {target === "rejected" && (
          <TextField label="Why" required value={reason} onChange={setReason} />
        )}
        <FormError message={err} />
      </div>
    </MDialog>
  );
}

/** APPS-2: a supervisor signs a completed task off, or sends it back to
 * the assignee with what needs redoing. */
function TaskReviewDialog({ task, onClose }: { task: TaskView; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const approve = useAppsMutation(() => appsService.approveTask(task.id, note.trim() || null));
  const back = useAppsMutation(() => appsService.sendBackTask(task.id, note.trim()));
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    try {
      await fn();
      toast.success(ok);
      onClose();
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Review: ${task.title}`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            variant="outline"
            disabled={back.isPending || approve.isPending}
            onClick={() => {
              if (!note.trim()) return setErr("Say what needs redoing.");
              run(() => back.mutateAsync(undefined), "Sent back to the assignee.");
            }}
          >
            Send back
          </MButton>
          <MButton
            disabled={approve.isPending || back.isPending}
            onClick={() => run(() => approve.mutateAsync(undefined), "Approved.")}
          >
            {approve.isPending && <Spinner />} Approve
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {task.assignee_name ?? "The assignee"} marked this done
          {task.completed_at ? ` on ${formatDateTime(task.completed_at)}` : ""}.
          {task.completion_note ? ` Note: ${task.completion_note}` : ""}
        </p>
        <TextField label="Note (needed to send it back)" value={note} onChange={setNote} />
        <FormError message={err} />
      </div>
    </MDialog>
  );
}
