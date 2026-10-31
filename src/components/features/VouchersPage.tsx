import { useEffect, useState } from "react";
import { DEMO_VENUE_NAMES } from "@/lib/demo-world";
import { Plus, Trash2, Download, Printer, Mail, Eye, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  Callout,
  DataTable,
  EmptyState,
  FormField,
  FormSection,
  MONO_CELL,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
  type ConsoleStatus,
  type PageScope,
} from "@/components/customer/console";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { voucherService } from "@/services/voucher.service";
import { resolveOrgId } from "@/services/customer.service";
import type {
  Voucher as BackendVoucherModel,
  VoucherBatchStats,
  VoucherRedemption,
} from "@/types/voucher";
import { maskMac } from "@/lib/masking";

interface Voucher {
  code: string;
  plan: string;
  status: string;
  used: number;
  businessUnit: string;
  redeemedAt: string | null;
}
// Demo-only: the demo world's venues (`@/lib/demo-world`), so every picker
// lists the same venues as the venue switcher.
const UNITS: string[] = [...DEMO_VENUE_NAMES];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Clamps a (possibly NaN, from an emptied number input) value into [lo, hi], falling back to `fallback` when NaN. */
const clamp = (n: number, fallback: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isNaN(n) ? fallback : n));

// "Redeemed At" is a last-used timestamp (see the real backend's own
// redeemed_at field, services/voucher.service.ts's BackendVoucher --
// paired with last_used_at/expires_at/created_at, all clearly timestamps),
// not a location -- this demo fixture previously duplicated businessUnit's
// own value into it, which looked like a real bug (same value in two
// columns) to anyone viewing the demo account, prospective customers
// included. Corrected to plausible relative-time strings.
const DEMO_SEED: Voucher[] = [
  {
    code: "VCH-8821",
    plan: "1h",
    status: "active",
    used: 3,
    businessUnit: "Mumbai HQ",
    redeemedAt: "12 min ago",
  },
  {
    code: "VCH-8822",
    plan: "24h",
    status: "active",
    used: 12,
    businessUnit: "Delhi Office",
    redeemedAt: "3 hours ago",
  },
  {
    code: "VCH-8823",
    plan: "1h",
    status: "active",
    used: 1,
    businessUnit: "Bangalore DC",
    redeemedAt: "1 day ago",
  },
  {
    code: "VCH-8824",
    plan: "3d",
    status: "unused",
    used: 0,
    businessUnit: "Chennai Office",
    redeemedAt: null,
  },
];

/** Real vouchers are issued in batches (backend/app/domains/voucher) --
 * a batch row here (name = quantity + status) stands in for that entity,
 * distinct from demo mode's per-code rows which have no backend match. */
interface BatchRow {
  id: string;
  code: string;
  plan: string;
  status: string;
  used: number;
  businessUnit: string;
  redeemedAt: string | null;
  organizationId: string;
}

/** A voucher's or batch's state as a console status: live is ok, spent is
 * info, everything else (unused, expired, revoked) is the neutral grey. The
 * accent is a brand colour, never a status. */
function voucherStatus(status: string): ConsoleStatus {
  if (status === "active") return "ok";
  if (/^(used|redeemed|exhausted|partially_used|fully_used)$/.test(status)) return "info";
  return "offline";
}

