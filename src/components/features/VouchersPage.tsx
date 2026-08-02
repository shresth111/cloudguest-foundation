import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Trash2, Download, Printer, Mail, Eye, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { voucherService } from "@/services/voucher.service";
import { resolveOrgId } from "@/services/customer.service";
import type { Voucher as BackendVoucherModel, VoucherBatchStats } from "@/types/voucher";

interface Voucher { code: string; plan: string; status: string; used: number; businessUnit: string; redeemedAt: string | null; }
const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Clamps a (possibly NaN, from an emptied number input) value into [lo, hi], falling back to `fallback` when NaN. */
const clamp = (n: number, fallback: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isNaN(n) ? fallback : n));

const DEMO_SEED: Voucher[] = [
  { code: "VCH-8821", plan: "1h", status: "active", used: 3, businessUnit: "Mumbai HQ", redeemedAt: "Mumbai HQ" },
  { code: "VCH-8822", plan: "24h", status: "active", used: 12, businessUnit: "Delhi Office", redeemedAt: "Delhi Office" },
  { code: "VCH-8823", plan: "1h", status: "active", used: 1, businessUnit: "Bangalore DC", redeemedAt: "Bangalore DC" },
  { code: "VCH-8824", plan: "3d", status: "unused", used: 0, businessUnit: "Chennai Office", redeemedAt: null },
];

/** Real vouchers are issued in batches (backend/app/domains/voucher) --
 * a batch row here (name = quantity + status) stands in for that entity,
 * distinct from demo mode's per-code rows which have no backend match. */
interface BatchRow { id: string; code: string; plan: string; status: string; used: number; businessUnit: string; redeemedAt: string | null; organizationId: string }

/**
 * Small header-accent illustration: two perforated voucher tickets, one
 * with a code stub, connected by a dashed hand-off line -- "issue a code,
 * a guest redeems it." Same filled-flat-shape character language as the
 * other illustrations shipped this session. Purely decorative --
 * aria-hidden.
 */
function VoucherIssueIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 96 48" className="hidden h-12 w-auto shrink-0 sm:block" fill="none">
      <g transform="translate(4, 8)">
        <path d="M0 4a4 4 0 0 1 4-4h30a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.5" />
        <circle cx="22" cy="0" r="2.4" fill="#f8f9fc" />
        <circle cx="22" cy="26" r="2.4" fill="#f8f9fc" />
        <line x1="22" y1="4" x2="22" y2="22" stroke="#a78bfa" strokeOpacity="0.4" strokeDasharray="1.5 2" strokeWidth="1.2" />
        <rect x="4" y="9" width="12" height="8" rx="1.5" fill="#22d3ee" fillOpacity="0.25" stroke="#22d3ee" strokeWidth="1.1" />
        <rect x="25" y="9" width="6" height="1.6" rx="0.8" fill="#f0abfc" />
        <rect x="25" y="13" width="8" height="1.6" rx="0.8" fill="#f0abfc" fillOpacity="0.6" />
      </g>
      <motion.path
        d="M42 20q10 -6 20 0"
        stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 4" fill="none"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.g
        animate={shouldReduceMotion ? { opacity: 0.9 } : { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="80" cy="14" r="12" fill="#1e1b4b" stroke="#f0abfc" strokeWidth="2" />
        <path d="M75 14l3.5 3.5L86 10" stroke="#f0abfc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </svg>
  );
}

