/**
 * `/partner/invoices` (ADDENDUM_03 §13): every invoice and credit note, to
 * customers and to subscribers, with URL-synced filters, selection and bulk
 * actions (mark paid, PDFs as a zip, email reminder), CSV / Excel export and
 * a totals footer. SMS reminders are deferred (founder); WhatsApp is a
 * share link the staff member opens.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Download,
  FilePlus2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import {
  MButton,
  MEmptyState,
  MSectionHeader,
  MSeg,
  MTag,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, Pager, Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  BulkMarkPaidDialog,
  CreditNoteDialog,
  InvoicePaymentDialog,
  ManualInvoiceDialog,
} from "@/components/isp-partner/invoices/InvoiceDialogs";
import { useInvoiceList, useInvoiceMutation, useZones } from "@/hooks/isp-partner/useInvoices";
import { usePackages } from "@/hooks/isp-partner/usePlans";
import { invoicesService } from "@/services/isp-partner/invoices";
import { billingService } from "@/services/isp-partner/billing";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { saveBlob } from "@/lib/isp-partner/download";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  INVOICE_KIND_LABEL,
  INVOICE_STATUS_LABEL_X,
  invoiceStatusTone,
  presetRange,
  type RangePreset,
  billToName,
  whatsappShareUrl,
} from "@/lib/isp-partner/invoices";
import { formatRupees } from "@/lib/isp-partner/money";
import { cn } from "@/lib/utils";
import type { InvoiceListQuery, InvoiceRow } from "@/services/isp-partner/invoices-types";

export interface InvoiceFilters {
  from: string;
  to: string;
  status: string;
  billTo: "" | "subscriber" | "customer";
  zone: string;
  pkg: string;
  q: string;
  page: number;
}

function RowMenu({
  inv,
  onPay,
  onCredit,
}: {
  inv: InvoiceRow;
  onPay: () => void;
  onCredit: () => void;
}) {
  const { can, me } = usePartner();
  const [open, setOpen] = useState(false);
  const remind = useInvoiceMutation((id: string) => invoicesService.remindEmail(id));
  const close = () => setOpen(false);
  const live = inv.status !== "cancelled" && inv.status !== "void";
  const phone = inv.subscriber?.phone ?? inv.customer?.contact_phone ?? null;
  return (
    <div className="relative">
      <MButton
        variant="ghost"
        aria-label={`Actions for ${inv.number}`}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal />
      </MButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-border bg-popover p-1 text-left text-sm shadow-lg">
            <Link
              to="/partner/invoices/$invoiceId"
              params={{ invoiceId: inv.id }}
              className="block rounded-lg px-3 py-1.5 hover:bg-accent"
            >
              View
            </Link>
            <button
              className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-accent"
              onClick={async () => {
                close();
                try {
                  const { blob, filename } = await invoicesService.pdf(inv);
                  saveBlob(blob, filename);
                } catch (err) {
                  toast.error(ispErrorMessage(err, "The download failed."));
                }
              }}
            >
              Download PDF
            </button>
            {can("isp_billing.execute") && live && inv.balance_paise > 0 && (
              <button
                className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-accent"
                onClick={() => {
                  close();
                  onPay();
                }}
              >
                Record payment
              </button>
            )}
            <a
              className="block rounded-lg px-3 py-1.5 hover:bg-accent"
              href={whatsappShareUrl({
                phone,
                name: billToName(inv) === "–" ? null : billToName(inv),
                invoiceNumber: inv.number,
                totalPaise: inv.total_paise,
                balancePaise: inv.balance_paise,
                ispName: me.isp.name,
                supportPhone: me.isp.support_phone,
              })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              Share on WhatsApp
            </a>
            {can("isp_invoices.execute") && live && (
              <button
                className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-accent"
                onClick={async () => {
                  close();
                  try {
                    await remind.mutateAsync(inv.id);
                    toast.success("Email reminder queued.");
                  } catch (err) {
                    toast.error(ispErrorMessage(err, "Could not send the email."));
                  }
                }}
              >
                Send email
              </button>
            )}
            {can("isp_invoices.manage") && live && inv.doc_type === "invoice" && (
              <button
                className="block w-full rounded-lg px-3 py-1.5 text-left text-rose-600 hover:bg-accent"
                onClick={() => {
                  close();
                  onCredit();
                }}
              >
                Credit note
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function InvoicesPage({
  filters,
  onFilters,
}: {
  filters: InvoiceFilters;
  onFilters: (f: InvoiceFilters) => void;
}) {
  const { can } = usePartner();
  const navigate = useNavigate();
  const zones = useZones();
  const packages = usePackages({ page_size: 100 });
  const [preset, setPreset] = useState<RangePreset>(
    filters.from || filters.to ? "custom" : "this_month",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [crediting, setCrediting] = useState<InvoiceRow | null>(null);
  const [bulkPaid, setBulkPaid] = useState<InvoiceRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(filters.q);

  const [defFrom, defTo] = presetRange("this_month");
  const from = filters.from || defFrom;
  const to = filters.to || defTo;
  const query: InvoiceListQuery = useMemo(
    () => ({
      since: new Date(`${from}T00:00:00`).toISOString(),
      until: new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString(),
      status: filters.status || undefined,
      bill_to_kind: filters.billTo || undefined,
      zone_id: filters.zone || undefined,
      package_id: filters.pkg || undefined,
      search: filters.q || undefined,
      page: filters.page,
      page_size: 50,
    }),
    [from, to, filters],
  );
  const q = useInvoiceList(query);
  const data = q.data;
  const rows = data?.items ?? [];
  const set = (patch: Partial<InvoiceFilters>) => {
    setSelected(new Set());
    onFilters({ ...filters, page: 1, ...patch });
  };
  const selectedRows = rows.filter((r) => selected.has(r.id));

  const bulk = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(ispErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const generate = useInvoiceMutation(() => billingService.generateDue());
  const remindBulk = useInvoiceMutation((ids: string[]) => invoicesService.bulkRemind(ids));

  return (
    <>
      <MSectionHeader
        eyebrow="Invoices"
        title="Invoices"
        description="Tax invoices and credit notes to your customers and subscribers, numbered per financial year. Coupon sign-ins show up as invoices within about a minute."
        actions={
          can("isp_invoices.create") && (
            <>
              <MButton
                variant="outline"
                disabled={generate.isPending}
                onClick={async () => {
                  try {
                    const res = await generate.mutateAsync(undefined);
                    toast.success(
                      res.created.length === 0
                        ? "Nothing is due today; no invoice was created."
                        : `${res.created.length} invoice(s) created.`,
                    );
                  } catch (err) {
                    toast.error(ispErrorMessage(err));
                  }
                }}
              >
                {generate.isPending ? <Spinner /> : <RefreshCw />} Generate due invoices
              </MButton>
              <MButton onClick={() => setCreating(true)}>
                <FilePlus2 /> New invoice
              </MButton>
            </>
          )
        }
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <MSeg<RangePreset>
            value={preset}
            onChange={(p) => {
              setPreset(p);
              if (p !== "custom") {
                const [f, t] = presetRange(p);
                set({ from: f, to: t });
              }
            }}
            options={[
              { value: "this_month", label: "This month" },
              { value: "last_month", label: "Last month" },
              { value: "this_fy", label: "This FY" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {preset === "custom" && (
            <>
              <input
                type="date"
                aria-label="From"
                className={`${M_INPUT} w-auto`}
                value={from}
                onChange={(e) => set({ from: e.target.value })}
              />
              <input
                type="date"
                aria-label="To"
                className={`${M_INPUT} w-auto`}
                value={to}
                onChange={(e) => set({ to: e.target.value })}
              />
            </>
          )}
          <MSeg<"" | "subscriber" | "customer">
            value={filters.billTo}
            onChange={(v) => set({ billTo: v })}
            options={[
              { value: "", label: "All" },
              { value: "subscriber", label: "Subscribers" },
              { value: "customer", label: "Customers" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["", "issued", "partially_paid", "paid", "cancelled"].map((s) => (
            <button
              key={s || "any"}
              type="button"
              onClick={() => set({ status: s })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                filters.status === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {s ? INVOICE_STATUS_LABEL_X[s] : "Any status"}
            </button>
          ))}
          <select
            className={`${M_INPUT} w-auto`}
            value={filters.zone}
            onChange={(e) => set({ zone: e.target.value })}
            aria-label="Zone"
          >
            <option value="">All zones</option>
            {(zones.data ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            className={`${M_INPUT} w-auto`}
            value={filters.pkg}
            onChange={(e) => set({ pkg: e.target.value })}
            aria-label="Package"
          >
            <option value="">All packages</option>
            {(packages.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <form
            className="relative w-full max-w-[240px]"
            onSubmit={(e) => {
              e.preventDefault();
              set({ q: searchText.trim() });
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className={`${M_INPUT} pl-8`}
              placeholder="Username or invoice no."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onBlur={() => searchText.trim() !== filters.q && set({ q: searchText.trim() })}
            />
          </form>
          <div className="ml-auto flex flex-wrap gap-2">
            {can("isp_invoices.export") &&
              (["csv", "xlsx"] as const).map((fmt) => (
                <MButton
                  key={fmt}
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    bulk(fmt, async () => {
                      const { blob, filename } = await invoicesService.exportList(fmt, query);
                      saveBlob(blob, filename);
                    })
                  }
                >
                  {busy === fmt ? <Spinner /> : <Download />} {fmt === "csv" ? "CSV" : "Excel"}
                </MButton>
              ))}
          </div>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card p-2 shadow-sm">
          <span className="px-1 text-xs font-medium">{selectedRows.length} selected</span>
          {can("isp_invoices.execute") && can("isp_billing.execute") && (
            <MButton onClick={() => setBulkPaid(selectedRows)}>
              <Wallet /> Mark paid…
            </MButton>
          )}
          {(can("isp_invoices.execute") || can("isp_invoices.export")) && (
            <MButton
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                bulk("zip", async () => {
                  const { blob, filename } = await invoicesService.bulkPdfs(
                    selectedRows.map((r) => r.id),
                  );
                  saveBlob(blob, filename);
                })
              }
            >
              {busy === "zip" ? <Spinner /> : <Receipt />} Download PDFs
            </MButton>
          )}
          {can("isp_invoices.execute") && (
            <MButton
              variant="outline"
              disabled={remindBulk.isPending}
              onClick={async () => {
                try {
                  const r = await remindBulk.mutateAsync(selectedRows.map((x) => x.id));
                  toast.success(
                    `${r.queued} email reminder(s) queued. Skipped: ${r.skipped_no_consent} without email consent, ${r.skipped_no_contact} without an email address.`,
                  );
                } catch (err) {
                  toast.error(ispErrorMessage(err));
                }
              }}
            >
              {remindBulk.isPending ? <Spinner /> : <Mail />} Send email reminder
            </MButton>
          )}
          <MButton variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </MButton>
        </div>
      )}

      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="invoices" />
      ) : data && rows.length === 0 ? (
        <MEmptyState
          icon={Receipt}
          title="No invoices match"
          description="Change the dates or filters, or issue a new invoice."
        />
      ) : (
        <>
          {/* Table from sm up; cards on a phone (§13 "cards at 360 px"). */}
          <div className="hidden overflow-x-auto rounded-xl premium-card sm:block">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                      }
                    />
                  </th>
                  <th className="px-3 py-2.5">Created</th>
                  <th className="px-3 py-2.5">Invoice no.</th>
                  <th className="px-3 py-2.5">Bill to</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Zone</th>
                  <th className="px-3 py-2.5">Package / kind</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5 text-right">Balance</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {q.isLoading ? (
                  <tr>
                    <td colSpan={11} className="p-4 text-muted-foreground">
                      <Spinner /> Loading…
                    </td>
                  </tr>
                ) : (
                  rows.map((i) => (
                    <tr
                      key={i.id}
                      className="border-b border-border/70 last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${i.number}`}
                          checked={selected.has(i.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(i.id);
                            else next.delete(i.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {formatDateTime(i.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="font-mono text-xs font-medium text-primary hover:underline"
                          onClick={() =>
                            navigate({
                              to: "/partner/invoices/$invoiceId",
                              params: { invoiceId: i.id },
                            })
                          }
                        >
                          {i.number}
                        </button>
                        <p className="text-[10px] text-muted-foreground">
                          #{i.display_id}
                          {i.doc_type === "credit_note" && " · credit note"}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {i.subscriber ? (
                          <>
                            <span className="font-mono">{i.subscriber.username}</span>
                            {i.subscriber.circuit_id != null && (
                              <p className="text-[10px] text-muted-foreground">
                                Circuit {i.subscriber.circuit_id}
                              </p>
                            )}
                          </>
                        ) : (
                          <span>{i.customer?.name ?? "–"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{billToName(i)}</td>
                      <td className="px-3 py-2 text-xs">{i.zone?.name ?? "–"}</td>
                      <td className="px-3 py-2 text-xs">
                        {i.package?.name ?? "–"}
                        <p className="text-[10px] text-muted-foreground">
                          {INVOICE_KIND_LABEL[i.invoice_kind] ?? i.invoice_kind}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatRupees(i.total_paise)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          i.balance_paise > 0 && "font-medium text-rose-600",
                        )}
                      >
                        {formatRupees(i.balance_paise)}
                      </td>
                      <td className="px-3 py-2">
                        <MTag
                          label={i.status_label || INVOICE_STATUS_LABEL_X[i.status] || i.status}
                          tone={invoiceStatusTone(i.status)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <RowMenu
                          inv={i}
                          onPay={() => setPaying(i)}
                          onCredit={() => setCrediting(i)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 sm:hidden">
            {rows.map((i) => (
              <div key={i.id} className="rounded-xl premium-card p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/partner/invoices/$invoiceId"
                    params={{ invoiceId: i.id }}
                    className="font-mono text-xs font-medium text-primary"
                  >
                    {i.number}
                  </Link>
                  <MTag
                    label={i.status_label || INVOICE_STATUS_LABEL_X[i.status] || i.status}
                    tone={invoiceStatusTone(i.status)}
                  />
                </div>
                <p className="mt-1 text-xs">
                  {i.subscriber ? `${i.subscriber.username} · ` : ""}
                  {billToName(i)}
                </p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span>{formatRupees(i.total_paise)}</span>
                  <span
                    className={
                      i.balance_paise > 0 ? "font-medium text-rose-600" : "text-muted-foreground"
                    }
                  >
                    Due {formatRupees(i.balance_paise)}
                  </span>
                  <RowMenu inv={i} onPay={() => setPaying(i)} onCredit={() => setCrediting(i)} />
                </div>
              </div>
            ))}
          </div>
          {data?.totals && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-border bg-muted/30 px-4 py-2 text-xs">
              <span>
                Invoiced{" "}
                <strong className="tabular-nums">{formatRupees(data.totals.invoiced_paise)}</strong>
              </span>
              <span>
                Collected{" "}
                <strong className="tabular-nums">
                  {formatRupees(data.totals.collected_paise)}
                </strong>
              </span>
              <span>
                Outstanding{" "}
                <strong className="tabular-nums text-rose-600">
                  {formatRupees(data.totals.outstanding_paise)}
                </strong>
              </span>
              <span className="text-muted-foreground">for the filtered set</span>
            </div>
          )}
          {data && (
            <Pager
              page={data.page}
              pages={data.pages}
              total={data.total}
              onPage={(p) => onFilters({ ...filters, page: p })}
            />
          )}
        </>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> Reminders go by email. WhatsApp opens a prefilled
        chat you send yourself; SMS reminders are not available yet.
      </p>

      <InvoicePaymentDialog invoice={paying} onClose={() => setPaying(null)} />
      <CreditNoteDialog invoice={crediting} onClose={() => setCrediting(null)} />
      <BulkMarkPaidDialog
        invoices={bulkPaid}
        onClose={(done) => {
          setBulkPaid(null);
          if (done) setSelected(new Set());
        }}
      />
      <ManualInvoiceDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
