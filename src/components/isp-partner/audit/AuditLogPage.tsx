/**
 * `/partner/audit-log` (AUDIT-LOG): ISP-wide staff activity. Who did what,
 * when, from which IP, with filters and CSV. Owner/admin only
 * (`isp_audit.read`); 404s and says so while `ISP_AUDIT_LOG_ENABLED` is off.
 */
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ScrollText } from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSectionHeader,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, FormError, LoadingBlock, Pager } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { detailText, ipText, rangeError } from "@/lib/isp-partner/audit-log";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage, isNotFound } from "@/lib/isp-partner/errors";
import { formatDateTime, roleLabel } from "@/lib/isp-partner/format";
import {
  auditLogService,
  type AuditQuery,
  type AuditSource,
} from "@/services/isp-partner/audit-log";

export function AuditLogPage() {
  const { can } = usePartner();
  const [source, setSource] = useState<AuditSource>("all");
  const [who, setWho] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const err = rangeError(since, until);
  const query: AuditQuery = {
    source,
    isp_user_id: who || undefined,
    action: action || undefined,
    search: debounced || undefined,
    since: since || undefined,
    until: until || undefined,
    page,
  };
  const q = useQuery({
    queryKey: ["isp", "audit-log", query],
    queryFn: () => auditLogService.list(query),
    enabled: !err,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const facets = useQuery({
    queryKey: ["isp", "audit-log", "facets"],
    queryFn: () => auditLogService.facets(),
    retry: false,
  });
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  if (q.isLoading && !q.data) return <LoadingBlock />;
  if (q.error && isNotFound(q.error)) {
    return (
      <MEmptyState
        icon={ScrollText}
        title="The audit log is not switched on"
        description="The ISP-wide staff activity log is not switched on for your network. Ask Wyfy Guest support to turn it on."
      />
    );
  }
  const items = q.data?.items ?? [];
  const exportCsv = async () => {
    try {
      const f = await auditLogService.exportCsv(query);
      saveBlob(f.blob, f.filename);
    } catch (e) {
      toast.error(ispErrorMessage(e, "Could not export."));
    }
  };
  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Admin"
        title="Audit log"
        description="What your staff did, when, and from which IP. Sign-ins show the IP they signed in from; older actions may show the IP as not recorded."
        actions={
          can("isp_audit.export") ? (
            <MButton variant="outline" disabled={!!err} onClick={exportCsv}>
              <Download /> CSV
            </MButton>
          ) : undefined
        }
      />
      <MSeg<AuditSource>
        value={source}
        onChange={(v) => reset(() => setSource(v))}
        options={[
          { value: "all", label: "Everything" },
          { value: "actions", label: "Actions" },
          { value: "sign_ins", label: "Sign-ins" },
        ]}
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select
          className={M_INPUT}
          aria-label="Staff member"
          value={who}
          onChange={(e) => reset(() => setWho(e.target.value))}
        >
          <option value="">All staff</option>
          {(facets.data?.staff ?? []).map((p) => (
            <option key={p.isp_user_id} value={p.isp_user_id}>
              {p.name} ({roleLabel(p.role)})
            </option>
          ))}
        </select>
        <select
          className={M_INPUT}
          aria-label="Action"
          value={action}
          onChange={(e) => reset(() => setAction(e.target.value))}
        >
          <option value="">All actions</option>
          {(facets.data?.actions ?? []).map((a) => (
            <option key={a.action} value={a.action}>
              {a.label} ({a.count})
            </option>
          ))}
        </select>
        <input
          className={M_INPUT}
          placeholder="Search action, description or IP"
          aria-label="Search"
          value={search}
          onChange={(e) => reset(() => setSearch(e.target.value))}
        />
        <input
          type="date"
          className={M_INPUT}
          aria-label="From"
          value={since}
          onChange={(e) => reset(() => setSince(e.target.value))}
        />
        <input
          type="date"
          className={M_INPUT}
          aria-label="To"
          value={until}
          onChange={(e) => reset(() => setUntil(e.target.value))}
        />
      </div>
      <FormError message={err} />
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the audit log" />
      ) : items.length === 0 ? (
        <MEmptyState
          icon={ScrollText}
          title="Nothing matches"
          description="Clear a filter to see more."
        />
      ) : (
        <MTable
          head={
            <>
              <MTh>When</MTh>
              <MTh>Who</MTh>
              <MTh>What</MTh>
              <MTh>Customer</MTh>
              <MTh>IP</MTh>
            </>
          }
        >
          {items.map((i) => (
            <MTr key={`${i.source}-${i.id}`}>
              <MTd className="whitespace-nowrap text-xs">{formatDateTime(i.at)}</MTd>
              <MTd>
                <div>{i.actor?.name ?? "System"}</div>
                <div className="text-xs text-muted-foreground">
                  {i.actor?.role ? roleLabel(i.actor.role) : i.actor ? "Not ISP staff" : ""}
                </div>
              </MTd>
              <MTd>
                <div className="flex flex-wrap items-center gap-1">
                  {i.source === "sign_in" && <MTag label="Sign-in" tone="info" />}
                  <span className="font-medium">{i.action_label}</span>
                </div>
                {Object.keys(i.detail).length > 0 && (
                  <div
                    className="max-w-[28rem] truncate text-xs text-muted-foreground"
                    title={detailText(i.detail)}
                  >
                    {detailText(i.detail)}
                  </div>
                )}
              </MTd>
              <MTd className="text-xs">{i.customer?.name ?? "–"}</MTd>
              <MTd className="font-mono text-xs">{ipText(i.ip, i.ip_recorded)}</MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {q.data && (
        <Pager
          page={page}
          pages={Math.max(1, Math.ceil(q.data.total / 50))}
          total={q.data.total}
          onPage={setPage}
        />
      )}
    </div>
  );
}