export function VouchersPage({ locationId }: { locationId?: string }) {
  const demo = useIsDemo();
  const [items, setItems] = useState<Voucher[]>(demo ? DEMO_SEED : []);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", businessUnit: UNITS[0], quantity: 10, validMin: 60, prefix: "VCH", dataLimit: 0, maxUses: 1, codeLen: 8 });
  const [planOpts] = useState([{v:"1h",l:"1 Hour"},{v:"24h",l:"24 Hours"},{v:"3d",l:"3 Days"},{v:"7d",l:"7 Days"}]);

  // View (Eye icon) -- the Actions column's eye button had no onClick at
  // all, so it was a real dead click. Wired to the batch's real vouchers +
  // stats (backend/app/domains/voucher already exposes both).
  const [viewBatch, setViewBatch] = useState<BatchRow | Voucher | null>(null);
  const [viewVouchers, setViewVouchers] = useState<BackendVoucherModel[]>([]);
  const [viewStats, setViewStats] = useState<VoucherBatchStats | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

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
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
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
    if (!EMAIL_RE.test(emailTo.trim())) { toast.error("Enter a valid email address."); return; }
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
    try {
      const [vouchers, stats] = await Promise.all([
        voucherService.listVouchers(b.id, b.organizationId),
        voucherService.getStats(b.id, b.organizationId),
      ]);
      setViewVouchers(vouchers.rows);
      setViewStats(stats);
    } catch {
      toast.error("Could not load this batch's vouchers.");
    } finally {
      setViewLoading(false);
    }
  };
  const closeView = () => { setViewBatch(null); setViewVouchers([]); setViewStats(null); setEmailTo(""); };

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
      setBatches(res.rows.map((b) => ({
        id: b.id, code: b.name, plan: `${b.validityMinutes}m`, status: b.status, used: b.quantity,
        businessUnit: "", redeemedAt: null, organizationId: b.organizationId,
      })));
    })()
      .catch(() => { if (!cancelled) setItems(DEMO_SEED); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [demo, locationId]);

  const rows = demo ? items : batches;

  const handleGenerate = async () => {
    if (demo) {
      const count = Math.min(form.quantity, 100);
      const newItems: Voucher[] = [];
      for (let i = 0; i < count; i++) {
        const num = String(items.length + i + 1).padStart(4, "0");
        const plan = form.validMin >= 10080 ? "7d" : form.validMin >= 4320 ? "3d" : form.validMin >= 1440 ? "24h" : "1h";
        newItems.push({ code: `${form.prefix}-${num}`, plan, status: "active", used: 0, businessUnit: form.businessUnit, redeemedAt: null });
      }
      setItems([...newItems, ...items]);
      setOpen(false);
      toast.success(`${count} vouchers generated for ${form.businessUnit}`);
      return;
    }
    try {
      const orgId = await resolveOrgId();
      const batch = await voucherService.createBatch({
        name: form.name || `Batch ${Date.now()}`, organizationId: orgId, locationId,
        quantity: Math.min(form.quantity, 100), codeLength: form.codeLen, codePrefix: form.prefix,
        validityMinutes: form.validMin, maxUsesPerVoucher: form.maxUses, dataLimitMb: form.dataLimit || null,
      });
      setBatches([{ id: batch.id, code: batch.name, plan: `${batch.validityMinutes}m`, status: batch.status, used: batch.quantity, businessUnit: "", redeemedAt: null, organizationId: batch.organizationId }, ...batches]);
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

  const formatPlan = (p: string) => planOpts.find(o => o.v === p)?.l || p;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Ticket className="h-4.5 w-4.5 text-white" />
          </div>
          <div><h2 className="text-lg font-semibold tracking-tight">Voucher Batches</h2><p className="text-sm text-muted-foreground">{rows.length} {demo ? "vouchers" : "batches"}</p></div>
          <VoucherIssueIllustration />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Bulk import started")}>Import CSV</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Generate</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Generate Voucher Batch</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="col-span-2"><Label>Batch Name</Label><Input placeholder="e.g. Summer Promo 2026" value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></div>
                {demo && <div className="col-span-2"><Label>Business Unit</Label><Select value={form.businessUnit} onValueChange={v => setForm({...form,businessUnit:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>}
                <div><Label>Quantity</Label><Input type="number" min={1} max={100} value={form.quantity} onChange={e => setForm({...form,quantity:clamp(parseInt(e.target.value),1,1,100)})} /></div>
                <div><Label>Validity (min)</Label><Input type="number" min={1} max={43200} value={form.validMin} onChange={e => setForm({...form,validMin:clamp(parseInt(e.target.value),60,1,43200)})} /></div>
                <div><Label>Code Prefix</Label><Input value={form.prefix} onChange={e => setForm({...form,prefix:e.target.value})} /></div>
                <div><Label>Code Length</Label><Input type="number" min={4} max={16} value={form.codeLen} onChange={e => setForm({...form,codeLen:clamp(parseInt(e.target.value),8,4,16)})} /></div>
                <div><Label>Data Limit (MB)</Label><Input type="number" min={0} max={102400} placeholder="0 = unlimited" value={form.dataLimit} onChange={e => setForm({...form,dataLimit:clamp(parseInt(e.target.value),0,0,102400)})} /></div>
                <div><Label>Max Uses</Label><Input type="number" min={1} max={1000} value={form.maxUses} onChange={e => setForm({...form,maxUses:clamp(parseInt(e.target.value),1,1,1000)})} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleGenerate}>Generate {form.quantity} Vouchers</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        {loading ? (
          <div className="p-4"><LoadingSkeleton rows={4} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Ticket} title="No voucher batches" description="Generate a batch above to issue guest access vouchers." />
        ) : (
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs font-medium">{demo ? "Code" : "Batch Name"}</TableHead>{demo && <TableHead className="text-xs font-medium">Business Unit</TableHead>}<TableHead className="text-xs font-medium">{demo ? "Plan" : "Validity"}</TableHead><TableHead className="text-xs font-medium">Status</TableHead><TableHead className="text-xs font-medium">{demo ? "Used" : "Quantity"}</TableHead>{demo && <TableHead className="text-xs font-medium">Redeemed At</TableHead>}<TableHead className="text-right text-xs font-medium">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map(v => (
          <TableRow key={demo ? v.code : (v as BatchRow).id} className="border-b">
            <TableCell className="font-mono text-xs">{v.code}</TableCell>
            {demo && <TableCell className="text-xs text-muted-foreground">{v.businessUnit}</TableCell>}
            {demo ? (
              <TableCell><Select value={v.plan} onValueChange={val => { setItems(its => its.map(it => it.code === v.code ? { ...it, plan: val } : it)); toast.success(`Plan updated to ${formatPlan(val)}`); }}><SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{planOpts.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent></Select></TableCell>
            ) : (
              <TableCell className="text-xs text-muted-foreground">{v.plan}</TableCell>
            )}
            <TableCell><Badge variant={v.status === "active" ? "default" : "secondary"} className="capitalize">{v.status.replace(/_/g, " ")}</Badge></TableCell>
            <TableCell className="text-sm">{v.used}</TableCell>
            {demo && <TableCell className="text-xs text-muted-foreground">{v.redeemedAt ?? "—"}</TableCell>}
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="View batch" onClick={() => openView(v)}><Eye className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => revoke(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </TableCell>
          </TableRow>
        ))}</TableBody></Table></div>
        )}
      </CardContent></Card>

      {demo && (
        // Demo mode has no real batch to export/print/email -- these stay
        // toast-only illustrations of the flow, same as the rest of this
        // page's demo seed data. The real actions live in the "View batch"
        // dialog below, scoped to one real batch (voucher.export requires
        // a batch_id -- there's no page-wide "export everything" endpoint).
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("CSV exported")}><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Print job queued")}><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Email sent")}><Mail className="mr-1.5 h-3.5 w-3.5" />Email</Button>
        </div>
      )}

      <Dialog open={!!viewBatch} onOpenChange={(o) => { if (!o) closeView(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{demo ? "Voucher" : "Batch"} — {viewBatch?.code}</DialogTitle></DialogHeader>
          {demo && viewBatch ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>{formatPlan(viewBatch.plan)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={viewBatch.status === "active" ? "default" : "secondary"} className="capitalize">{viewBatch.status}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Used</span><span>{viewBatch.used}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Business Unit</span><span>{viewBatch.businessUnit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Redeemed At</span><span>{viewBatch.redeemedAt ?? "—"}</span></div>
            </div>
          ) : viewLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              {viewStats && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{viewStats.total}</p><p className="text-muted-foreground">Total</p></div>
                  <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{viewStats.unused}</p><p className="text-muted-foreground">Unused</p></div>
                  <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{(viewStats.redemptionRate * 100).toFixed(0)}%</p><p className="text-muted-foreground">Redeemed</p></div>
                </div>
              )}
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <Table><TableHeader><TableRow><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Uses</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {viewVouchers.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">No vouchers in this batch.</TableCell></TableRow>
                    ) : viewVouchers.map((vch) => (
                      <TableRow key={vch.id}>
                        <TableCell className="font-mono text-xs">{vch.code}</TableCell>
                        <TableCell><Badge variant={vch.status === "unused" ? "secondary" : "default"} className="capitalize text-[10px]">{vch.status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-xs">{vch.useCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Export / send this batch</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={exporting !== null} onClick={() => exportBatchCsv(viewBatch as BatchRow)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />{exporting === "csv" ? "Exporting…" : "Export CSV"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={exporting !== null} onClick={() => downloadBatchPdf(viewBatch as BatchRow)}>
                    <Printer className="mr-1.5 h-3.5 w-3.5" />{exporting === "pdf" ? "Downloading…" : "Download PDF"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <input type="email" placeholder="name@company.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  <Button size="sm" className="h-8 text-xs" disabled={emailing || !emailTo.trim()} onClick={() => emailBatch(viewBatch as BatchRow)}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />{emailing ? "Sending…" : "Email PDF"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={closeView}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
