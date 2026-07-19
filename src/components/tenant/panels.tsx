import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  Download,
  KeyRound,
  Layers,
  Link2,
  MapPin,
  MoreHorizontal,
  Palette,
  Pencil,
  Plug,
  Plus,
  Power,
  RefreshCcw,
  Router as RouterIcon,
  ScrollText,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { useCustomer } from "@/hooks/useCustomer";
import {
  useTenantApiKeys,
  useTenantAudit,
  useTenantConfig,
  useTenantGroups,
  useTenantIntegrations,
  useTenantMutations,
  useTenantNas,
  useTenantNotifications,
  useTenantPolicies,
  useTenantSecurity,
  useTenantUsage,
  useTenantWebhooks,
} from "@/hooks/useTenant";
import { tenantService } from "@/services/tenant.service";
import type {
  FeaturePolicy,
  ModuleLimits,
  NasDevice,
  NasGroup,
  NotificationChannel,
  PolicyAssignment,
  PolicyAssignmentScope,
  SecurityConfig,
  WebhookRow,
} from "@/types/tenant";
import { ROUTER_OPS, ROUTER_OP_LABELS } from "@/types/tenant";

interface PanelProps {
  customerId: string;
}

/* ---------------------------- Customer Profile ---------------------------- */

export function CustomerProfilePanel({ customerId }: PanelProps) {
  const { data: cust, isLoading } = useCustomer(customerId);
  if (isLoading || !cust) return <PageSkeleton />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Company</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="Company name" value={cust.name} />
          <Field label="Customer ID" value={cust.id} mono />
          <Field label="Organization" value={cust.organizationName} />
          <Field label="Status" value={cust.status} capitalize />
          <Field label="Locations" value={String(cust.locations.length)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Primary contact</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="Owner" value={cust.owner.name} />
          <Field label="Email" value={cust.owner.email} />
          <Field label="Mobile" value={cust.owner.mobile} />
          <Field label="Role" value={cust.owner.role} />
          <Field label="Assigned locations" value={String(cust.owner.assignedLocations)} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={(mono ? "font-mono " : "") + (capitalize ? "capitalize " : "") + "font-medium"}>{value}</span>
    </div>
  );
}

/* -------------------------------- Branding -------------------------------- */

