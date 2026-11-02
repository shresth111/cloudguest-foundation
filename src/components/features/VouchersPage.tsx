import { ControllerControlNotice } from "@/components/customer/ControllerControlNotice";
import { useClientControls } from "@/hooks/useClientControls";
import { nasOnlyLimitVerdict } from "@/lib/nas-only-access-rules";
import i18n from "@/lib/i18n";
import { Trans, useTranslation } from "react-i18next";
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
import { locationIsNasOnly } from "@/lib/location-liveness";
import { useCustomerStore } from "@/stores/customerStore";
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
  // Aruba Instant On only: what a voucher's data limit really does there. Renders
  // nothing, and makes no request, at any other vendor.
  const clientControls = useClientControls();
  const dataLimitVerdict = nasOnlyLimitVerdict("data-limit", clientControls.vendor, {
    cloudControl: clientControls.instantOnCloudControl === true,
  });
  const { t } = useTranslation("vouchers", { i18n });
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
  // Aruba Instant On venues only: the backend ignores it at any other vendor.
  const nasOnlyVenue = locationIsNasOnly(useCustomerStore((st) => st.activeLocation)?.liveness);
  const [sessionTimeoutMin, setSessionTimeoutMin] = useState("");
  const sessionTimeout = nasOnlyVenue && sessionTimeoutMin ? parseInt(sessionTimeoutMin, 10) : null;
  const sessionTimeoutInvalid =
    sessionTimeout !== null &&
    (!Number.isInteger(sessionTimeout) || sessionTimeout < 1 || sessionTimeout > form.validMin);
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
      toast.success(t("v.csvExported"));
    } catch {
      toast.error(t("v.couldNotExportTheCsv"));
    } finally {
      setExporting(null);
    }
  };

  const downloadBatchPdf = async (b: BatchRow) => {
    setExporting("pdf");
    try {
      const blob = await voucherService.downloadPdf(b.id, b.organizationId);
      downloadBlob(blob, `voucher_batch_${b.id}.pdf`);
      toast.success(t("v.pdfDownloaded"));
    } catch {
      toast.error(t("v.couldNotDownloadThePdf"));
    } finally {
      setExporting(null);
    }
  };

  const emailBatch = async (b: BatchRow) => {
    if (!EMAIL_RE.test(emailTo.trim())) {
      toast.error(t("v.enterAValidEmailAddress"));
      return;
    }
    setEmailing(true);
    try {
      await voucherService.emailPdf(b.id, b.organizationId, emailTo.trim());
      toast.success(t("v.voucherBatchQueuedForDelivery", { email: emailTo.trim() }));
      setEmailTo("");
    } catch {
      toast.error(t("v.couldNotSendTheEmail"));
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
      toast.error(t("v.couldNotLoadThisBatch"));
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
      toast.success(t("v.vouchersGeneratedFor", { count, businessUnit: form.businessUnit }));
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
        sessionTimeoutMinutes: sessionTimeout,
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
      toast.success(t("v.batchCreated", { name: batch.name, status: batch.status }));
    } catch {
      toast.error(t("v.couldNotGenerateTheBatch"));
    }
  };

  const revoke = async (row: BatchRow | Voucher) => {
    if (demo) {
      setItems(items.filter((x) => x.code !== row.code));
      toast.success(t("v.revoked"));
      return;
    }
    const b = row as BatchRow;
    const prev = batches;
    setBatches(batches.filter((x) => x.id !== b.id));
    try {
      await voucherService.revokeBatch(b.id, b.organizationId);
      toast.success(t("v.batchRevoked"));
    } catch {
      setBatches(prev);
      toast.error(t("v.couldNotRevokeOnThe"));
    }
  };

  const formatPlan = (p: string) => planOpts.find((o) => o.v === p)?.l || p;

  return (
    <div className="wy-console space-y-5">
      {/* Under the customer shell this is the page's only header (the shell
          passes the tab name and venue); the agent view mounts it bare. */}
      <PageHeader
        title={scope?.title ?? t("v.vouchers")}
        venue={scope?.venue}
        description={
          <>
            {t("v.intro", "Codes a guest types at the login page instead of a phone number.")}{" "}
            <span className="tabular-nums">
              {demo
                ? t("v.countVouchers", { count: rows.length })
                : t("v.countBatches", { count: rows.length })}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success(t("v.bulkImportStarted"))}
            >
              {t("v.importCsv")}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  {t("v.generate", "Generate")}
                </Button>
              </DialogTrigger>
              <DialogContent className="wy-console sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("v.generateVoucherBatch")}</DialogTitle>
                </DialogHeader>
                <FormSection variant="plain" className="py-2">
                  <FormField label={t("v.batchName")} htmlFor="voucher-batch-name" wide>
                    <Input
                      id="voucher-batch-name"
                      placeholder={t("v.eGSummerPromo2026")}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </FormField>
                  {demo && (
                    <FormField label={t("v.businessUnit")} htmlFor="voucher-business-unit" wide>
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
                  <FormField label={t("v.quantity")} htmlFor="voucher-quantity">
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
                  <FormField
                    label={t("v.validityMin")}
                    htmlFor="voucher-validity"
                    hint={
                      nasOnlyVenue
                        ? t(
                            "v.validityAruba",
                            "The guest's session ends after this time unless you set a shorter session timeout. 1440 minutes is 24 hours.",
                          )
                        : undefined
                    }
                  >
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
                  {nasOnlyVenue && (
                    <FormField
                      label={t("v.sessionTimeoutMin", "Session timeout (minutes, optional)")}
                      htmlFor="voucher-session-timeout"
                      wide
                    >
                      <Input
                        id="voucher-session-timeout"
                        type="number"
                        min={1}
                        max={form.validMin}
                        value={sessionTimeoutMin}
                        aria-invalid={sessionTimeoutInvalid}
                        onChange={(e) => setSessionTimeoutMin(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(
                          "v.sessionTimeoutHint",
                          "How long each login lasts. Blank means the full validity. Every login uses one of Max Uses, so raise Max Uses to allow more logins.",
                        )}
                      </p>
                      {sessionTimeoutInvalid && (
                        <p className="mt-1 text-xs text-destructive" role="alert">
                          {t(
                            "v.sessionTimeoutInvalid",
                            "Must be between 1 minute and the validity.",
                          )}
                        </p>
                      )}
                    </FormField>
                  )}
                  <FormField label={t("v.codePrefix")} htmlFor="voucher-prefix">
                    <Input
                      id="voucher-prefix"
                      value={form.prefix}
                      onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                    />
                  </FormField>
                  <FormField label={t("v.codeLength")} htmlFor="voucher-code-length">
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
                  <FormField label={t("v.dataLimitMb")} htmlFor="voucher-data-limit">
                    <Input
                      id="voucher-data-limit"
                      type="number"
                      min={0}
                      max={102400}
                      placeholder={t("v.0Unlimited")}
                      value={form.dataLimit}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          dataLimit: clamp(parseInt(e.target.value), 0, 0, 102400),
                        })
                      }
                    />
                    <ControllerControlNotice verdict={dataLimitVerdict} />
                  </FormField>
                  <FormField label={t("v.maxUses")} htmlFor="voucher-max-uses">
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
                    {t("v.cancel")}
                  </Button>
                  <Button onClick={handleGenerate} disabled={sessionTimeoutInvalid}>
                    {t("v.generateN", { count: Number(form.quantity) || 0 })}
                  </Button>
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
            ariaLabel={demo ? t("v.vouchers") : t("v.voucherBatches")}
            rows={rows}
            rowKey={(v) => (demo ? v.code : (v as BatchRow).id)}
            empty={
              <EmptyState
                icon={Ticket}
                title={t("v.noVoucherBatches")}
                description={t("v.generateABatchAboveTo")}
              />
            }
            actionsLabel="Actions"
            columns={[
              {
                id: "code",
                header: demo ? t("v.code") : t("v.batchName"),
                mono: true,
                mobile: "title",
                cell: (v) => v.code,
              },
              ...(demo
                ? [
                    {
                      id: "unit",
                      header: t("v.businessUnit"),
                      className: "text-[var(--wy-text-muted)]",
                      cell: (v: Voucher | BatchRow) => v.businessUnit,
                    },
                  ]
                : []),
              {
                id: "plan",
                header: demo ? t("v.plan") : t("v.validity"),
                cell: (v) =>
                  demo ? (
                    <Select
                      value={v.plan}
                      onValueChange={(val) => {
                        setItems((its) =>
                          its.map((it) => (it.code === v.code ? { ...it, plan: val } : it)),
                        );
                        toast.success(t("v.planUpdatedTo", { val: formatPlan(val) }));
                      }}
                    >
                      <SelectTrigger
                        className="h-8 w-24 text-xs"
                        aria-label={t("v.planFor", { code: v.code })}
                      >
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
                header: t("v.status"),
                cell: (v) => (
                  <StatusBadge status={voucherStatus(v.status)} className="capitalize">
                    {v.status.replace(/_/g, " ")}
                  </StatusBadge>
                ),
              },
              {
                id: "used",
                header: demo ? t("v.used") : t("v.quantity"),
                align: "right",
                className: "tabular-nums",
                cell: (v) => v.used,
              },
              ...(demo
                ? [
                    {
                      id: "redeemedAt",
                      header: t("v.redeemedAt"),
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
                  title={t("v.viewBatch")}
                  aria-label={t("v.view", { code: v.code })}
                  onClick={() => openView(v)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--wy-crit)]"
                  title={t("v.revoke")}
                  aria-label={t("v.revoke2", { code: v.code })}
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
          <Button variant="outline" size="sm" onClick={() => toast.success(t("v.csvExported"))}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success(t("v.printJobQueued"))}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            {t("v.print", "Print")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success(t("v.emailSent"))}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            {t("v.email", "Email")}
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
              {demo ? t("v.voucher") : t("v.batch")} — {viewBatch?.code}
            </DialogTitle>
          </DialogHeader>
          {demo && viewBatch ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("v.plan")}</span>
                <span>{formatPlan(viewBatch.plan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("v.status")}</span>
                <StatusBadge status={voucherStatus(viewBatch.status)} className="capitalize">
                  {viewBatch.status}
                </StatusBadge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("v.used")}</span>
                <span>{viewBatch.used}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("v.businessUnit")}</span>
                <span>{viewBatch.businessUnit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("v.redeemedAt")}</span>
                <span>{viewBatch.redeemedAt ?? "—"}</span>
              </div>
            </div>
          ) : viewLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("v.loading")}</p>
          ) : (
            <div className="space-y-4">
              {viewStats && (
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label={t("v.total")} value={String(viewStats.total)} />
                  <StatTile label={t("v.unused")} value={String(viewStats.unused)} />
                  <StatTile
                    label={t("v.redeemed")}
                    value={`${(viewStats.redemptionRate * 100).toFixed(0)}%`}
                  />
                </div>
              )}
              <div className="overflow-hidden rounded-[var(--wy-radius)] border border-[var(--wy-border)]">
                <DataTable
                  ariaLabel={t("v.vouchersInThisBatch")}
                  maxHeight="16rem"
                  rows={viewVouchers}
                  rowKey={(vch) => vch.id}
                  empty={t("v.noVouchersInThisBatch")}
                  columns={[
                    {
                      id: "code",
                      header: t("v.code"),
                      mono: true,
                      mobile: "title",
                      cell: (vch) => vch.code,
                    },
                    {
                      id: "status",
                      header: t("v.status"),
                      cell: (vch) => (
                        <StatusBadge status={voucherStatus(vch.status)} className="capitalize">
                          {vch.status.replace(/_/g, " ")}
                        </StatusBadge>
                      ),
                    },
                    {
                      id: "uses",
                      header: t("v.uses"),
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
                      header: t("v.deviceMac"),
                      cell: (vch) => {
                        const r = viewRedemptions.get(vch.id);
                        if (vch.useCount === 0)
                          return (
                            <span className="text-[var(--wy-text-muted)]">
                              {t("v.notRedeemed")}
                            </span>
                          );
                        return r?.deviceMac ? (
                          <span className={`flex items-center gap-1.5 ${MONO_CELL}`}>
                            {maskMac(r.deviceMac)}
                            {r.sessionCount > 1 && (
                              <Badge
                                variant="outline"
                                className="rounded-full px-1.5 py-0 text-[11px] font-normal"
                                title={t("v.usedInSessionsThisIs", {
                                  sessionCount: r.sessionCount,
                                })}
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
                      header: t("v.ipAddress"),
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
                  <Trans
                    t={t}
                    i18nKey="v.provenance"
                    components={{ b: <span className="font-medium" /> }}
                  />
                </p>
              </Callout>
              <div className="space-y-2 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-3">
                <p
                  id="voucher-export-heading"
                  className="text-xs font-medium text-[var(--wy-text)]"
                >
                  {t("v.exportSendThisBatch")}
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
                    {exporting === "csv" ? t("v.exporting") : t("v.exportCsv")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={exporting !== null}
                    onClick={() => downloadBatchPdf(viewBatch as BatchRow)}
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    {exporting === "pdf" ? t("v.downloading") : t("v.downloadPdf")}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    aria-label={t("v.emailTheBatchPdfTo")}
                    className="h-9 min-w-0 flex-1 rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] px-2.5 text-xs text-[var(--wy-text)] outline-none focus-visible:border-[var(--wy-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wy-accent)_35%,transparent)]"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={emailing || !emailTo.trim()}
                    onClick={() => emailBatch(viewBatch as BatchRow)}
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {emailing ? t("v.sending") : t("v.emailPdf")}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeView}>
              {t("v.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
