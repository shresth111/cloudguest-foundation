import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, Shield, Activity, ListChecks, Target } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { usePolicies, usePolicyKpis, useSavePolicy, useDeletePolicy } from "@/hooks/usePolicy";
import type { AuthMethod, Policy, PolicyScope, PolicyStatus } from "@/types/policy";
import { cn } from "@/lib/utils";

const AUTH_METHODS: { id: AuthMethod; label: string }[] = [
  { id: "otp_sms", label: "SMS OTP" },
  { id: "otp_email", label: "Email OTP" },
  { id: "voucher", label: "Voucher" },
  { id: "social", label: "Social" },
  { id: "pms", label: "PMS" },
  { id: "click_through", label: "Click-through" },
  { id: "radius", label: "RADIUS" },
];

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  status: z.enum(["active", "draft", "archived"]),
  priority: z.coerce.number().int().min(1).max(999),
  downloadKbps: z.coerce.number().int().min(0).max(10_000_000),
  uploadKbps: z.coerce.number().int().min(0).max(10_000_000),
  dailyMB: z.coerce.number().int().min(0).max(1_000_000).optional(),
  sessionMinutes: z.coerce.number().int().min(0).max(43_200).optional(),
  maxDevices: z.coerce.number().int().min(0).max(50),
  allowBYOD: z.boolean(),
  targets: z.string().optional(),
  authMethods: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  scope: PolicyScope;
  title: string;
  description: string;
  targetLabel: string;   // e.g. "Location IDs", "User IDs", "Group IDs"
  targetHelp: string;
}

