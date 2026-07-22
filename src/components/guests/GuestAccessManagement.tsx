import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, ShieldCheck, ShieldOff, Star, Trash2, Clock, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useCheckAccess,
  useCreateDeviceRule,
  useCreateGuestRule,
  useDeactivateDeviceRule,
  useDeactivateGuestRule,
  useDeleteDeviceRule,
  useDeleteGuestRule,
  useDeviceAccessRules,
  useGuestAccessKpis,
  useGuestAccessOrganizations,
  useGuestAccessRules,
} from "@/hooks/useGuestAccess";
import type { AccessRuleType } from "@/types/guest-access";
import type { AppError } from "@/services/api";

const RULE_TYPES: { id: AccessRuleType; label: string }[] = [
  { id: "whitelist", label: "Whitelist" },
  { id: "blocklist", label: "Blocklist" },
  { id: "temporary", label: "Temporary" },
  { id: "vip", label: "VIP" },
];

function ruleBadgeVariant(t: AccessRuleType): "default" | "secondary" | "destructive" | "outline" {
  if (t === "vip") return "default";
  if (t === "blocklist") return "destructive";
  if (t === "temporary") return "secondary";
  return "outline";
}

const guestRuleSchema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  identifier: z.string().trim().min(1, "Required").max(255),
  ruleType: z.enum(["whitelist", "blocklist", "temporary", "vip"]),
  reason: z.string().trim().max(2000).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});
type GuestRuleForm = z.infer<typeof guestRuleSchema>;

const deviceRuleSchema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  macAddress: z.string().trim().min(12, "Required").max(17),
  ruleType: z.enum(["whitelist", "blocklist", "temporary", "vip"]),
  reason: z.string().trim().max(2000).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});
type DeviceRuleForm = z.infer<typeof deviceRuleSchema>;

export function GuestAccessManagement() {
  const [tab, setTab] = useState<"guest" | "device" | "check">("guest");
  const [search, setSearch] = useState("");
  const guestRules = useGuestAccessRules();
  const deviceRules = useDeviceAccessRules();
  const { data: kpis } = useGuestAccessKpis();
  const { data: orgs = [] } = useGuestAccessOrganizations();

  const [creatingGuest, setCreatingGuest] = useState(false);
  const [creatingDevice, setCreatingDevice] = useState(false);

  const filteredGuestRules = useMemo(() => {
    const rows = guestRules.data ?? [];
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => r.identifier.toLowerCase().includes(s));
  }, [guestRules.data, search]);

  const filteredDeviceRules = useMemo(() => {
    const rows = deviceRules.data ?? [];
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => r.macAddress.toLowerCase().includes(s));
  }, [deviceRules.data, search]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Guest Management"
        title="Guest Access Rules"
        description="Whitelist, blocklist, temporary and VIP overrides for guest identifiers and devices, resolved with VIP > Temporary > Blocklist > Whitelist precedence."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Guest rules" value={kpis?.totalGuestRules ?? 0} icon={Fingerprint} tone="primary" />
        <StatCard label="Device rules" value={kpis?.totalDeviceRules ?? 0} icon={ShieldCheck} tone="info" />
        <StatCard label="Active" value={kpis?.activeRules ?? 0} icon={ShieldCheck} tone="success" />
        <StatCard label="VIP" value={kpis?.vipCount ?? 0} icon={Star} tone="warning" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="guest">Guest rules</TabsTrigger>
            <TabsTrigger value="device">Device rules</TabsTrigger>
            <TabsTrigger value="check">Access check</TabsTrigger>
          </TabsList>
          {tab !== "check" && (
            <div className="flex items-center gap-2">
              <div className="relative w-64 max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
              </div>
              <Button size="sm" onClick={() => (tab === "guest" ? setCreatingGuest(true) : setCreatingDevice(true))}>
                <Plus className="mr-1.5 h-4 w-4" /> New rule
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="guest" className="mt-4">
          <GuestRuleTable rows={filteredGuestRules} isLoading={guestRules.isLoading} />
        </TabsContent>
        <TabsContent value="device" className="mt-4">
          <DeviceRuleTable rows={filteredDeviceRules} isLoading={deviceRules.isLoading} />
        </TabsContent>
        <TabsContent value="check" className="mt-4">
          <AccessCheckPanel />
        </TabsContent>
      </Tabs>

      <GuestRuleDialog open={creatingGuest} orgs={orgs} onClose={() => setCreatingGuest(false)} />
      <DeviceRuleDialog open={creatingDevice} orgs={orgs} onClose={() => setCreatingDevice(false)} />
    </div>
  );
}

