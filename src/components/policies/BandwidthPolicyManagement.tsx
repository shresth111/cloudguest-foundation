import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, Gauge, Activity, ListChecks } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useBandwidthPolicies, useBandwidthPolicyKpis, useSaveBandwidthPolicy, useDeleteBandwidthPolicy,
} from "@/hooks/useBandwidthPolicy";
import type { BandwidthPolicy } from "@/types/bandwidth-policy";
import type { PolicyStatus } from "@/types/policy";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  status: z.enum(["active", "draft", "archived"]),
  downloadRateKbps: z.coerce.number().int().min(0).max(10_000_000),
  uploadRateKbps: z.coerce.number().int().min(0).max(10_000_000),
  burstDownloadKbps: z.coerce.number().int().min(0).optional(),
  burstUploadKbps: z.coerce.number().int().min(0).optional(),
  burstThresholdKbps: z.coerce.number().int().min(0).optional(),
  burstTimeSeconds: z.coerce.number().int().min(0).optional(),
  priority: z.coerce.number().int().min(1).max(8).optional(),
});
type FormValues = z.infer<typeof schema>;

function fmtKbps(k: number) {
  if (k >= 1000) return `${(k / 1000).toFixed(k >= 10_000 ? 0 : 1)} Mbps`;
  return `${k} Kbps`;
}

export function BandwidthPolicyManagement() {
  const { data: policies = [], isLoading } = useBandwidthPolicies();
  const { data: kpis } = useBandwidthPolicyKpis();
  const save = useSaveBandwidthPolicy();
  const del = useDeleteBandwidthPolicy();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<BandwidthPolicy | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) return policies;
    const t = q.toLowerCase();
    return policies.filter((p) =>
      p.name.toLowerCase().includes(t) || (p.description ?? "").toLowerCase().includes(t),
    );
  }, [policies, q]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Policies"
        title="Bandwidth Policies"
        description="Reusable rate-limit templates -- download/upload caps, burst allowances and queue priority."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Policy
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={kpis?.total ?? 0} icon={Gauge} tone="primary" />
        <StatCard label="Active" value={kpis?.active ?? 0} icon={Activity} tone="success" />
        <StatCard label="Drafts" value={kpis?.draft ?? 0} icon={ListChecks} tone="warning" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All bandwidth policies</CardTitle>
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-8" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Burst</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No bandwidth policies yet.</TableCell></TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      {p.description && (
                        <div className="truncate text-xs text-muted-foreground">{p.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    ↓{fmtKbps(p.downloadRateKbps)} ↑{fmtKbps(p.uploadRateKbps)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {p.burstDownloadKbps || p.burstUploadKbps
                      ? `↓${p.burstDownloadKbps ?? "—"} ↑${p.burstUploadKbps ?? "—"} Kbps`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.priority ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "default" : p.status === "draft" ? "secondary" : "outline"} className="capitalize">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        await del.mutateAsync(p.id);
                        toast.success("Policy deleted");
                      }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BandwidthPolicyDialog
        open={creating || !!editing}
        policy={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={async (v) => {
          await save.mutateAsync({ ...(editing ? { id: editing.id } : {}), ...v });
          toast.success(editing ? "Policy updated" : "Policy created");
          setCreating(false); setEditing(null);
        }}
      />
    </div>
  );
}

function BandwidthPolicyDialog({
  open, policy, onClose, onSave,
}: {
  open: boolean;
  policy: BandwidthPolicy | null;
  onClose: () => void;
  onSave: (v: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: policy
      ? {
          name: policy.name, description: policy.description ?? "", status: policy.status,
          downloadRateKbps: policy.downloadRateKbps, uploadRateKbps: policy.uploadRateKbps,
          burstDownloadKbps: policy.burstDownloadKbps, burstUploadKbps: policy.burstUploadKbps,
          burstThresholdKbps: policy.burstThresholdKbps, burstTimeSeconds: policy.burstTimeSeconds,
          priority: policy.priority,
        }
      : {
          name: "", description: "", status: "draft" as PolicyStatus,
          downloadRateKbps: 10_000, uploadRateKbps: 5_000,
        },
  });
  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); form.reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{policy ? "Edit bandwidth policy" : "New bandwidth policy"}</DialogTitle>
          <DialogDescription>Raw rate-limit values, composed by the Queue Management engine.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(async (v) => { await onSave(v); form.reset(); })} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} disabled={!!policy} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Input {...form.register("description")} disabled={!!policy} />
            </Field>
            {policy && (
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Name and description are set once at creation (no update endpoint exists on the
                backend) -- only the rule values and status below can be changed.
              </p>
            )}
            <Field label="Status">
              <Select value={values.status} onValueChange={(v) => form.setValue("status", v as PolicyStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority (1-8)"><Input type="number" {...form.register("priority")} /></Field>
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rate</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Download (Kbps)"><Input type="number" {...form.register("downloadRateKbps")} /></Field>
              <Field label="Upload (Kbps)"><Input type="number" {...form.register("uploadRateKbps")} /></Field>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Burst (optional)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Burst download (Kbps)"><Input type="number" {...form.register("burstDownloadKbps")} /></Field>
              <Field label="Burst upload (Kbps)"><Input type="number" {...form.register("burstUploadKbps")} /></Field>
              <Field label="Burst threshold (Kbps)"><Input type="number" {...form.register("burstThresholdKbps")} /></Field>
              <Field label="Burst time (seconds)"><Input type="number" {...form.register("burstTimeSeconds")} /></Field>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">{policy ? "Save changes" : "Create policy"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