export function PolicyManagement({ scope, title, description, targetLabel, targetHelp }: Props) {
  const { data: policies = [], isLoading } = usePolicies(scope);
  const { data: kpis } = usePolicyKpis(scope);
  const save = useSavePolicy();
  const del = useDeletePolicy();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Policy | null>(null);
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
        title={title}
        description={description}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Policy
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={kpis?.total ?? 0} icon={Shield} tone="primary" />
        <StatCard label="Active" value={kpis?.active ?? 0} icon={Activity} tone="success" />
        <StatCard label="Drafts" value={kpis?.draft ?? 0} icon={ListChecks} tone="warning" />
        <StatCard label="Assigned Targets" value={kpis?.assignedTargets ?? 0} icon={Target} tone="info" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All policies</CardTitle>
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
                <TableHead className="text-right">Priority</TableHead>
                <TableHead>Bandwidth</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead className="text-right">Targets</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No policies yet.</TableCell></TableRow>
              )}
              {filtered.map((p) => {
                const targets = scope === "location" ? p.locationIds.length
                  : scope === "user" ? p.userIds.length : p.groupIds.length;
                return (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        {p.description && (
                          <div className="truncate text-xs text-muted-foreground">{p.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.priority}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      ↓{fmtKbps(p.bandwidth.downloadKbps)} ↑{fmtKbps(p.bandwidth.uploadKbps)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.quota.dailyMB != null ? `${p.quota.dailyMB} MB/day` : ""}
                      {p.quota.sessionMinutes != null ? `${p.quota.sessionMinutes}m session` : ""}
                      {!p.quota.dailyMB && !p.quota.sessionMinutes && "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.authMethods.length === 0 && <span className="text-xs text-muted-foreground">Blocked</span>}
                        {p.authMethods.slice(0, 3).map((m) => (
                          <Badge key={m} variant="outline" className="h-5 text-[10px]">{m.replace("_", " ")}</Badge>
                        ))}
                        {p.authMethods.length > 3 && <span className="text-xs text-muted-foreground">+{p.authMethods.length - 3}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{targets}</TableCell>
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
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PolicyDialog
        open={creating || !!editing}
        scope={scope}
        policy={editing}
        targetLabel={targetLabel}
        targetHelp={targetHelp}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={async (v) => {
          const targetIds = (v.targets ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          await save.mutateAsync({
            ...(editing ? { id: editing.id } : {}),
            scope,
            name: v.name,
            description: v.description,
            status: v.status,
            priority: v.priority,
            bandwidth: { downloadKbps: v.downloadKbps, uploadKbps: v.uploadKbps },
            quota: { dailyMB: v.dailyMB, sessionMinutes: v.sessionMinutes },
            device: {
              maxDevicesPerGuest: v.maxDevices, allowBYOD: v.allowBYOD, blockedOSes: [],
            },
            authMethods: v.authMethods as AuthMethod[],
            locationIds: scope === "location" ? targetIds : editing?.locationIds ?? [],
            userIds: scope === "user" ? targetIds : editing?.userIds ?? [],
            groupIds: scope === "group" ? targetIds : editing?.groupIds ?? [],
            vlanIds: editing?.vlanIds ?? [],
            timeWindow: editing?.timeWindow,
          });
          toast.success(editing ? "Policy updated" : "Policy created");
          setCreating(false); setEditing(null);
        }}
      />
    </div>
  );
}

function fmtKbps(k: number) {
  if (k >= 1000) return `${(k / 1000).toFixed(k >= 10_000 ? 0 : 1)} Mbps`;
  return `${k} Kbps`;
}

function PolicyDialog({
  open, scope, policy, targetLabel, targetHelp, onClose, onSave,
}: {
  open: boolean;
  scope: PolicyScope;
  policy: Policy | null;
  targetLabel: string;
  targetHelp: string;
  onClose: () => void;
  onSave: (v: FormValues) => Promise<void>;
}) {
  const targetsSeed =
    scope === "location" ? (policy?.locationIds ?? []).join(", ") :
    scope === "user"     ? (policy?.userIds ?? []).join(", ") :
    (policy?.groupIds ?? []).join(", ");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: policy
      ? {
          name: policy.name, description: policy.description ?? "",
          status: policy.status, priority: policy.priority,
          downloadKbps: policy.bandwidth.downloadKbps,
          uploadKbps: policy.bandwidth.uploadKbps,
          dailyMB: policy.quota.dailyMB, sessionMinutes: policy.quota.sessionMinutes,
          maxDevices: policy.device.maxDevicesPerGuest,
          allowBYOD: policy.device.allowBYOD,
          targets: targetsSeed,
          authMethods: policy.authMethods,
        }
      : {
          name: "", description: "", status: "draft" as PolicyStatus, priority: 50,
          downloadKbps: 10_000, uploadKbps: 5_000, dailyMB: 1_000, sessionMinutes: 240,
          maxDevices: 3, allowBYOD: true, targets: "",
          authMethods: ["otp_sms"],
        },
  });
  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); form.reset(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{policy ? "Edit policy" : "New policy"}</DialogTitle>
          <DialogDescription>
            {scope === "location" && "Applies to selected locations — lowest priority wins on conflict."}
            {scope === "user" && "Applies to specific guest identities across every location."}
            {scope === "group" && "Applies to a named group of users across every location."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(async (v) => { await onSave(v); form.reset(); })} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Priority" hint="Lower runs first">
              <Input type="number" {...form.register("priority")} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Input {...form.register("description")} />
            </Field>
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
            <SwitchField label="Allow BYOD" checked={values.allowBYOD}
              onChange={(b) => form.setValue("allowBYOD", b)} />
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bandwidth</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Download (Kbps)"><Input type="number" {...form.register("downloadKbps")} /></Field>
              <Field label="Upload (Kbps)"><Input type="number" {...form.register("uploadKbps")} /></Field>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quota & devices</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Daily cap (MB)"><Input type="number" {...form.register("dailyMB")} /></Field>
              <Field label="Session (min)"><Input type="number" {...form.register("sessionMinutes")} /></Field>
              <Field label="Max devices"><Input type="number" {...form.register("maxDevices")} /></Field>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authentication methods</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AUTH_METHODS.map((m) => {
                const on = values.authMethods.includes(m.id);
                return (
                  <button type="button" key={m.id}
                    onClick={() => {
                      const next = on
                        ? values.authMethods.filter((x) => x !== m.id)
                        : [...values.authMethods, m.id];
                      form.setValue("authMethods", next);
                    }}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-xs transition",
                      on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40",
                    )}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label={targetLabel} hint={targetHelp}>
            <Input {...form.register("targets")} placeholder="id_1, id_2, id_3" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">{policy ? "Save changes" : "Create policy"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
      <div className="text-sm font-medium">{label}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