export function BrandingPanel({ customerId: _customerId }: PanelProps) {
  const [primary, setPrimary] = useState("#2563eb");
  const [secondary, setSecondary] = useState("#0f766e");
  const [font, setFont] = useState("Inter");
  const [supportEmail, setSupportEmail] = useState("support@cloudguest.io");
  const [supportPhone, setSupportPhone] = useState("+91 98200 00000");
  const [domain, setDomain] = useState("wifi.hotels.example");
  const [preview, setPreview] = useState<"dashboard" | "portal" | "email">("dashboard");

  return (
    <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> Brand identity</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <ColorInput label="Primary" value={primary} onChange={setPrimary} />
            <ColorInput label="Secondary" value={secondary} onChange={setSecondary} />
          </div>
          <div className="grid gap-2">
            <Label>Font family</Label>
            <Select value={font} onValueChange={setFont}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Inter", "SF Pro", "Manrope", "Space Grotesk", "IBM Plex Sans"].map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="grid gap-2"><Label>Support email</Label><Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Support phone</Label><Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Custom domain</Label><Input value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
          <Button className="w-full" onClick={() => toast.success("Branding saved")}>Save branding</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live preview</CardTitle>
          <div className="flex gap-1 rounded-md border p-1 text-xs">
            {(["dashboard", "portal", "email"] as const).map((p) => (
              <button key={p} onClick={() => setPreview(p)}
                className={"rounded px-2 py-1 capitalize " + (preview === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {p}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border" style={{ background: "linear-gradient(135deg, " + primary + "10, " + secondary + "10)" }}>
            <div className="flex items-center justify-between border-b bg-background/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded" style={{ background: primary }} />
                <span className="font-semibold" style={{ fontFamily: font }}>Acme Portal</span>
              </div>
              <span className="text-xs text-muted-foreground">{domain}</span>
            </div>
            <div className="grid gap-3 p-6" style={{ fontFamily: font }}>
              {preview === "dashboard" && (
                <>
                  <h3 className="text-lg font-semibold">Welcome back</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {["Guests", "Sessions", "Revenue"].map((k, i) => (
                      <div key={k} className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">{k}</div>
                        <div className="mt-1 text-lg font-semibold" style={{ color: i === 1 ? secondary : primary }}>
                          {[4218, 812, "$12.4k"][i]}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {preview === "portal" && (
                <div className="rounded-xl bg-background p-6 shadow-sm">
                  <h3 className="text-xl font-semibold">Welcome to guest Wi-Fi</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Verify to connect. Powered by Acme Networks.</p>
                  <Button className="mt-4" style={{ background: primary }}>Continue</Button>
                </div>
              )}
              {preview === "email" && (
                <div className="rounded-md bg-background p-4 text-sm">
                  <div className="border-b pb-2 font-semibold" style={{ color: primary }}>Your Wi-Fi voucher</div>
                  <p className="mt-2 text-muted-foreground">Hi guest, use code <span className="font-mono">A1B2-C3D4</span> to connect.</p>
                  <p className="mt-4 text-xs text-muted-foreground">Need help? {supportEmail}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

/* ------------------------------ Subscription ------------------------------ */

export function SubscriptionPanel({ customerId }: PanelProps) {
  const { data: cust } = useCustomer(customerId);
  const { data: cfg } = useTenantConfig(customerId);
  const { setLimits } = useTenantMutations(customerId);
  const [draft, setDraft] = useState<ModuleLimits | null>(null);
  const limits = draft ?? cfg?.limits;
  if (!cust || !cfg || !limits) return <PageSkeleton />;

  const setField = (k: keyof ModuleLimits, v: number) => setDraft({ ...limits, [k]: v });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="Plan" value={cust.subscription.plan} capitalize />
          <Field label="Billing" value={cust.subscription.billingCycle} capitalize />
          <Field label="Status" value={cust.subscription.status} capitalize />
          <Field label="Expiry" value={new Date(cust.subscription.expiryDate).toLocaleDateString()} />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Module limits</CardTitle>
          <Button size="sm" disabled={!draft} onClick={() => draft && setLimits.mutate(draft, { onSuccess: () => { toast.success("Limits saved"); setDraft(null); } })}>
            Save changes
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(limits) as (keyof ModuleLimits)[]).map((k) => (
            <div key={k} className="grid gap-2">
              <Label className="capitalize">{k.replace(/([A-Z])/g, " $1")}</Label>
              <Input type="number" value={limits[k]} min={0}
                onChange={(e) => setField(k, Math.max(0, Number(e.target.value) || 0))} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------- Modules --------------------------------- */

export function ModulesPanel({ customerId }: PanelProps) {
  const { data: cfg, isLoading } = useTenantConfig(customerId);
  const { setFeature } = useTenantMutations(customerId);
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(tenantService.featureCatalog.map((f) => f.category)))],
    [],
  );

  if (isLoading || !cfg) return <PageSkeleton />;
  const filtered = cfg.features.filter((f) => {
    if (category !== "all" && f.category !== category) return false;
    if (q && !f.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search features…" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {cfg.features.filter((f) => f.status === "enabled").length} of {cfg.features.length} enabled
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((f) => (
          <Card key={f.key}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground">{f.category}</div>
                    </div>
                  </div>
                </div>
                <Badge variant={f.status === "enabled" ? "default" : f.status === "upgrade_required" ? "secondary" : "outline"} className="capitalize">
                  {f.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{f.description}</p>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={f.status === "enabled"} disabled={f.status === "upgrade_required"}
                    onCheckedChange={(v) => setFeature.mutate({ key: f.key, status: v ? "enabled" : "disabled" }, {
                      onSuccess: () => toast.success(`${f.name} ${v ? "enabled" : "disabled"}`),
                    })} />
                  <span>{f.status === "upgrade_required" ? "Upgrade to enable" : "Enable"}</span>
                </div>
                {f.status === "upgrade_required" && (
                  <Button size="sm" variant="outline" onClick={() => setFeature.mutate({ key: f.key, status: "enabled" }, {
                    onSuccess: () => toast.success(`${f.name} unlocked`),
                  })}>Upgrade</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- NAS Groups ------------------------------ */

export function NasGroupsPanel({ customerId }: PanelProps) {
  const { data: groups = [], isLoading } = useTenantGroups(customerId);
  const { saveGroup, deleteGroup } = useTenantMutations(customerId);
  const [editing, setEditing] = useState<NasGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<NasGroup | null>(null);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">{groups.length} groups configured</div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New group</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>NAS</TableHead><TableHead className="w-12" />
            </TableRow></TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><div className="font-medium">{g.name}</div><div className="text-xs text-muted-foreground">{g.id}</div></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.description}</TableCell>
                  <TableCell>{g.nasCount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(g)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDel(g)}>
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {groups.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No groups yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <GroupDialog open={creating || !!editing} initial={editing} onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(g) => saveGroup.mutate(g, { onSuccess: () => { toast.success("Group saved"); setEditing(null); setCreating(false); } })} />
      <ConfirmDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Delete ${confirmDel?.name}?`} description="NAS in this group will be unassigned." destructive
        confirmLabel="Delete"
        onConfirm={() => confirmDel && deleteGroup.mutate(confirmDel.id, { onSuccess: () => { toast.success("Group deleted"); setConfirmDel(null); } })} />
    </div>
  );
}

function GroupDialog({ open, initial, onClose, onSave }: { open: boolean; initial: NasGroup | null; onClose: () => void; onSave: (g: Omit<NasGroup, "nasCount">) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [id, setId] = useState(initial?.id ?? "");
  useMemo(() => {
    if (initial) { setName(initial.name); setDescription(initial.description); setId(initial.id); }
    else { setName(""); setDescription(""); setId(""); }
  }, [initial]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Edit group" : "New NAS group"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2"><Label>Group ID</Label><Input value={id} onChange={(e) => setId(e.target.value)} disabled={!!initial} placeholder="GRP-XXX" /></div>
          <div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ id: id || `GRP-${Date.now()}`, name, description })} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- NAS ---------------------------------- */

export function RoutersPanel({ customerId }: PanelProps) {
  const { data: cust } = useCustomer(customerId);
  const { data: nas = [], isLoading } = useTenantNas(customerId);
  const { data: groups = [] } = useTenantGroups(customerId);
  const { saveNas, deleteNas } = useTenantMutations(customerId);
  const [editing, setEditing] = useState<NasDevice | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<NasDevice | null>(null);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("any");
  const [status, setStatus] = useState<"any" | "online" | "offline" | "degraded">("any");

  if (isLoading) return <PageSkeleton />;

  const filtered = nas.filter((n) => {
    if (q && !(`${n.name} ${n.nasIdentifier} ${n.serialNumber} ${n.locationName}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (group !== "any" && n.groupId !== group) return false;
    if (status !== "any" && n.status !== status) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search NAS, serial, location…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All groups</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="degraded">Degraded</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> Register NAS</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>NAS</TableHead><TableHead>Router</TableHead><TableHead>Location</TableHead><TableHead>Group</TableHead>
              <TableHead>Public IP</TableHead><TableHead>Status</TableHead><TableHead className="w-12" />
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <div className="font-medium">{n.nasIdentifier}</div>
                    <div className="text-xs text-muted-foreground">{n.id}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{n.name}</div>
                    <div className="text-xs text-muted-foreground">{n.model} · {n.routerOsVersion}</div>
                  </TableCell>
                  <TableCell><div className="flex items-center gap-1 text-sm"><MapPin className="h-3.5 w-3.5" /> {n.locationName}</div></TableCell>
                  <TableCell className="text-sm">{groups.find((g) => g.id === n.groupId)?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{n.publicIp}</TableCell>
                  <TableCell>
                    <Badge variant={n.status === "online" ? "default" : n.status === "degraded" ? "secondary" : "destructive"} className="capitalize">{n.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(n)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDel(n)}>
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No NAS match</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NasDialog open={creating || !!editing} initial={editing} groups={groups} locations={cust?.locations ?? []}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(n) => saveNas.mutate(n, { onSuccess: () => { toast.success("NAS saved"); setEditing(null); setCreating(false); } })} />
      <ConfirmDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Delete ${confirmDel?.name}?`} destructive confirmLabel="Delete"
        onConfirm={() => confirmDel && deleteNas.mutate(confirmDel.id, { onSuccess: () => { toast.success("NAS removed"); setConfirmDel(null); } })} />
    </div>
  );
}

function NasDialog({ open, initial, groups, locations, onClose, onSave }: {
  open: boolean; initial: NasDevice | null; groups: NasGroup[];
  locations: { id: string; name: string }[]; onClose: () => void; onSave: (n: NasDevice) => void;
}) {
  const blank: NasDevice = {
    id: `NAS-${Date.now()}`, nasIdentifier: "", routerIdentity: "", name: "", serialNumber: "",
    model: "MikroTik hAP ax3", routerOsVersion: "7.14.2", publicIp: "203.0.113.100", privateIp: "10.0.0.1",
    locationId: locations[0]?.id ?? "", locationName: locations[0]?.name ?? "", groupId: undefined, status: "online",
  };
  const [n, setN] = useState<NasDevice>(initial ?? blank);
  useMemo(() => setN(initial ?? blank), [initial]);
  const setF = <K extends keyof NasDevice>(k: K, v: NasDevice[K]) => setN((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit NAS" : "Register NAS"}</DialogTitle>
          <DialogDescription>Every router registered as a NAS in RADIUS.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label>NAS Identifier</Label><Input value={n.nasIdentifier} onChange={(e) => setF("nasIdentifier", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Router Identity</Label><Input value={n.routerIdentity} onChange={(e) => setF("routerIdentity", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Router name</Label><Input value={n.name} onChange={(e) => setF("name", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Serial number</Label><Input value={n.serialNumber} onChange={(e) => setF("serialNumber", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Model</Label><Input value={n.model} onChange={(e) => setF("model", e.target.value)} /></div>
          <div className="grid gap-2"><Label>RouterOS</Label><Input value={n.routerOsVersion} onChange={(e) => setF("routerOsVersion", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Public IP</Label><Input value={n.publicIp} onChange={(e) => setF("publicIp", e.target.value)} /></div>
          <div className="grid gap-2"><Label>Private IP</Label><Input value={n.privateIp} onChange={(e) => setF("privateIp", e.target.value)} /></div>
          <div className="grid gap-2">
            <Label>Location</Label>
            <Select value={n.locationId} onValueChange={(v) => {
              const loc = locations.find((l) => l.id === v);
              setN((p) => ({ ...p, locationId: v, locationName: loc?.name ?? v }));
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>NAS group</Label>
            <Select value={n.groupId ?? "none"} onValueChange={(v) => setF("groupId", v === "none" ? undefined : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={n.description ?? ""} onChange={(e) => setF("description", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(n)} disabled={!n.nasIdentifier || !n.name}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Policies -------------------------------- */

export function PoliciesPanel({ customerId }: PanelProps) {
  const { data: cust } = useCustomer(customerId);
  const { data: policies = [], isLoading } = useTenantPolicies(customerId);
  const { data: groups = [] } = useTenantGroups(customerId);
  const { data: nas = [] } = useTenantNas(customerId);
  const { data: cfg } = useTenantConfig(customerId);
  const { savePolicy, deletePolicy, assignPolicy, unassignPolicy } = useTenantMutations(customerId);
  const [editing, setEditing] = useState<FeaturePolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [assignFor, setAssignFor] = useState<FeaturePolicy | null>(null);
  const [confirmDel, setConfirmDel] = useState<FeaturePolicy | null>(null);

  if (isLoading || !cfg) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">Reusable feature + operations policies</div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New policy</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {policies.map((p) => {
          const enabled = Object.values(p.features).filter(Boolean).length;
          const ops = Object.values(p.routerOps).filter(Boolean).length;
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(p)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAssignFor(p)}><Link2 className="mr-2 h-4 w-4" />Assign</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDel(p)}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{enabled} features</Badge>
                  <Badge variant="secondary">{ops} router ops</Badge>
                  <Badge variant="outline">Updated {new Date(p.updatedAt).toLocaleDateString()}</Badge>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Assignments</div>
                  {p.assignments.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Not assigned</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {p.assignments.map((a) => (
                        <Badge key={`${a.scope}:${a.targetId}`} variant="outline" className="gap-1">
                          <span className="capitalize">{a.scope.replace("_", " ")}</span>· {a.targetLabel}
                          <button className="ml-1 opacity-60 hover:opacity-100"
                            onClick={() => unassignPolicy.mutate({ policyId: p.id, targetKey: `${a.scope}:${a.targetId}` })}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PolicyDialog open={creating || !!editing} initial={editing}
        featureCatalog={cfg.features.map((f) => ({ key: f.key, label: f.name }))}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(p) => savePolicy.mutate(p, { onSuccess: () => { toast.success("Policy saved"); setEditing(null); setCreating(false); } })} />
      <AssignPolicyDialog open={!!assignFor} policy={assignFor} onClose={() => setAssignFor(null)}
        customer={cust ? { id: cust.id, name: cust.name } : null}
        locations={cust?.locations ?? []} groups={groups} nas={nas}
        onAssign={(a) => assignFor && assignPolicy.mutate({ policyId: assignFor.id, assignment: a }, {
          onSuccess: () => { toast.success("Policy assigned"); setAssignFor(null); },
        })} />
      <ConfirmDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Delete ${confirmDel?.name}?`} destructive confirmLabel="Delete"
        onConfirm={() => confirmDel && deletePolicy.mutate(confirmDel.id, { onSuccess: () => { toast.success("Policy deleted"); setConfirmDel(null); } })} />
    </div>
  );
}

function PolicyDialog({ open, initial, featureCatalog, onClose, onSave }: {
  open: boolean; initial: FeaturePolicy | null; featureCatalog: { key: string; label: string }[];
  onClose: () => void; onSave: (p: FeaturePolicy) => void;
}) {
  const blank: FeaturePolicy = {
    id: `POL-${Date.now()}`, name: "", description: "",
    features: Object.fromEntries(featureCatalog.map((f) => [f.key, true])),
    routerOps: Object.fromEntries(ROUTER_OPS.map((k) => [k, k !== "factory_reset" && k !== "delete"])),
    assignments: [], updatedAt: new Date().toISOString(),
  };
  const [p, setP] = useState<FeaturePolicy>(initial ?? blank);
  useMemo(() => setP(initial ?? blank), [initial]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{initial ? "Edit policy" : "New feature policy"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2"><Label>Name</Label><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>ID</Label><Input value={p.id} onChange={(e) => setP({ ...p, id: e.target.value })} disabled={!!initial} /></div>
          </div>
          <div className="grid gap-2"><Label>Description</Label><Textarea rows={2} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></div>

          <Separator />
          <div>
            <div className="mb-2 text-sm font-medium">Feature toggles</div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {featureCatalog.map((f) => (
                <label key={f.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Checkbox checked={!!p.features[f.key]} onCheckedChange={(v) => setP({ ...p, features: { ...p.features, [f.key]: !!v } })} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <div className="mb-2 text-sm font-medium">Router operations</div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {ROUTER_OPS.map((op) => (
                <label key={op} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Checkbox checked={!!p.routerOps[op]} onCheckedChange={(v) => setP({ ...p, routerOps: { ...p.routerOps, [op]: !!v } })} />
                  <span>{ROUTER_OP_LABELS[op]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!p.name.trim()} onClick={() => onSave(p)}>Save policy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignPolicyDialog({ open, policy, customer, locations, groups, nas, onClose, onAssign }: {
  open: boolean; policy: FeaturePolicy | null; customer: { id: string; name: string } | null;
  locations: { id: string; name: string }[]; groups: NasGroup[]; nas: NasDevice[];
  onClose: () => void; onAssign: (a: PolicyAssignment) => void;
}) {
  const [scope, setScope] = useState<PolicyAssignmentScope>("location");
  const [targetId, setTargetId] = useState<string>("");

  const targets = scope === "customer" && customer ? [{ id: customer.id, name: customer.name }]
    : scope === "location" ? locations
    : scope === "nas_group" ? groups.map((g) => ({ id: g.id, name: g.name }))
    : nas.map((n) => ({ id: n.id, name: n.nasIdentifier }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign {policy?.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => { setScope(v as PolicyAssignmentScope); setTargetId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Entire customer</SelectItem>
                <SelectItem value="location">Specific location</SelectItem>
                <SelectItem value="nas_group">NAS group</SelectItem>
                <SelectItem value="nas">Individual NAS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Target</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {targets.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!targetId} onClick={() => {
            const t = targets.find((x) => x.id === targetId);
            if (t) onAssign({ scope, targetId: t.id, targetLabel: t.name });
          }}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Locations -------------------------------- */

export function LocationsPanel({ customerId }: PanelProps) {
  const { data: cust } = useCustomer(customerId);
  const { data: nas = [] } = useTenantNas(customerId);
  const { data: groups = [] } = useTenantGroups(customerId);
  if (!cust) return <PageSkeleton />;
  return (
    <Card>
      <CardHeader><CardTitle>Locations ({cust.locations.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Location</TableHead><TableHead>Type</TableHead><TableHead>Routers</TableHead>
            <TableHead>NAS groups</TableHead><TableHead>Guests (est.)</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {cust.locations.map((l) => {
              const locNas = nas.filter((n) => n.locationId === l.id);
              const usedGroups = Array.from(new Set(locNas.map((n) => n.groupId).filter(Boolean))) as string[];
              return (
                <TableRow key={l.id}>
                  <TableCell><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.city}</div></TableCell>
                  <TableCell className="capitalize">{l.siteType}</TableCell>
                  <TableCell>{locNas.length}</TableCell>
                  <TableCell className="text-sm">
                    {usedGroups.length ? usedGroups.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(", ") : "—"}
                  </TableCell>
                  <TableCell>{200 + ((cust.id.charCodeAt(cust.id.length - 1) + l.id.length) * 37) % 800}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Users & Permissions ------------------------- */

const DEMO_USERS = [
  { id: "USR-1", name: "John Meyers", email: "john@acme.com", role: "Organization Admin", locations: ["Hotel Delhi", "Hotel Mumbai"] },
  { id: "USR-2", name: "Priya Sharma", email: "priya@acme.com", role: "Location Admin", locations: ["Cafe Jaipur"] },
  { id: "USR-3", name: "Ravi Kumar", email: "ravi@acme.com", role: "Network Engineer", locations: ["Hotel Delhi"] },
  { id: "USR-4", name: "Nisha Iyer", email: "nisha@acme.com", role: "Reception", locations: ["Hospital Noida"] },
];

const DEMO_ROLES = ["Organization Admin", "Location Admin", "Network Engineer", "Reception", "Manager", "Billing", "Support", "Viewer"];

export function UsersPanel({ customerId }: PanelProps) {
  const { data: cust } = useCustomer(customerId);
  const { data: nas = [] } = useTenantNas(customerId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof DEMO_USERS)[number] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="text-sm text-muted-foreground">{DEMO_USERS.length} tenant users</div>
        <Button onClick={() => setInviteOpen(true)}><Plus className="mr-2 h-4 w-4" /> Invite user</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Locations</TableHead><TableHead>NAS</TableHead><TableHead className="w-12" />
            </TableRow></TableHeader>
            <TableBody>
              {DEMO_USERS.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell className="text-sm">{u.locations.join(", ")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{Math.min(nas.length, u.locations.length * 2)} allowed</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>Access…</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite user</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2"><Label>Full name</Label><Input /></div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" /></div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select defaultValue="Location Admin">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEMO_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success("Invitation sent"); setInviteOpen(false); }}>Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Access for {editing?.name}</DialogTitle>
            <DialogDescription>Location and NAS scope</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <div className="mb-2 text-sm font-medium">Locations</div>
              <div className="grid gap-2">
                {(cust?.locations ?? []).map((l) => (
                  <label key={l.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox defaultChecked={editing?.locations.includes(l.name)} />
                    <span>{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Allowed NAS</div>
              <div className="grid max-h-48 gap-2 overflow-auto">
                {nas.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox defaultChecked={editing?.locations.some((L) => n.locationName === L)} />
                    <span>{n.nasIdentifier} · {n.locationName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => { toast.success("Access updated"); setEditing(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Permissions ------------------------------- */

const PERMISSION_GROUPS: { key: string; label: string }[] = [
  { key: "modules", label: "Modules" },
  { key: "locations", label: "Locations" },
  { key: "nas", label: "NAS" },
  { key: "routerOps", label: "Router operations" },
  { key: "reports", label: "Reports" },
  { key: "billing", label: "Billing" },
  { key: "analytics", label: "Analytics" },
];

export function PermissionsPanel({ customerId: _customerId }: PanelProps) {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(() => {
    const m: Record<string, Record<string, boolean>> = {};
    DEMO_ROLES.forEach((r, ri) => {
      m[r] = {};
      PERMISSION_GROUPS.forEach((g, gi) => (m[r][g.key] = ri === 0 || (ri + gi) % 3 !== 0));
    });
    return m;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Role permission matrix</CardTitle>
        <Button size="sm" onClick={() => toast.success("Matrix saved")}>Save</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">Role</TableHead>
              {PERMISSION_GROUPS.map((g) => <TableHead key={g.key} className="text-center">{g.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {DEMO_ROLES.map((r) => (
              <TableRow key={r}>
                <TableCell className="font-medium">{r}</TableCell>
                {PERMISSION_GROUPS.map((g) => (
                  <TableCell key={g.key} className="text-center">
                    <Checkbox checked={matrix[r][g.key]} onCheckedChange={(v) => setMatrix((m) => ({ ...m, [r]: { ...m[r], [g.key]: !!v } }))} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Integrations ------------------------------ */

export function IntegrationsPanel({ customerId }: PanelProps) {
  const { data: rows = [], isLoading } = useTenantIntegrations(customerId);
  const { toggleIntegration } = useTenantMutations(customerId);
  if (isLoading) return <PageSkeleton />;
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.category] ??= []).push(r); return acc;
  }, {});
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <div className="mb-2 text-sm font-medium">{cat}</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => (
              <Card key={r.key}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Plug className="h-4 w-4" /></div>
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.configured ? "Configured" : "Not configured"}</div>
                    </div>
                  </div>
                  <Switch checked={r.enabled} onCheckedChange={(v) => toggleIntegration.mutate({ key: r.key, enabled: v })} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- API ----------------------------------- */

export function ApiPanel({ customerId }: PanelProps) {
  const { data: keys = [], isLoading } = useTenantApiKeys(customerId);
  const { data: webhooks = [] } = useTenantWebhooks(customerId);
  const { createApiKey, rotateApiKey, deleteApiKey, saveWebhook, deleteWebhook } = useTenantMutations(customerId);
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState("read:*");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [whOpen, setWhOpen] = useState(false);
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState("guest.connected, router.down");

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> API keys</CardTitle>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Generate</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Label</TableHead><TableHead>Prefix</TableHead><TableHead>Scopes</TableHead>
              <TableHead>Created</TableHead><TableHead>Last used</TableHead><TableHead className="w-12" />
            </TableRow></TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.label}</TableCell>
                  <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                  <TableCell className="text-xs">{k.scopes.join(", ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{k.lastUsed ? new Date(k.lastUsed).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => rotateApiKey.mutate(k.id, { onSuccess: () => toast.success("Key rotated") })}><RefreshCcw className="mr-2 h-4 w-4" />Rotate</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive"
                          onClick={() => deleteApiKey.mutate(k.id, { onSuccess: () => toast.success("Key deleted") })}>
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Webhooks</CardTitle>
          <Button onClick={() => setWhOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add webhook</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>URL</TableHead><TableHead>Events</TableHead><TableHead>Enabled</TableHead><TableHead className="w-12" />
            </TableRow></TableHeader>
            <TableBody>
              {webhooks.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.url}</TableCell>
                  <TableCell className="text-xs">{w.events.join(", ")}</TableCell>
                  <TableCell><Switch checked={w.enabled} onCheckedChange={(v) => saveWebhook.mutate({ ...w, enabled: v })} /></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => deleteWebhook.mutate(w.id, { onSuccess: () => toast.success("Webhook deleted") })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {webhooks.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No webhooks</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setLabel(""); setNewSecret(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate API key</DialogTitle></DialogHeader>
          {newSecret ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm break-all">{newSecret}</div>
              <p className="text-xs text-muted-foreground">Copy this key now — it will not be shown again.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(newSecret); toast.success("Copied"); }}>
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <Button onClick={() => { setCreateOpen(false); setNewSecret(null); setLabel(""); }}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                <div className="grid gap-2"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
                <div className="grid gap-2"><Label>Scopes (comma separated)</Label><Input value={scopes} onChange={(e) => setScopes(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button disabled={!label.trim() || createApiKey.isPending}
                  onClick={() => createApiKey.mutate({ label, scopes: scopes.split(",").map((s) => s.trim()).filter(Boolean) }, {
                    onSuccess: (res) => { if (res) setNewSecret(res.secret); },
                  })}>Generate</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={whOpen} onOpenChange={setWhOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New webhook</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2"><Label>URL</Label><Input value={whUrl} onChange={(e) => setWhUrl(e.target.value)} placeholder="https://…" /></div>
            <div className="grid gap-2"><Label>Events</Label><Input value={whEvents} onChange={(e) => setWhEvents(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhOpen(false)}>Cancel</Button>
            <Button disabled={!whUrl.trim()}
              onClick={() => {
                saveWebhook.mutate({ id: `WH-${Date.now()}`, url: whUrl, events: whEvents.split(",").map((e) => e.trim()).filter(Boolean), enabled: true }, {
                  onSuccess: () => { toast.success("Webhook created"); setWhOpen(false); setWhUrl(""); },
                });
              }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------- Security -------------------------------- */

export function SecurityPanel({ customerId }: PanelProps) {
  const { data: initial, isLoading } = useTenantSecurity(customerId);
  const { setSecurity } = useTenantMutations(customerId);
  const [cfg, setCfg] = useState<SecurityConfig | null>(null);
  const s = cfg ?? initial;
  if (isLoading || !s) return <PageSkeleton />;
  const set = <K extends keyof SecurityConfig>(k: K, v: SecurityConfig[K]) => setCfg({ ...s, [k]: v });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Security</CardTitle>
        <Button size="sm" disabled={!cfg} onClick={() => cfg && setSecurity.mutate(cfg, { onSuccess: () => { toast.success("Security saved"); setCfg(null); } })}>Save</Button>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div><div className="font-medium">Require MFA</div><div className="text-xs text-muted-foreground">All tenant users must enrol.</div></div>
          <Switch checked={s.mfaRequired} onCheckedChange={(v) => set("mfaRequired", v)} />
        </div>
        <div className="grid gap-2"><Label>Password min length</Label>
          <Input type="number" min={8} value={s.passwordMinLength} onChange={(e) => set("passwordMinLength", Number(e.target.value))} /></div>
        <div className="grid gap-2"><Label>Password rotation (days)</Label>
          <Input type="number" min={0} value={s.passwordRotationDays} onChange={(e) => set("passwordRotationDays", Number(e.target.value))} /></div>
        <div className="grid gap-2"><Label>Session timeout (minutes)</Label>
          <Input type="number" min={5} value={s.sessionTimeoutMinutes} onChange={(e) => set("sessionTimeoutMinutes", Number(e.target.value))} /></div>
        <div className="grid gap-2 md:col-span-2"><Label>IP allowlist (comma separated)</Label>
          <Input value={s.ipAllowlist.join(", ")} onChange={(e) => set("ipAllowlist", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="10.0.0.0/24, 203.0.113.10" /></div>
        <div className="grid gap-2 md:col-span-2"><Label>Allowed email domains</Label>
          <Input value={s.allowedDomains.join(", ")} onChange={(e) => set("allowedDomains", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Notifications ----------------------------- */

export function NotificationsPanel({ customerId }: PanelProps) {
  const { data: initial, isLoading } = useTenantNotifications(customerId);
  const { setNotifications } = useTenantMutations(customerId);
  const [channels, setChannels] = useState<NotificationChannel[] | null>(null);
  const list = channels ?? initial;
  if (isLoading || !list) return <PageSkeleton />;

  const update = (i: number, patch: Partial<NotificationChannel>) => {
    const next = list.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    setChannels(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" disabled={!channels} onClick={() => channels && setNotifications.mutate(channels, { onSuccess: () => { toast.success("Notifications saved"); setChannels(null); } })}>Save</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((c, i) => (
          <Card key={c.key}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">{c.key}</CardTitle>
              <Switch checked={c.enabled} onCheckedChange={(v) => update(i, { enabled: v })} />
            </CardHeader>
            <CardContent className="space-y-2">
              <Label>Events</Label>
              <Input value={c.events.join(", ")} onChange={(e) => update(i, { events: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              <p className="text-xs text-muted-foreground">e.g. billing.invoice, router.down, guest.blocked</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Usage --------------------------------- */

export function UsagePanel({ customerId }: PanelProps) {
  const { data: usage, isLoading } = useTenantUsage(customerId);
  const { data: cfg } = useTenantConfig(customerId);
  if (isLoading || !usage || !cfg) return <PageSkeleton />;
  const items: { label: string; icon: React.ReactNode; used: number; max?: number; unit?: string }[] = [
    { label: "Locations", icon: <MapPin className="h-4 w-4" />, used: usage.locations, max: cfg.limits.locations },
    { label: "Routers", icon: <RouterIcon className="h-4 w-4" />, used: usage.routers, max: cfg.limits.routers },
    { label: "NAS", icon: <Cpu className="h-4 w-4" />, used: usage.nas, max: cfg.limits.nas },
    { label: "Guests", icon: <Users className="h-4 w-4" />, used: usage.guests, max: cfg.limits.guests },
    { label: "Bandwidth", icon: <Activity className="h-4 w-4" />, used: usage.bandwidthGb, unit: "GB" },
    { label: "Storage", icon: <Layers className="h-4 w-4" />, used: usage.storageGb, max: cfg.limits.storageGb, unit: "GB" },
    { label: "Emails", icon: <Wifi className="h-4 w-4" />, used: usage.emails, max: cfg.limits.emailCredits },
    { label: "SMS", icon: <Wifi className="h-4 w-4" />, used: usage.sms, max: cfg.limits.smsCredits },
    { label: "API calls", icon: <KeyRound className="h-4 w-4" />, used: usage.apiCalls },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => {
        const pct = it.max ? Math.min(100, (it.used / it.max) * 100) : null;
        return (
          <Card key={it.label}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">{it.icon}<span>{it.label}</span></div>
                {pct !== null && pct > 80 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />High</Badge>}
              </div>
              <div className="text-2xl font-semibold">{it.used.toLocaleString()}{it.unit ? ` ${it.unit}` : ""}</div>
              {it.max && (
                <>
                  <Progress value={pct ?? 0} />
                  <div className="text-xs text-muted-foreground">of {it.max.toLocaleString()}{it.unit ? ` ${it.unit}` : ""}</div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------------- Audit --------------------------------- */

export function AuditPanel({ customerId }: PanelProps) {
  const { data: rows = [], isLoading } = useTenantAudit(customerId);
  const [q, setQ] = useState("");
  if (isLoading) return <PageSkeleton />;
  const filtered = rows.filter((r) => !q || `${r.action} ${r.actor} ${r.target}`.toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => {
    const csv = ["at,actor,action,target,meta", ...filtered.map((r) => `${r.at},${r.actor},${r.action},${r.target},${r.meta ?? ""}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `tenant-audit-${customerId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Search audit…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        <Button variant="outline" size="sm" onClick={exportCsv} className="ml-auto"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><ScrollText className="h-4 w-4" /></div>
                  <div>
                    <div className="font-medium">{r.action}</div>
                    <div className="text-sm text-muted-foreground">{r.target}{r.meta ? ` · ${r.meta}` : ""}</div>
                    <div className="mt-1 text-xs text-muted-foreground">by {r.actor}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</div>
              </div>
            ))}
            {filtered.length === 0 && <EmptyState title="No entries" description="Nothing matches your search." icon={<ScrollText />} />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------- shared misc export used by onboarding wizard -------------- */

export function OnboardingSummaryLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="ml-auto text-sm font-medium">{value}</div>
    </div>
  );
}

/* keep unused imports tree-shakable */
export const _unused = { Power, Check, ChevronDown };
