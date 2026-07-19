import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, Network, Activity, Users, Ban } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import { useVlans, useVlanKpis, useSaveVlan, useDeleteVlan } from "@/hooks/useVlan";
import type { Vlan, IspBinding, VlanStatus } from "@/types/vlan";
import { cn } from "@/lib/utils";

const vlanSchema = z.object({
  name: z.string().trim().min(2, "Required").max(48),
  vlanId: z.coerce.number().int().min(1, "1-4094").max(4094, "1-4094"),
  description: z.string().trim().max(240).optional(),
  subnet: z.string().regex(/^\d+\.\d+\.\d+\.\d+\/\d+$/, "CIDR e.g. 10.0.0.0/24"),
  gateway: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/, "IPv4 required"),
  dnsPrimary: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/, "IPv4 required"),
  dnsSecondary: z.string().optional(),
  dhcpEnabled: z.boolean(),
  dhcpRangeStart: z.string().optional(),
  dhcpRangeEnd: z.string().optional(),
  leaseMinutes: z.coerce.number().int().min(0).max(43_200),
  isolation: z.boolean(),
  isp: z.enum(["primary", "secondary", "failover", "none"]),
  ssids: z.string().optional(),
  status: z.enum(["active", "draft", "disabled"]),
});
type VlanFormValues = z.infer<typeof vlanSchema>;

const STEPS = [
  { id: "identity", label: "Identity" },
  { id: "network",  label: "Network" },
  { id: "dhcp",     label: "DHCP" },
  { id: "isp",      label: "ISP & QoS" },
  { id: "review",   label: "Review" },
] as const;

const statusBadge = (s: VlanStatus) =>
  s === "active" ? "default" : s === "draft" ? "secondary" : "outline";

