/** Apps -> Leads: funnel, list, add, detail (status, schedule install,
 * convert). Converting uses the CAF workbench when it is on (CAF-2 already
 * converts leads there and carries the CAF fields over); only with it off
 * does this page call JAZE-5's own convert. A converted lead links to the
 * subscriber. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Plus, UserCheck, UserPlus } from "lucide-react";
import {
  MButton,
  MDialog,
  MDrawer,
  MEmptyState,
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
  LoadingBlock,
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
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  LEAD_STATUS_LABEL,
  TASK_STATUS_LABEL,
  appsCan,
  convertRoute,
  humanize,
  leadBody,
  leadPatchStatuses,
  leadStatusBody,
} from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadDetail,
  type LeadQuery,
} from "@/services/isp-partner/apps-types";

export function LeadsTab() {
  const { can } = usePartner();
  const c = appsCan(can);
  const customers = useIspCustomerOptions();
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState("");
  const [assignee, setAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const debounced = useDebouncedValue(search.trim(), 300);
  const q: LeadQuery = {
    status: (status || undefined) as LeadQuery["status"],
    isp_customer_id: customer || undefined,
    assignee_user_id: assignee || undefined,
    search: debounced || undefined,
    page,
    page_size: 25,
  };
  const list = useQuery({
    queryKey: appsKeys.list("leads", q),
    queryFn: () => appsService.leads(q),
    retry: false,
  });
  const funnel = useQuery({
    queryKey: appsKeys.list("funnel"),
    queryFn: () => appsService.funnel(),
    retry: false,
    staleTime: 60_000,
  });
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  return (
    <div className="space-y-3">
      {funnel.data && (
        <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Lead funnel">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => reset(setStatus)(status === s ? "" : s)}
              className={`rounded-full border px-2.5 py-1 ${status === s ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
            >
              {LEAD_STATUS_LABEL[s]}{" "}
              <span className="tabular-nums text-muted-foreground">{funnel.data[s] ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-52">
          <CustomerSelect
            value={customer}
            onChange={reset(setCustomer)}
            customers={customers.data}
          />
        </div>
        <div className="w-48">
          <AssigneeSelect value={assignee} onChange={reset(setAssignee)} />
        </div>
        <input
          className={`${M_INPUT} w-56`}
          placeholder="Name, phone or number"
          value={search}
          onChange={(e) => reset(setSearch)(e.target.value)}
          aria-label="Search leads"
        />
        <div className="ml-auto flex gap-2">
          {c.export && <CsvButton run={() => appsService.leadsCsv(q)} />}
          {c.create && (
            <MButton onClick={() => setAdding(true)}>
              <Plus /> New lead
            </MButton>
          )}
        </div>
      </div>
      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="leads" />
      ) : list.data && list.data.items.length === 0 ? (
        <MEmptyState
          icon={UserPlus}
          title="No leads here"
          description="Add an enquiry as a lead."
        />
      ) : (
        <>
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>Lead</MTh>
                <MTh>Contact</MTh>
                <MTh>Customer</MTh>
                <MTh>Status</MTh>
                <MTh>Assignee</MTh>
              </>
            }
          >
            {(list.data?.items ?? []).map((l) => (
              <MTr key={l.id}>
                <MTd>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setOpen(l.id)}
                  >
                    {l.name}
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {l.number}
                    </span>
                  </button>
                </MTd>
                <MTd className="text-xs">
                  {[l.phone, l.city].filter(Boolean).join(" · ") || "–"}
                </MTd>
                <MTd className="text-xs">{l.customer_name ?? "–"}</MTd>
                <MTd>
                  <StatusTag map={LEAD_STATUS_LABEL} value={l.status} />
                </MTd>
                <MTd className="text-xs">{l.assignee_name ?? "–"}</MTd>
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
      {adding && <LeadDialog onClose={() => setAdding(false)} onCreated={setOpen} />}
      {open && <LeadDrawer leadId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function LeadDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const customers = useIspCustomerOptions();
  const packages = usePackages({ status: "active", page_size: 100 });
  const [d, setD] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    source: "phone",
    isp_customer_id: "",
    interested_package_id: "",
    notes: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const create = useAppsMutation((body: object) => appsService.createLead(body));
  return (
    <MDialog
      open
      wide
      onClose={onClose}
      title="New lead"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={create.isPending}
            onClick={async () => {
              setErr(null);
              const r = leadBody(d);
              if ("error" in r) return setErr(r.error);
              try {
                const l = await create.mutateAsync(r.body);
                toast.success(`Lead ${l.number} added.`);
                onClose();
                onCreated(l.id);
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {create.isPending && <Spinner />} Add lead
          </MButton>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <TextField label="Name" required value={d.name} onChange={set("name")} />
        <TextField label="Mobile" value={d.phone} onChange={set("phone")} />
        <TextField label="Email" value={d.email} onChange={set("email")} />
        <TextField label="City" value={d.city} onChange={set("city")} />
        <div className="sm:col-span-2">
          <TextField label="Address" value={d.address} onChange={set("address")} />
        </div>
        <Select
          ariaLabel="Source"
          value={d.source}
          onChange={set("source")}
          options={LEAD_SOURCES.map((s) => [s, humanize(s)] as [string, string])}
        />
        <CustomerSelect
          value={d.isp_customer_id}
          onChange={set("isp_customer_id")}
          customers={customers.data}
          allLabel="Customer not known yet"
        />
        <Select
          ariaLabel="Interested in"
          value={d.interested_package_id}
          onChange={set("interested_package_id")}
          options={[
            ["", "Package not decided"],
            ...(packages.data?.items ?? []).map((p) => [p.id, p.name] as [string, string]),
          ]}
        />
        <TextField label="Notes" value={d.notes} onChange={set("notes")} />
      </div>
      <FormError message={err} />
    </MDialog>
  );
}

function LeadDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: appsKeys.one("lead", leadId),
    queryFn: () => appsService.lead(leadId),
    retry: false,
  });
  return (
    <MDrawer open onClose={onClose} title={q.data ? `${q.data.name} · ${q.data.number}` : "Lead"}>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this lead" />
      ) : (
        <LeadBody key={q.data.status} l={q.data} />
      )}
    </MDrawer>
  );
}

function LeadBody({ l }: { l: LeadDetail }) {
  const { can } = usePartner();
  const c = appsCan(can);
  const caf = useQuery({
    queryKey: ["isp", "caf", "on"],
    queryFn: () => appsService.cafOn(),
    staleTime: 5 * 60_000,
  });
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [install, setInstall] = useState(false);
  const [converting, setConverting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const patch = useAppsMutation((body: object) => appsService.patchLead(l.id, body));
  const converted = l.status === "converted";
  const statuses = leadPatchStatuses(l.status);
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <StatusTag map={LEAD_STATUS_LABEL} value={l.status} />
        </dd>
        <dt className="text-muted-foreground">Contact</dt>
        <dd>{[l.phone, l.email].filter(Boolean).join(" · ") || "–"}</dd>
        <dt className="text-muted-foreground">Address</dt>
        <dd>{[l.address, l.city].filter(Boolean).join(", ") || "–"}</dd>
        <dt className="text-muted-foreground">Customer</dt>
        <dd>{l.customer_name ?? "Not known yet"}</dd>
        <dt className="text-muted-foreground">Source</dt>
        <dd>{humanize(l.source)}</dd>
        {l.dropped_reason && (
          <>
            <dt className="text-muted-foreground">Dropped because</dt>
            <dd>{l.dropped_reason}</dd>
          </>
        )}
        {l.notes && (
          <>
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap">{l.notes}</dd>
          </>
        )}
      </dl>

      {converted && l.converted_subscriber_id && (
        <Link
          to="/partner/subscribers/$subscriberId"
          params={{ subscriberId: l.converted_subscriber_id }}
          className="inline-flex"
        >
          <MButton variant="outline">
            <UserCheck /> Open the subscriber
          </MButton>
        </Link>
      )}

      {!converted && c.update && statuses.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Select
            ariaLabel="Move to"
            value={target}
            onChange={setTarget}
            options={[
              ["", "Change status…"],
              ...statuses.map((s) => [s, LEAD_STATUS_LABEL[s] ?? humanize(s)] as [string, string]),
            ]}
          />
          {target === "dropped" && (
            <TextField label="Why" required value={reason} onChange={setReason} />
          )}
          <MButton
            disabled={!target || patch.isPending}
            onClick={async () => {
              setErr(null);
              const r = leadStatusBody(target, reason);
              if ("error" in r) return setErr(r.error);
              try {
                await patch.mutateAsync(r.body);
                toast.success("Status changed.");
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {patch.isPending && <Spinner />} Save status
          </MButton>
        </div>
      )}

      {!converted && (
        <div className="flex flex-wrap gap-2">
          {c.create && l.status !== "dropped" && (
            <MButton variant="outline" onClick={() => setInstall(true)}>
              <CalendarPlus /> Schedule install
            </MButton>
          )}
          {c.manage &&
            l.status !== "dropped" &&
            caf.isSuccess &&
            convertRoute(caf.data) === "caf" && (
              <Link to="/partner/compliance" search={{ tab: "caf" }} className="inline-flex">
                <MButton>
                  <UserCheck /> Convert in the CAF workbench
                </MButton>
              </Link>
            )}
          {c.manage &&
            l.status !== "dropped" &&
            caf.isSuccess &&
            convertRoute(caf.data) === "apps" && (
              <MButton onClick={() => setConverting(true)}>
                <UserCheck /> Convert to subscriber
              </MButton>
            )}
        </div>
      )}
      {caf.data && !converted && (
        <p className="text-[11px] text-muted-foreground">
          The CAF workbench is on, so conversion happens there: search this lead under Lead, and its
          CAF details come along.
        </p>
      )}

      {l.tasks.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold">Field tasks</h4>
          <ul className="space-y-1 text-xs">
            {l.tasks.map((t) => (
              <li key={t.id}>
                {t.title} · <StatusTag map={TASK_STATUS_LABEL} value={t.status} />
                {t.scheduled_at ? ` · ${formatDateTime(t.scheduled_at)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormError message={err} />
      {install && <InstallDialog l={l} onClose={() => setInstall(false)} />}
      {converting && <ConvertDialog l={l} onClose={() => setConverting(false)} />}
    </div>
  );
}

function InstallDialog({ l, onClose }: { l: LeadDetail; onClose: () => void }) {
  const [f, setF] = useState({ title: `Install for ${l.name}`, when: "", assignee: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const run = useAppsMutation(() =>
    appsService.scheduleInstall(l.id, {
      title: f.title.trim() || null,
      scheduled_at: f.when ? new Date(f.when).toISOString() : null,
      assignee_user_id: f.assignee || null,
      notes: f.notes.trim() || null,
    }),
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title="Schedule install"
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={run.isPending}
            onClick={async () => {
              setErr(null);
              try {
                await run.mutateAsync(undefined);
                toast.success("Install task created.");
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {run.isPending && <Spinner />} Create install task
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <TextField label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
        <input
          type="datetime-local"
          className={M_INPUT}
          value={f.when}
          onChange={(e) => setF({ ...f, when: e.target.value })}
          aria-label="When"
        />
        <AssigneeSelect value={f.assignee} onChange={(v) => setF({ ...f, assignee: v })} />
        <TextField label="Notes" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} />
        <FormError message={err} />
      </div>
    </MDialog>
  );
}

function ConvertDialog({ l, onClose }: { l: LeadDetail; onClose: () => void }) {
  const customers = useIspCustomerOptions(!l.isp_customer_id);
  const packages = usePackages({ status: "active", page_size: 100 }, !l.interested_package_id);
  const [identifier, setIdentifier] = useState(l.phone ?? "");
  const [pkg, setPkg] = useState("");
  const [cust, setCust] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const run = useAppsMutation(() =>
    appsService.convertLead(l.id, {
      identifier: identifier.trim(),
      package_id: pkg || null,
      isp_customer_id: cust || null,
    }),
  );
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Convert ${l.name}`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={run.isPending}
            onClick={async () => {
              setErr(null);
              if (identifier.trim().length < 3) return setErr("Login id: at least 3 characters.");
              if (!l.interested_package_id && !pkg) return setErr("Pick the package.");
              if (!l.isp_customer_id && !cust) return setErr("Pick the customer.");
              try {
                await run.mutateAsync(undefined);
                toast.success("Converted to a subscriber.");
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {run.isPending && <Spinner />} Convert
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Name, mobile, email and address come from the lead.
        </p>
        <TextField
          label="Login id"
          value={identifier}
          onChange={setIdentifier}
          hint="Usually their mobile."
        />
        {!l.interested_package_id && (
          <Select
            ariaLabel="Package"
            value={pkg}
            onChange={setPkg}
            options={[
              ["", "Pick a package…"],
              ...(packages.data?.items ?? []).map((p) => [p.id, p.name] as [string, string]),
            ]}
          />
        )}
        {!l.isp_customer_id && (
          <CustomerSelect
            value={cust}
            onChange={setCust}
            customers={customers.data}
            allLabel={null}
          />
        )}
        <FormError message={err} />
      </div>
    </MDialog>
  );
}
