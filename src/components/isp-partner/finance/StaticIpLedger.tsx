/**
 * STATICIP-2: the static IP lease ledger (Finance -> Static IPs). Subscriber,
 * IP, since/until, zone, status, monthly charge, invoices billed and due, with
 * filters and CSV. "Release" ends the lease (no further monthly lines) and
 * frees the IP from the subscriber's binding so it is back in the pool.
 *
 * Shown instead of the plain lease table only when the ledger API answers
 * (BE flag `ISP_STATICIP2_ENABLED`); otherwise the old table stays.
 */
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import {
  MButton,
  MDialog,
  MSeg,
  MTable,
  MTag,
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
import { retryUnless4xx, useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { staticIpKeys } from "@/hooks/isp-partner/useStaticIp";
import { useZones } from "@/hooks/isp-partner/useInvoices";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDate } from "@/lib/isp-partner/format";
import { formatRupees } from "@/lib/isp-partner/money";
import {
  staticIpService,
  type StaticIpLedgerQuery,
  type StaticIpRow,
} from "@/services/isp-partner/staticip";
import { M_FILTER } from "@/components/isp-partner/ui/classes";
import { EmptyRow } from "@/components/isp-partner/ui/EmptyRow";

function LeaseInvoices({ leaseId }: { leaseId: string }) {
  const q = useQuery({
    queryKey: [...staticIpKeys.all, "invoices", leaseId],
    queryFn: () => staticIpService.invoices(leaseId),
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="invoices" />;
  if (!q.data?.length) return <p className="text-xs text-muted-foreground">Not billed yet.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {q.data.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-2">
          <Link
            to="/partner/invoices/$invoiceId"
            params={{ invoiceId: i.id }}
            className="font-medium text-primary hover:underline"
          >
            {i.number}
          </Link>
          <span className="text-muted-foreground">
            {formatDate(i.period_start)} – {formatDate(i.period_end)}
          </span>
          <span>{formatRupees(i.total_paise)}</span>
          {i.balance_paise > 0 ? (
            <MTag label={`due ${formatRupees(i.balance_paise)}`} tone="pending" />
          ) : (
            <MTag label={i.status} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ReleaseDialog({ lease, onClose }: { lease: StaticIpRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("moved");
  const [error, setError] = useState<string | null>(null);
  const release = useMutation({
    mutationFn: () => staticIpService.release(lease!.id, { until: until || undefined, reason }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: staticIpKeys.all });
      qc.invalidateQueries({ queryKey: ["isp", "finance"] });
      toast.success(
        r.ip_back_in_pool
          ? `${lease!.ip_address} released and back in the pool.`
          : `${lease!.ip_address}: lease ended; the IP is still bound elsewhere.`,
      );
      for (const w of r.warnings) toast.warning(w);
      onClose();
    },
    onError: (e) => setError(ispErrorMessage(e, "Could not release the IP.")),
  });
  if (!lease) return null;
  return (
    <MDialog
      open
      onClose={onClose}
      title={`Release ${lease.ip_address}`}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton onClick={() => release.mutate()} disabled={release.isPending}>
            {release.isPending && <Spinner />} Release
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          The lease ends and no further monthly line is billed. The IP is removed from{" "}
          {lease.subscriber_name ?? lease.subscriber_identifier ?? "the subscriber"} and goes back
          to the pool. Months already billed stay on their invoices.
        </p>
        <TextField
          label="Last day (optional)"
          type="date"
          value={until}
          onChange={setUntil}
          hint="Empty: today."
        />
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Reason</span>
          <select className={M_INPUT} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="moved">Moved / shifted</option>
            <option value="disconnected">Disconnected</option>
            <option value="downgraded">Plan without static IP</option>
            <option value="other">Other</option>
          </select>
        </label>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

export function StaticIpLedger() {
  const { can } = usePartner();
  const customers = useIspCustomerOptions();
  const zones = useZones();
  const [status, setStatus] = useState<"" | "active" | "ended">("active");
  const [customer, setCustomer] = useState("");
  const [zone, setZone] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<StaticIpRow | null>(null);
  const query: StaticIpLedgerQuery = {
    status: status || undefined,
    isp_customer_id: customer || undefined,
    zone_id: zone || undefined,
    search: search.trim() || undefined,
    page,
    page_size: 25,
  };
  const q = useQuery({
    queryKey: [...staticIpKeys.all, "ledger", query],
    queryFn: () => staticIpService.ledger(query),
    retry: retryUnless4xx,
  });
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const d = q.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MSeg
          value={status}
          onChange={(v) => reset(() => setStatus(v))}
          options={[
            { value: "active", label: "Active" },
            { value: "ended", label: "Ended" },
            { value: "", label: "All" },
          ]}
        />
        <div className="w-48">
          <CustomerSelect
            value={customer}
            onChange={(v) => reset(() => setCustomer(v))}
            customers={customers.data}
          />
        </div>
        <select
          className={`${M_FILTER}`}
          value={zone}
          onChange={(e) => reset(() => setZone(e.target.value))}
          aria-label="Zone"
        >
          <option value="">All zones</option>
          {(zones.data ?? []).map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <input
          className={`${M_INPUT} w-48`}
          placeholder="IP, subscriber id or name"
          value={search}
          onChange={(e) => reset(() => setSearch(e.target.value))}
          aria-label="Search"
        />
        {can("isp_billing.export") && (
          <MButton
            variant="outline"
            className="ml-auto"
            onClick={async () => {
              try {
                const { blob, filename } = await staticIpService.exportCsv(query);
                saveBlob(blob, filename);
              } catch (e) {
                toast.error(ispErrorMessage(e));
              }
            }}
          >
            <Download /> CSV
          </MButton>
        )}
      </div>
      {d && (
        <p className="text-xs text-muted-foreground">
          {d.summary.active} active ({formatRupees(d.summary.monthly_paise)} a month) ·{" "}
          {d.summary.ended} ended
        </p>
      )}
      {q.error && !d ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the static IP ledger" />
      ) : (
        <MTable
          loading={q.isLoading}
          head={
            <>
              <MTh />
              <MTh>IP</MTh>
              <MTh>Subscriber</MTh>
              <MTh>Zone</MTh>
              <MTh>Since</MTh>
              <MTh>Until</MTh>
              <MTh className="text-right">Monthly</MTh>
              <MTh className="text-right">Billed / due</MTh>
              <MTh>Status</MTh>
              <MTh />
            </>
          }
        >
          {d?.items.length === 0 && (
            <EmptyRow
              kind="first-run"
              title="No static IP leases here"
              hint="Leases in this view and zone show here. Try All to include ended ones."
            />
          )}
          {d?.items.map((l) => (
            <Fragment key={l.id}>
              <MTr>
                <MTd>
                  <button
                    type="button"
                    aria-label={open === l.id ? "Hide invoices" : "Show invoices"}
                    onClick={() => setOpen(open === l.id ? null : l.id)}
                  >
                    {open === l.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </MTd>
                <MTd className="font-mono">{l.ip_address}</MTd>
                <MTd>
                  {l.subscriber_id ? (
                    <Link
                      to="/partner/subscribers/$subscriberId"
                      params={{ subscriberId: l.subscriber_id }}
                      className="hover:underline"
                    >
                      {l.subscriber_name ?? l.subscriber_identifier}
                    </Link>
                  ) : (
                    (l.customer_name ?? "–")
                  )}
                  {l.subscriber_identifier && (
                    <p className="text-xs text-muted-foreground">{l.subscriber_identifier}</p>
                  )}
                </MTd>
                <MTd className="text-xs">{l.zone_name ?? "–"}</MTd>
                <MTd className="text-xs">{formatDate(l.active_since)}</MTd>
                <MTd className="text-xs">{l.active_until ? formatDate(l.active_until) : "–"}</MTd>
                <MTd className="text-right tabular-nums">
                  {formatRupees(l.monthly_amount_paise)}
                  <p className="text-xs text-muted-foreground">
                    {l.price_includes_gst ? "incl. GST" : "+ GST"}
                  </p>
                </MTd>
                <MTd className="text-right tabular-nums text-xs">
                  {l.invoices} · {formatRupees(l.billed_paise)}
                  {l.due_paise > 0 && (
                    <p className="text-destructive">due {formatRupees(l.due_paise)}</p>
                  )}
                </MTd>
                <MTd>
                  <MTag label={l.status} tone={l.status === "active" ? undefined : "pending"} />
                </MTd>
                <MTd className="text-right">
                  {l.status === "active" && can("isp_billing.manage") && (
                    <MButton variant="ghost" onClick={() => setReleasing(l)}>
                      Release
                    </MButton>
                  )}
                </MTd>
              </MTr>
              {open === l.id && (
                <MTr>
                  <MTd />
                  <td className="px-4 py-2" colSpan={9}>
                    <LeaseInvoices leaseId={l.id} />
                  </td>
                </MTr>
              )}
            </Fragment>
          ))}
        </MTable>
      )}
      {d && d.pages > 1 && <Pager page={d.page} pages={d.pages} total={d.total} onPage={setPage} />}
      <ReleaseDialog lease={releasing} onClose={() => setReleasing(null)} />
    </div>
  );
}