function GuestRuleTable({
  rows, isLoading,
}: {
  rows: ReturnType<typeof useGuestAccessRules>["data"];
  isLoading: boolean;
}) {
  const deactivate = useDeactivateGuestRule();
  const del = useDeleteGuestRule();
  const list = rows ?? [];

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identifier</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && list.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No guest rules yet.</TableCell></TableRow>
            )}
            {list.map((r) => (
              <TableRow key={r.id} className="group">
                <TableCell className="font-medium">{r.identifier}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.organizationName}</TableCell>
                <TableCell><Badge variant={ruleBadgeVariant(r.ruleType)} className="capitalize">{r.ruleType}</Badge></TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.expiresAt ? new Date(r.expiresAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {r.isActive && (
                      <Button
                        size="icon" variant="ghost"
                        title="Deactivate"
                        onClick={async () => {
                          await deactivate.mutateAsync({ id: r.id, organizationId: r.organizationId });
                          toast.success("Rule deactivated");
                        }}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon" variant="ghost"
                      onClick={async () => {
                        await del.mutateAsync({ id: r.id, organizationId: r.organizationId });
                        toast.success("Rule deleted");
                      }}
                    >
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
  );
}

function DeviceRuleTable({
  rows, isLoading,
}: {
  rows: ReturnType<typeof useDeviceAccessRules>["data"];
  isLoading: boolean;
}) {
  const deactivate = useDeactivateDeviceRule();
  const del = useDeleteDeviceRule();
  const list = rows ?? [];

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MAC address</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && list.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No device rules yet.</TableCell></TableRow>
            )}
            {list.map((r) => (
              <TableRow key={r.id} className="group">
                <TableCell className="font-mono text-sm">{r.macAddress}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.organizationName}</TableCell>
                <TableCell><Badge variant={ruleBadgeVariant(r.ruleType)} className="capitalize">{r.ruleType}</Badge></TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.expiresAt ? new Date(r.expiresAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {r.isActive && (
                      <Button
                        size="icon" variant="ghost"
                        title="Deactivate"
                        onClick={async () => {
                          await deactivate.mutateAsync({ id: r.id, organizationId: r.organizationId });
                          toast.success("Rule deactivated");
                        }}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon" variant="ghost"
                      onClick={async () => {
                        await del.mutateAsync({ id: r.id, organizationId: r.organizationId });
                        toast.success("Rule deleted");
                      }}
                    >
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
  );
}

function GuestRuleDialog({
  open, orgs, onClose,
}: {
  open: boolean;
  orgs: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const create = useCreateGuestRule();
  const form = useForm<GuestRuleForm>({
    resolver: zodResolver(guestRuleSchema),
    defaultValues: { organizationId: "", identifier: "", ruleType: "whitelist", reason: "", expiresAt: "" },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New guest access rule</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await create.mutateAsync({
                organizationId: v.organizationId,
                identifier: v.identifier,
                ruleType: v.ruleType,
                reason: v.reason || undefined,
                expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
              });
              toast.success("Guest rule created");
              form.reset();
              onClose();
            } catch (err) {
              toast.error((err as unknown as AppError).message || "Failed to create rule");
            }
          })}
        >
          <div>
            <Label>Organization</Label>
            <Select value={form.watch("organizationId")} onValueChange={(v) => form.setValue("organizationId", v)}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="identifier">Identifier (phone, email, etc.)</Label>
            <Input id="identifier" {...form.register("identifier")} />
          </div>
          <div>
            <Label>Rule type</Label>
            <Select value={form.watch("ruleType")} onValueChange={(v) => form.setValue("ruleType", v as AccessRuleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.watch("ruleType") === "temporary" && (
            <div>
              <Label htmlFor="expiresAt">Expires at</Label>
              <Input id="expiresAt" type="datetime-local" {...form.register("expiresAt")} />
            </div>
          )}
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" rows={2} {...form.register("reason")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeviceRuleDialog({
  open, orgs, onClose,
}: {
  open: boolean;
  orgs: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const create = useCreateDeviceRule();
  const form = useForm<DeviceRuleForm>({
    resolver: zodResolver(deviceRuleSchema),
    defaultValues: { organizationId: "", macAddress: "", ruleType: "whitelist", reason: "", expiresAt: "" },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New device access rule</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await create.mutateAsync({
                organizationId: v.organizationId,
                macAddress: v.macAddress,
                ruleType: v.ruleType,
                reason: v.reason || undefined,
                expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
              });
              toast.success("Device rule created");
              form.reset();
              onClose();
            } catch (err) {
              toast.error((err as unknown as AppError).message || "Failed to create rule");
            }
          })}
        >
          <div>
            <Label>Organization</Label>
            <Select value={form.watch("organizationId")} onValueChange={(v) => form.setValue("organizationId", v)}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="macAddress">MAC address</Label>
            <Input id="macAddress" placeholder="AA:BB:CC:DD:EE:FF" {...form.register("macAddress")} />
          </div>
          <div>
            <Label>Rule type</Label>
            <Select value={form.watch("ruleType")} onValueChange={(v) => form.setValue("ruleType", v as AccessRuleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.watch("ruleType") === "temporary" && (
            <div>
              <Label htmlFor="expiresAtDevice">Expires at</Label>
              <Input id="expiresAtDevice" type="datetime-local" {...form.register("expiresAt")} />
            </div>
          )}
          <div>
            <Label htmlFor="reasonDevice">Reason</Label>
            <Textarea id="reasonDevice" rows={2} {...form.register("reason")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccessCheckPanel() {
  const { data: orgs = [] } = useGuestAccessOrganizations();
  const check = useCheckAccess();
  const [organizationId, setOrganizationId] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [macAddress, setMacAddress] = useState("");

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Preview a decision</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Organization</Label>
          <Select value={organizationId} onValueChange={setOrganizationId}>
            <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
            <SelectContent>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Identifier</Label>
          <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+15551234567" />
        </div>
        <div>
          <Label>MAC address</Label>
          <Input value={macAddress} onChange={(e) => setMacAddress(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
        </div>
        <Button
          disabled={!organizationId || (!identifier && !macAddress) || check.isPending}
          onClick={() => check.mutate({ organizationId, identifier: identifier || undefined, macAddress: macAddress || undefined })}
        >
          Check access
        </Button>
        {check.data && (
          <div className="rounded-lg border p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              {check.data.allowed
                ? <ShieldCheck className="h-4 w-4 text-emerald-500" />
                : <ShieldOff className="h-4 w-4 text-destructive" />}
              {check.data.allowed ? "Allowed" : "Blocked"}
            </div>
            {check.data.ruleType && (
              <div className="mt-1 text-xs text-muted-foreground">
                Matched a <span className="capitalize">{check.data.ruleType}</span> rule
                {check.data.reason ? ` — ${check.data.reason}` : ""}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
