import { useEffect, useState } from "react";
import { Plus, Trash2, Download, Printer, Mail, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { isDemo } from "@/services/customer.service";
import { voucherService } from "@/services/voucher.service";
import { organizationService } from "@/services/organization.service";

interface Voucher { code: string; plan: string; status: string; used: number; businessUnit: string; redeemedAt: string | null; }
const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];

const DEMO_SEED: Voucher[] = [
  { code: "VCH-8821", plan: "1h", status: "active", used: 3, businessUnit: "Marina Bay Hotel", redeemedAt: "Marina Bay Hotel" },
  { code: "VCH-8822", plan: "24h", status: "active", used: 12, businessUnit: "Downtown CoWork", redeemedAt: "Downtown CoWork" },
  { code: "VCH-8823", plan: "1h", status: "active", used: 1, businessUnit: "Eastside Cafe", redeemedAt: "Eastside Cafe" },
  { code: "VCH-8824", plan: "3d", status: "unused", used: 0, businessUnit: "Airport Lounge T3", redeemedAt: null },
];

/** Real vouchers are issued in batches (backend/app/domains/voucher) --
 * a batch row here (name = quantity + status) stands in for that entity,
 * distinct from demo mode's per-code rows which have no backend match. */
interface BatchRow { id: string; code: string; plan: string; status: string; used: number; businessUnit: string; redeemedAt: string | null; organizationId: string }

export function VouchersPage({ locationId }: { locationId?: string }) {
  const demo = isDemo();
  const [items, setItems] = useState<Voucher[]>(demo ? DEMO_SEED : []);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", businessUnit: UNITS[0], quantity: 10, validMin: 60, prefix: "VCH", dataLimit: 0, maxUses: 1, codeLen: 8 });
  const [planOpts] = useState([{v:"1h",l:"1 Hour"},{v:"24h",l:"24 Hours"},{v:"3d",l:"3 Days"},{v:"7d",l:"7 Days"}]);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const orgs = await organizationService.list({ page: 1, pageSize: 1 });
      const orgId = orgs.rows[0]?.id;
      if (!orgId) throw new Error("No organization for this session");
      const res = await voucherService.listBatches(1, 50);
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
      const orgs = await organizationService.list({ page: 1, pageSize: 1 });
      const orgId = orgs.rows[0]?.id;
      if (!orgId) throw new Error("No organization for this session");
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
        <div><h2 className="text-lg font-semibold">Voucher Batches</h2><p className="text-sm text-muted-foreground">{rows.length} {demo ? "vouchers" : "batches"}</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Bulk import started")}>Import CSV</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Generate</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Generate Voucher Batch</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="col-span-2"><Label>Batch Name</Label><Input placeholder="e.g. Summer Promo 2026" value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></div>
                {demo && <div className="col-span-2"><Label>Business Unit</Label><Select value={form.businessUnit} onValueChange={v => setForm({...form,businessUnit:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>}
                <div><Label>Quantity</Label><Input type="number" min={1} max={100} value={form.quantity} onChange={e => setForm({...form,quantity:parseInt(e.target.value)||1})} /></div>
                <div><Label>Validity (min)</Label><Input type="number" min={1} value={form.validMin} onChange={e => setForm({...form,validMin:parseInt(e.target.value)||60})} /></div>
                <div><Label>Code Prefix</Label><Input value={form.prefix} onChange={e => setForm({...form,prefix:e.target.value})} /></div>
                <div><Label>Code Length</Label><Input type="number" min={4} max={16} value={form.codeLen} onChange={e => setForm({...form,codeLen:parseInt(e.target.value)||8})} /></div>
                <div><Label>Data Limit (MB)</Label><Input type="number" min={0} value={form.dataLimit} onChange={e => setForm({...form,dataLimit:parseInt(e.target.value)||0})} /></div>
                <div><Label>Max Uses</Label><Input type="number" min={1} value={form.maxUses} onChange={e => setForm({...form,maxUses:parseInt(e.target.value)||1})} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleGenerate}>Generate {form.quantity} Vouchers</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs font-medium">{demo ? "Code" : "Batch Name"}</TableHead>{demo && <TableHead className="text-xs font-medium">Business Unit</TableHead>}<TableHead className="text-xs font-medium">{demo ? "Plan" : "Validity"}</TableHead><TableHead className="text-xs font-medium">Status</TableHead><TableHead className="text-xs font-medium">{demo ? "Used" : "Quantity"}</TableHead>{demo && <TableHead className="text-xs font-medium">Redeemed At</TableHead>}<TableHead className="text-right text-xs font-medium">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No voucher batches yet.</TableCell></TableRow>
          ) : rows.map(v => (
          <TableRow key={demo ? v.code : (v as BatchRow).id} className="border-b">
            <TableCell className="font-mono text-xs">{v.code}</TableCell>
            {demo && <TableCell className="text-xs text-muted-foreground">{v.businessUnit}</TableCell>}
            {demo ? (
              <TableCell><Select defaultValue={v.plan} onValueChange={val => toast.success(`Plan: ${formatPlan(val)}`)}><SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger><SelectContent>{planOpts.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent></Select></TableCell>
            ) : (
              <TableCell className="text-xs text-muted-foreground">{v.plan}</TableCell>
            )}
            <TableCell><Badge variant={v.status === "active" ? "default" : "secondary"} className="capitalize">{v.status.replace(/_/g, " ")}</Badge></TableCell>
            <TableCell className="text-sm">{v.used}</TableCell>
            {demo && <TableCell className="text-xs text-muted-foreground">{v.redeemedAt ?? "—"}</TableCell>}
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => revoke(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </TableCell>
          </TableRow>
        ))}</TableBody></Table></div></CardContent></Card>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => toast.success("CSV exported")}><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button>
        <Button variant="outline" size="sm" onClick={() => toast.success("Print job queued")}><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button>
        <Button variant="outline" size="sm" onClick={() => toast.success("Email sent")}><Mail className="mr-1.5 h-3.5 w-3.5" />Email</Button>
      </div>
    </div>
  );
}
