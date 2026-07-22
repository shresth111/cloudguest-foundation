import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, KeyRound, Activity, ListChecks } from "lucide-react";
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
  useAuthnPolicies, useAuthnPolicyKpis, useSaveAuthnPolicy, useDeleteAuthnPolicy,
} from "@/hooks/useAuthnPolicy";
import type { AuthnPolicy } from "@/types/authn-policy";
import type { PolicyStatus } from "@/types/policy";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  status: z.enum(["active", "draft", "archived"]),
  maxAttemptsPerWindow: z.coerce.number().int().min(1).max(1000),
  windowMinutes: z.coerce.number().int().min(1).max(1440),
});
type FormValues = z.infer<typeof schema>;

export function AuthnPolicyManagement() {
  const { data: policies = [], isLoading } = useAuthnPolicies();
  const { data: kpis } = useAuthnPolicyKpis();
  const save = useSaveAuthnPolicy();
  const del = useDeleteAuthnPolicy();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AuthnPolicy | null>(null);
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
        title="Authentication Policies"
        description="Rate limits on authentication attempts -- how many attempts are allowed within a rolling time window."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Policy
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={kpis?.total ?? 0} icon={KeyRound} tone="primary" />
        <StatCard label="Active" value={kpis?.active ?? 0} icon={Activity} tone="success" />
        <StatCard label="Drafts" value={kpis?.draft ?? 0} icon={ListChecks} tone="warning" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All authentication policies</CardTitle>
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
                <TableHead className="text-right">Max attempts</TableHead>
                <TableHead className="text-right">Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No authentication policies yet.</TableCell></TableRow>
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
                  <TableCell className="text-right tabular-nums">{p.maxAttemptsPerWindow}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.windowMinutes}m</TableCell>
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

      <AuthnPolicyDialog
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

function AuthnPolicyDialog({
  open, policy, onClose, onSave,
}: {
  open: boolean;
  policy: AuthnPolicy | null;
  onClose: () => void;
  onSave: (v: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: policy
      ? {
          name: policy.name, description: policy.description ?? "", status: policy.status,
          maxAttemptsPerWindow: policy.maxAttemptsPerWindow, windowMinutes: policy.windowMinutes,
        }
      : { name: "", description: "", status: "draft" as PolicyStatus, maxAttemptsPerWindow: 30, windowMinutes: 1 },
  });
  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); form.reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{policy ? "Edit authentication policy" : "New authentication policy"}</DialogTitle>
          <DialogDescription>
            Caps how many authentication attempts a caller may make within the given time window.
          </DialogDescription>
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
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rate limit</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Max attempts"><Input type="number" {...form.register("maxAttemptsPerWindow")} /></Field>
              <Field label="Window (minutes)"><Input type="number" {...form.register("windowMinutes")} /></Field>
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