export function VlanManagement() {
  const { data: vlans = [], isLoading } = useVlans();
  const { data: kpis } = useVlanKpis();
  const save = useSaveVlan();
  const del = useDeleteVlan();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Vlan | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) return vlans;
    const t = q.toLowerCase();
    return vlans.filter(
      (v) =>
        v.name.toLowerCase().includes(t) ||
        String(v.vlanId).includes(t) ||
        v.subnet.includes(t) ||
        v.ssids.some((s) => s.toLowerCase().includes(t)),
    );
  }, [vlans, q]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="VLAN Management"
        description="Segment traffic, bind uplinks and roll out SSIDs across every router and location."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New VLAN
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total VLANs" value={kpis?.total ?? 0} icon={Network} tone="primary" animated />
        <StatCard label="Active" value={kpis?.active ?? 0} icon={Activity} tone="success" animated />
        <StatCard label="Clients" value={kpis?.clients ?? 0} icon={Users} tone="info" animated />
        <StatCard
          label="Throughput"
          value={kpis?.totalThroughputMbps ?? 0}
          suffix=" Mbps"
          icon={Ban}
          tone="warning"
          animated
        />
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All VLANs</CardTitle>
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, tag, subnet, SSID…"
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VLAN</TableHead>
                <TableHead>Subnet</TableHead>
                <TableHead>SSIDs</TableHead>
                <TableHead>ISP</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Mbps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No VLANs match your filters.</TableCell></TableRow>
              )}
              {filtered.map((v) => (
                <TableRow key={v.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold",
                        "bg-primary/10 text-primary",
                      )}>
                        {v.vlanId}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{v.name}</div>
                        {v.description && (
                          <div className="truncate text-xs text-muted-foreground">{v.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{v.subnet}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {v.ssids.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {v.ssids.map((s) => (
                        <Badge key={s} variant="outline" className="h-5 text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{v.isp}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.clients}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.throughputMbps}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadge(v.status)} className="capitalize">{v.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(v)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        await del.mutateAsync(v.id);
                        toast.success(`VLAN ${v.name} deleted`);
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

      <VlanWizard
        open={creating || !!editing}
        vlan={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={async (values) => {
          await save.mutateAsync({
            ...(editing ? { id: editing.id } : {}),
            name: values.name,
            vlanId: values.vlanId,
            description: values.description,
            subnet: values.subnet,
            gateway: values.gateway,
            dnsPrimary: values.dnsPrimary,
            dnsSecondary: values.dnsSecondary || undefined,
            dhcpEnabled: values.dhcpEnabled,
            dhcpRangeStart: values.dhcpRangeStart || undefined,
            dhcpRangeEnd: values.dhcpRangeEnd || undefined,
            leaseMinutes: values.leaseMinutes,
            isolation: values.isolation,
            isp: values.isp as IspBinding,
            ssids: (values.ssids || "").split(",").map((s) => s.trim()).filter(Boolean),
            status: values.status,
            locationIds: editing?.locationIds ?? [],
            routerIds: editing?.routerIds ?? [],
          });
          toast.success(editing ? "VLAN updated" : "VLAN created");
          setCreating(false); setEditing(null);
        }}
      />
    </div>
  );
}

function VlanWizard({
  open, vlan, onClose, onSave,
}: {
  open: boolean;
  vlan: Vlan | null;
  onClose: () => void;
  onSave: (v: VlanFormValues) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const form = useForm<VlanFormValues>({
    resolver: zodResolver(vlanSchema),
    defaultValues: vlan
      ? {
          name: vlan.name, vlanId: vlan.vlanId, description: vlan.description ?? "",
          subnet: vlan.subnet, gateway: vlan.gateway,
          dnsPrimary: vlan.dnsPrimary, dnsSecondary: vlan.dnsSecondary ?? "",
          dhcpEnabled: vlan.dhcpEnabled,
          dhcpRangeStart: vlan.dhcpRangeStart ?? "", dhcpRangeEnd: vlan.dhcpRangeEnd ?? "",
          leaseMinutes: vlan.leaseMinutes, isolation: vlan.isolation, isp: vlan.isp,
          ssids: vlan.ssids.join(", "), status: vlan.status,
        }
      : {
          name: "", vlanId: 100, description: "",
          subnet: "10.0.0.0/24", gateway: "10.0.0.1",
          dnsPrimary: "1.1.1.1", dnsSecondary: "8.8.8.8",
          dhcpEnabled: true, dhcpRangeStart: "10.0.0.100", dhcpRangeEnd: "10.0.0.240",
          leaseMinutes: 240, isolation: true, isp: "primary",
          ssids: "", status: "draft",
        },
  });

  const values = form.watch();

  async function next() {
    const fields: Record<number, (keyof VlanFormValues)[]> = {
      0: ["name", "vlanId", "description", "status"],
      1: ["subnet", "gateway", "dnsPrimary", "dnsSecondary", "isolation"],
      2: ["dhcpEnabled", "dhcpRangeStart", "dhcpRangeEnd", "leaseMinutes"],
      3: ["isp", "ssids"],
    };
    const ok = await form.trigger(fields[step] ?? []);
    if (!ok) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setStep(0); form.reset(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vlan ? "Edit VLAN" : "New VLAN"}</DialogTitle>
          <DialogDescription>Five-step wizard — validated at every step before you can advance.</DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2 py-2 text-xs">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                i === step ? "border-primary bg-primary text-primary-foreground"
                : i < step ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
              )}>{i + 1}</span>
              <span className={cn(i === step ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
            </li>
          ))}
        </ol>

        <form onSubmit={form.handleSubmit(async (v) => { await onSave(v); setStep(0); form.reset(); })} className="space-y-4">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" error={form.formState.errors.name?.message}>
                <Input {...form.register("name")} placeholder="Guest-WiFi" />
              </Field>
              <Field label="802.1Q Tag" error={form.formState.errors.vlanId?.message}>
                <Input type="number" min={1} max={4094} {...form.register("vlanId")} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Input {...form.register("description")} placeholder="Public guest network…" />
              </Field>
              <Field label="Status">
                <Select value={values.status} onValueChange={(v) => form.setValue("status", v as VlanStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subnet (CIDR)" error={form.formState.errors.subnet?.message}>
                <Input {...form.register("subnet")} placeholder="10.0.0.0/24" className="font-mono" />
              </Field>
              <Field label="Gateway" error={form.formState.errors.gateway?.message}>
                <Input {...form.register("gateway")} placeholder="10.0.0.1" className="font-mono" />
              </Field>
              <Field label="Primary DNS" error={form.formState.errors.dnsPrimary?.message}>
                <Input {...form.register("dnsPrimary")} className="font-mono" />
              </Field>
              <Field label="Secondary DNS">
                <Input {...form.register("dnsSecondary")} className="font-mono" />
              </Field>
              <SwitchField label="Client isolation" hint="Prevents guest devices from seeing each other on L2."
                checked={values.isolation} onChange={(b) => form.setValue("isolation", b)} />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <SwitchField label="DHCP server" hint="Hand out leases from this segment."
                checked={values.dhcpEnabled} onChange={(b) => form.setValue("dhcpEnabled", b)} />
              <Field label="Lease (minutes)">
                <Input type="number" {...form.register("leaseMinutes")} />
              </Field>
              <Field label="Range start">
                <Input {...form.register("dhcpRangeStart")} className="font-mono" disabled={!values.dhcpEnabled} />
              </Field>
              <Field label="Range end">
                <Input {...form.register("dhcpRangeEnd")} className="font-mono" disabled={!values.dhcpEnabled} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Uplink binding">
                <Select value={values.isp} onValueChange={(v) => form.setValue("isp", v as IspBinding)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary ISP</SelectItem>
                    <SelectItem value="secondary">Secondary ISP</SelectItem>
                    <SelectItem value="failover">Failover</SelectItem>
                    <SelectItem value="none">No binding</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="SSIDs (comma separated)" className="sm:col-span-2">
                <Input {...form.register("ssids")} placeholder="CloudGuest, CloudGuest-5G" />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
              <h4 className="mb-3 font-semibold">Review</h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <Kv k="Name" v={values.name} />
                <Kv k="Tag" v={values.vlanId} />
                <Kv k="Subnet" v={values.subnet} mono />
                <Kv k="Gateway" v={values.gateway} mono />
                <Kv k="DNS" v={[values.dnsPrimary, values.dnsSecondary].filter(Boolean).join(", ")} mono />
                <Kv k="DHCP" v={values.dhcpEnabled ? `${values.dhcpRangeStart} – ${values.dhcpRangeEnd} (${values.leaseMinutes}m)` : "Disabled"} />
                <Kv k="Isolation" v={values.isolation ? "On" : "Off"} />
                <Kv k="ISP" v={values.isp} />
                <Kv k="SSIDs" v={values.ssids || "—"} />
                <Kv k="Status" v={values.status} />
              </dl>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
            <div className="flex gap-2">
              {step > 0 && <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>}
              {step < STEPS.length - 1 && <Button type="button" onClick={next}>Continue</Button>}
              {step === STEPS.length - 1 && <Button type="submit">{vlan ? "Save changes" : "Create VLAN"}</Button>}
            </div>
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

function SwitchField({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Kv({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("text-right text-foreground", mono && "font-mono")}>{String(v ?? "—")}</dd>
    </>
  );
}