export function VouchersPage({ locationId, scope }: { locationId?: string; scope?: PageScope }) {
  const demo = useIsDemo();
  const [items, setItems] = useState<Voucher[]>(demo ? DEMO_SEED : []);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    businessUnit: UNITS[0],
    quantity: 10,
    validMin: 60,
    prefix: "VCH",
    dataLimit: 0,
    maxUses: 1,
    codeLen: 8,
  });
  const [planOpts] = useState([
    { v: "1h", l: "1 Hour" },
    { v: "24h", l: "24 Hours" },
    { v: "3d", l: "3 Days" },
    { v: "7d", l: "7 Days" },
  ]);

  // View (Eye icon) -- the Actions column's eye button had no onClick at
  // all, so it was a real dead click. Wired to the batch's real vouchers +
  // stats (backend/app/domains/voucher already exposes both).
  const [viewBatch, setViewBatch] = useState<BatchRow | Voucher | null>(null);
  const [viewVouchers, setViewVouchers] = useState<BackendVoucherModel[]>([]);
  const [viewStats, setViewStats] = useState<VoucherBatchStats | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  // Observed redemption facts (device MAC, IP) keyed by voucher id --
  // resolved separately from the voucher rows themselves because the
  // voucher table holds no link to a device; see
  // voucherService.listRedemptions.
  const [viewRedemptions, setViewRedemptions] = useState<Map<string, VoucherRedemption>>(new Map());

  // Export CSV / download PDF / email -- real backend endpoints
  // (voucher.service.ts's exportCsv/downloadPdf/emailPdf, backed by
  // backend/app/domains/voucher's .../export, .../download, .../email)
  // that the page-level "CSV"/"Print"/"Email" buttons below never called;
  // they just toasted. Real actions need a real batch, so they live here,
  // in the batch-scoped view dialog, not floating at the page level.
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailing, setEmailing] = useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportBatchCsv = async (b: BatchRow) => {
    setExporting("csv");
    try {
      const blob = await voucherService.exportCsv(b.id, b.organizationId);
      downloadBlob(blob, `voucher_batch_${b.id}.csv`);
      toast.success("CSV exported");
    } catch {
      toast.error("Could not export the CSV — check the connection and try again.");
    } finally {
      setExporting(null);
    }
  };

  const downloadBatchPdf = async (b: BatchRow) => {
    setExporting("pdf");
    try {
      const blob = await voucherService.downloadPdf(b.id, b.organizationId);
      downloadBlob(blob, `voucher_batch_${b.id}.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Could not download the PDF — check the connection and try again.");
    } finally {
      setExporting(null);
    }
  };

  const emailBatch = async (b: BatchRow) => {
    if (!EMAIL_RE.test(emailTo.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    setEmailing(true);
    try {
      await voucherService.emailPdf(b.id, b.organizationId, emailTo.trim());
      toast.success(`Voucher batch queued for delivery to ${emailTo.trim()}`);
      setEmailTo("");
    } catch {
      toast.error("Could not send the email — check the connection and try again.");
    } finally {
      setEmailing(false);
    }
  };

  const openView = async (row: BatchRow | Voucher) => {
    setViewBatch(row);
    if (demo) return;
    const b = row as BatchRow;
    setViewLoading(true);
    setViewVouchers([]);
    setViewStats(null);
    setViewRedemptions(new Map());
    try {
      const [vouchers, stats] = await Promise.all([
        voucherService.listVouchers(b.id, b.organizationId),
        voucherService.getStats(b.id, b.organizationId),
      ]);
      setViewVouchers(vouchers.rows);
      setViewStats(stats);
      // Sequenced after the codes, not raced with them: this is the
      // secondary detail, and the dialog is useful without it. Only
      // vouchers that have actually been used can have a session.
      const usedIds = vouchers.rows.filter((v) => v.useCount > 0).map((v) => v.id);
      setViewRedemptions(await voucherService.listRedemptions(usedIds, b.organizationId));
    } catch {
      toast.error("Could not load this batch's vouchers.");
    } finally {
      setViewLoading(false);
    }
  };
  const closeView = () => {
    setViewBatch(null);
    setViewVouchers([]);
    setViewStats(null);
    setViewRedemptions(new Map());
    setEmailTo("");
  };

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // /me/organizations instead of the platform-wide GET /organizations
      // -- see customer.service.ts's resolveOrgId doc comment.
      const orgId = await resolveOrgId();
      const res = await voucherService.listBatches(1, 50, orgId);
      if (cancelled) return;
      setBatches(
        res.rows.map((b) => ({
          id: b.id,
          code: b.name,
          plan: `${b.validityMinutes}m`,
          status: b.status,
          used: b.quantity,
          businessUnit: "",
          redeemedAt: null,
          organizationId: b.organizationId,
        })),
      );
    })()
      .catch(() => {
        if (!cancelled) setItems(DEMO_SEED);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demo, locationId]);

  const rows = demo ? items : batches;

  const handleGenerate = async () => {
    if (demo) {
      const count = Math.min(form.quantity, 100);
      const newItems: Voucher[] = [];
      for (let i = 0; i < count; i++) {
        const num = String(items.length + i + 1).padStart(4, "0");
        const plan =
          form.validMin >= 10080
            ? "7d"
            : form.validMin >= 4320
              ? "3d"
              : form.validMin >= 1440
                ? "24h"
                : "1h";
        newItems.push({
          code: `${form.prefix}-${num}`,
          plan,
          status: "active",
          used: 0,
          businessUnit: form.businessUnit,
          redeemedAt: null,
        });
      }
      setItems([...newItems, ...items]);
      setOpen(false);
      toast.success(`${count} vouchers generated for ${form.businessUnit}`);
      return;
    }
    try {
      const orgId = await resolveOrgId();
      const batch = await voucherService.createBatch({
        name: form.name || `Batch ${Date.now()}`,
        organizationId: orgId,
        locationId,
        quantity: Math.min(form.quantity, 100),
        codeLength: form.codeLen,
        codePrefix: form.prefix,
        validityMinutes: form.validMin,
        maxUsesPerVoucher: form.maxUses,
        dataLimitMb: form.dataLimit || null,
      });
      setBatches([
        {
          id: batch.id,
          code: batch.name,
          plan: `${batch.validityMinutes}m`,
          status: batch.status,
          used: batch.quantity,
          businessUnit: "",
          redeemedAt: null,
          organizationId: batch.organizationId,
        },
        ...batches,
      ]);
      setOpen(false);
      toast.success(`Batch "${batch.name}" created (${batch.status})`);
    } catch {
      toast.error("Could not generate the batch — check the connection and try again.");
    }
  };

  const revoke = async (row: BatchRow | Voucher) => {
    if (demo) {
      setItems(items.filter((x) => x.code !== row.code));
      toast.success("Revoked");
      return;
    }
    const b = row as BatchRow;
    const prev = batches;
    setBatches(batches.filter((x) => x.id !== b.id));
    try {
      await voucherService.revokeBatch(b.id, b.organizationId);
      toast.success("Batch revoked");
    } catch {
      setBatches(prev);
      toast.error("Could not revoke on the server.");
    }
  };

  const formatPlan = (p: string) => planOpts.find((o) => o.v === p)?.l || p;

  return (
    <div className="wy-console space-y-5">
      {/* Under the customer shell this is the page's only header (the shell
          passes the tab name and venue); the agent view mounts it bare. */}
      <PageHeader
        title={scope?.title ?? "Vouchers"}
        venue={scope?.venue}
        description={
          <>
            Codes a guest types at the login page instead of a phone number.{" "}
            <span className="tabular-nums">
              {rows.length} {demo ? "vouchers" : "batches"}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Bulk import started")}
            >
              Import CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  Generate
                </Button>
              </DialogTrigger>
              <DialogContent className="wy-console sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Generate Voucher Batch</DialogTitle>
                </DialogHeader>
                <FormSection variant="plain" className="py-2">
                  <FormField label="Batch Name" htmlFor="voucher-batch-name" wide>
                    <Input
                      id="voucher-batch-name"
                      placeholder="e.g. Summer Promo 2026"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </FormField>
                  {demo && (
                    <FormField label="Business Unit" htmlFor="voucher-business-unit" wide>
                      <Select
                        value={form.businessUnit}
                        onValueChange={(v) => setForm({ ...form, businessUnit: v })}
                      >
                        <SelectTrigger id="voucher-business-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}
                  <FormField label="Quantity" htmlFor="voucher-quantity">
                    <Input
                      id="voucher-quantity"
                      type="number"
                      min={1}
                      max={100}
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: clamp(parseInt(e.target.value), 1, 1, 100) })
                      }
                    />
                  </FormField>
                  <FormField label="Validity (min)" htmlFor="voucher-validity">
                    <Input
                      id="voucher-validity"
                      type="number"
                      min={1}
                      max={43200}
                      value={form.validMin}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          validMin: clamp(parseInt(e.target.value), 60, 1, 43200),
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Code Prefix" htmlFor="voucher-prefix">
                    <Input
                      id="voucher-prefix"
                      value={form.prefix}
                      onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Code Length" htmlFor="voucher-code-length">
                    <Input
                      id="voucher-code-length"
                      type="number"
                      min={4}
                      max={16}
                      value={form.codeLen}
                      onChange={(e) =>
                        setForm({ ...form, codeLen: clamp(parseInt(e.target.value), 8, 4, 16) })
                      }
                    />
                  </FormField>
                  <FormField label="Data Limit (MB)" htmlFor="voucher-data-limit">
                    <Input
                      id="voucher-data-limit"
                      type="number"
                      min={0}
                      max={102400}
                      placeholder="0 = unlimited"
                      value={form.dataLimit}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          dataLimit: clamp(parseInt(e.target.value), 0, 0, 102400),
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Max Uses" htmlFor="voucher-max-uses">
                    <Input
                      id="voucher-max-uses"
                      type="number"
                      min={1}
                      max={1000}
                      value={form.maxUses}
                      onChange={(e) =>
                        setForm({ ...form, maxUses: clamp(parseInt(e.target.value), 1, 1, 1000) })
                      }
                    />
                  </FormField>
                </FormSection>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleGenerate}>Generate {form.quantity} Vouchers</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Panel flush>
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : (
          <DataTable<Voucher | BatchRow>
            ariaLabel={demo ? "Vouchers" : "Voucher batches"}
            rows={rows}
            rowKey={(v) => (demo ? v.code : (v as BatchRow).id)}
            empty={
              <EmptyState
                icon={Ticket}
                title="No voucher batches"
                description="Generate a batch above to issue guest access vouchers."
              />
            }
            actionsLabel="Actions"
            columns={[
              {
                id: "code",
                header: demo ? "Code" : "Batch Name",
                mono: true,
                mobile: "title",
                cell: (v) => v.code,
              },
              ...(demo
                ? [
                    {
                      id: "unit",
                      header: "Business Unit",
                      className: "text-[var(--wy-text-muted)]",
                      cell: (v: Voucher | BatchRow) => v.businessUnit,
                    },
                  ]
                : []),
              {
                id: "plan",
                header: demo ? "Plan" : "Validity",
                cell: (v) =>
                  demo ? (
                    <Select
                      value={v.plan}
                      onValueChange={(val) => {
                        setItems((its) =>
                          its.map((it) => (it.code === v.code ? { ...it, plan: val } : it)),
                        );
                        toast.success(`Plan updated to ${formatPlan(val)}`);
                      }}
                    >
                      <SelectTrigger className="h-8 w-24 text-xs" aria-label={`Plan for ${v.code}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="wy-console">
                        {planOpts.map((o) => (
                          <SelectItem key={o.v} value={o.v}>
                            {o.l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-[var(--wy-text-muted)]">{v.plan}</span>
                  ),
              },
              {
                id: "status",
                header: "Status",
                cell: (v) => (
                  <StatusBadge status={voucherStatus(v.status)} className="capitalize">
                    {v.status.replace(/_/g, " ")}
                  </StatusBadge>
                ),
              },
              {
                id: "used",
                header: demo ? "Used" : "Quantity",
                align: "right",
                className: "tabular-nums",
                cell: (v) => v.used,
              },
              ...(demo
                ? [
                    {
                      id: "redeemedAt",
                      header: "Redeemed At",
                      className: "text-[var(--wy-text-muted)]",
                      cell: (v: Voucher | BatchRow) => v.redeemedAt ?? "—",
                    },
                  ]
                : []),
            ]}
            rowActions={(v) => (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="View batch"
                  aria-label={`View ${v.code}`}
                  onClick={() => openView(v)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--wy-crit)]"
                  title="Revoke"
                  aria-label={`Revoke ${v.code}`}
                  onClick={() => revoke(v)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </>
            )}
          />
        )}
      </Panel>

      {demo && (
        // Demo mode has no real batch to export/print/email -- these stay
        // toast-only illustrations of the flow, same as the rest of this
        // page's demo seed data. The real actions live in the "View batch"
        // dialog below, scoped to one real batch (voucher.export requires
        // a batch_id -- there's no page-wide "export everything" endpoint).
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("CSV exported")}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Print job queued")}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Email sent")}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Email
          </Button>
        </div>
      )}

      <Dialog
        open={!!viewBatch}
        onOpenChange={(o) => {
          if (!o) closeView();
        }}
      >
        <DialogContent className="wy-console sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {demo ? "Voucher" : "Batch"} — {viewBatch?.code}
            </DialogTitle>
          </DialogHeader>
          {demo && viewBatch ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span>{formatPlan(viewBatch.plan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={voucherStatus(viewBatch.status)} className="capitalize">
                  {viewBatch.status}
                </StatusBadge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Used</span>
                <span>{viewBatch.used}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business Unit</span>
                <span>{viewBatch.businessUnit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Redeemed At</span>
                <span>{viewBatch.redeemedAt ?? "—"}</span>
              </div>
            </div>
          ) : viewLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              {viewStats && (
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="Total" value={String(viewStats.total)} />
                  <StatTile label="Unused" value={String(viewStats.unused)} />
                  <StatTile
                    label="Redeemed"
                    value={`${(viewStats.redemptionRate * 100).toFixed(0)}%`}
                  />
                </div>
              )}
              <div className="overflow-hidden rounded-[var(--wy-radius)] border border-[var(--wy-border)]">
                <DataTable
                  ariaLabel="Vouchers in this batch"
                  maxHeight="16rem"
                  rows={viewVouchers}
                  rowKey={(vch) => vch.id}
                  empty="No vouchers in this batch."
                  columns={[
                    {
                      id: "code",
                      header: "Code",
                      mono: true,
                      mobile: "title",
                      cell: (vch) => vch.code,
                    },
                    {
                      id: "status",
                      header: "Status",
                      cell: (vch) => (
                        <StatusBadge status={voucherStatus(vch.status)} className="capitalize">
                          {vch.status.replace(/_/g, " ")}
                        </StatusBadge>
                      ),
                    },
                    {
                      id: "uses",
                      header: "Uses",
                      align: "right",
                      className: "tabular-nums",
                      cell: (vch) => vch.useCount,
                    },
                    // Observed by the network, not typed by the guest -- see
                    // the caveat note under this table. An unused voucher has
                    // no session by definition; say so, rather than showing
                    // the same blank as a voucher whose session we could not
                    // resolve.
                    {
                      id: "mac",
                      header: "Device MAC",
                      cell: (vch) => {
                        const r = viewRedemptions.get(vch.id);
                        if (vch.useCount === 0)
                          return <span className="text-[var(--wy-text-muted)]">Not redeemed</span>;
                        return r?.deviceMac ? (
                          <span className={`flex items-center gap-1.5 ${MONO_CELL}`}>
                            {maskMac(r.deviceMac)}
                            {r.sessionCount > 1 && (
                              <Badge
                                variant="outline"
                                className="rounded-full px-1.5 py-0 text-[11px] font-normal"
                                title={`Used in ${r.sessionCount} sessions; this is the most recent.`}
                              >
                                +{r.sessionCount - 1}
                              </Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-[var(--wy-text-muted)]">—</span>
                        );
                      },
                    },
                    {
                      id: "ip",
                      header: "IP Address",
                      cell: (vch) => {
                        const r = viewRedemptions.get(vch.id);
                        if (vch.useCount === 0 || !r?.ipAddress)
                          return <span className="text-[var(--wy-text-muted)]">—</span>;
                        return <span className={MONO_CELL}>{r.ipAddress}</span>;
                      },
                    },
                  ]}
                />
              </div>
              {/* Provenance caveat. The voucher table stores a
                  self-reported "redeemed by" string typed by the guest;
                  Device MAC and IP above are observed by the network. The
                  one thing worse than a missing MAC is a made-up one shown
                  as verified, so the difference is stated rather than
                  implied by styling alone. */}
              <Callout tone="info" className="text-xs">
                <p>
                  Device MAC and IP are recorded by the network for the most recent session that
                  used each code. A code used more than once shows a{" "}
                  <span className="font-medium">+N</span> badge and may have run on other devices.
                  Anything a guest typed at the portal is self-reported and is not shown here.
                </p>
              </Callout>
              <div className="space-y-2 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-3">
                <p
                  id="voucher-export-heading"
                  className="text-xs font-medium text-[var(--wy-text)]"
                >
                  Export / send this batch
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={exporting !== null}
                    onClick={() => exportBatchCsv(viewBatch as BatchRow)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {exporting === "csv" ? "Exporting…" : "Export CSV"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={exporting !== null}
                    onClick={() => downloadBatchPdf(viewBatch as BatchRow)}
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    {exporting === "pdf" ? "Downloading…" : "Download PDF"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    aria-label="Email the batch PDF to"
                    className="h-9 min-w-0 flex-1 rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] px-2.5 text-xs text-[var(--wy-text)] outline-none focus-visible:border-[var(--wy-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wy-accent)_35%,transparent)]"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={emailing || !emailTo.trim()}
                    onClick={() => emailBatch(viewBatch as BatchRow)}
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {emailing ? "Sending…" : "Email PDF"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeView}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
