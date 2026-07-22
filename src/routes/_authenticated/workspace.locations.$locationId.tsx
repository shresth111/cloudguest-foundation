import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowLeft, BarChart3, Building2, Cpu, Download,
  FileText, Gauge, MapPin, Pencil, Plus, QrCode, Receipt, RefreshCw, Router as RouterIcon,
  ScrollText, Settings as SettingsIcon, ShieldCheck, Ticket, UserPlus, Users, Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCustomers, useLocationResources } from "@/hooks/useCustomer";
import type { ExistingCustomer, LocationResources, LocationRouter } from "@/services/customer.service";
import { toast } from "sonner";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const TAB_KEYS = [
  "overview", "routers", "wifi", "portal", "guests", "staff",
  "analytics", "monitoring", "reports", "billing", "audit", "settings",
] as const;
type TabKey = (typeof TAB_KEYS)[number];

const searchSchema = z.object({
  tab: z.enum(TAB_KEYS).catch("overview").default("overview"),
});

export const Route = createFileRoute("/_authenticated/workspace/locations/$locationId")({
  validateSearch: zodValidator(searchSchema),
  component: LocationWorkspacePage,
  errorComponent: ({ error, reset }) => (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Failed to load location</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span className="truncate">{error.message}</span>
        <Button size="sm" variant="outline" onClick={() => reset()}>Retry</Button>
      </AlertDescription>
    </Alert>
  ),
});

// `navigate({ to: ".", search: reducer })` resolves against every route's
// search type at once (an ambiguous-`to` quirk in this router version), so a
// reducer that's correct for this route's own `{ tab: TabKey }` schema still
// fails to type-check against that unrelated union. Narrowing it here, once,
// documents why -- the alternative is threading `as any` through the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asTabSearchReducer(fn: (prev: { tab: TabKey }) => { tab: TabKey }): any {
  return fn;
}

function LocationWorkspacePage() {
  const { locationId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { data: customers, isLoading: loadingCustomers } = useCustomers();
  const { data: resources, isLoading: loadingResources, refetch } = useLocationResources(locationId);

  const context = useMemo(() => {
    if (!customers) return null;
    for (const c of customers) {
      const loc = c.locations.find((l) => l.id === locationId);
      if (loc) return { customer: c, location: loc };
    }
    return null;
  }, [customers, locationId]);

  const setTab = (t: TabKey) =>
    navigate({ to: ".", params: { locationId }, search: asTabSearchReducer((prev) => ({ ...prev, tab: t })) });

  if (loadingCustomers) return <LocationWorkspaceSkeleton />;
  if (!context) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Location not found</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>The location <code>{locationId}</code> doesn't belong to any customer in this workspace.</span>
          <Button asChild size="sm" variant="outline"><Link to="/workspace/locations">Back</Link></Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { customer, location } = context;

  return (
    <div className="space-y-4">
      <LocationHeader customer={customer} location={location} onEdit={() => toast.info("Open location editor (mock)")} onRefresh={() => refetch()} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="w-max min-w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="routers">Routers</TabsTrigger>
            <TabsTrigger value="wifi">Guest WiFi</TabsTrigger>
            <TabsTrigger value="portal">Captive portal</TabsTrigger>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="audit">Audit logs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4">
          {loadingResources || !resources ? (
            <LocationWorkspaceSkeleton />
          ) : (
            <>
              <TabsContent value="overview"><OverviewTab customer={customer} location={location} resources={resources} onNavigate={setTab} /></TabsContent>
              <TabsContent value="routers"><RoutersTab resources={resources} /></TabsContent>
              <TabsContent value="wifi"><GuestWifiTab resources={resources} /></TabsContent>
              <TabsContent value="portal"><PortalTab customer={customer} location={location} /></TabsContent>
              <TabsContent value="guests"><GuestsTab resources={resources} /></TabsContent>
              <TabsContent value="staff"><StaffTab resources={resources} /></TabsContent>
              <TabsContent value="analytics"><AnalyticsTab resources={resources} /></TabsContent>
              <TabsContent value="monitoring"><MonitoringTab resources={resources} /></TabsContent>
              <TabsContent value="reports"><ReportsTab /></TabsContent>
              <TabsContent value="billing"><BillingTab customer={customer} resources={resources} /></TabsContent>
              <TabsContent value="audit"><AuditTab /></TabsContent>
              <TabsContent value="settings"><SettingsTab customer={customer} location={location} /></TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

/* ---------- Header ---------- */

function LocationHeader({
  customer, location, onEdit, onRefresh,
}: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
  onEdit: () => void; onRefresh: () => void;
}) {
  const sibling = customer.locations.filter((l) => l.id !== location.id);
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:p-5 md:flex md:flex-wrap md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{location.name}</h1>
              <Badge variant="secondary" className="capitalize">{location.siteType}</Badge>
              <Badge variant="default">Active</Badge>
              <Badge variant="outline" className="capitalize">{customer.subscription.plan}</Badge>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />{location.city} · Asia/Kolkata · <span className="font-mono">{location.id}</span> · {customer.name}
            </p>
          </div>
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 md:col-span-1">
          {sibling.length > 0 && (
            <Select
              value={location.id}
              onValueChange={(id) => navigate({ to: "/workspace/locations/$locationId", params: { locationId: id } })}
            >
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {customer.locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name} · {l.city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="mr-1.5 h-4 w-4" />Refresh</Button>
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-4 w-4" />Edit location</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Overview ---------- */

function Kpi({ label, value, sub, icon: Icon, tone = "default" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const toneCls = {
    default: "bg-primary/10 text-primary",
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${toneCls}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ customer, location, resources, onNavigate }: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
  resources: LocationResources;
  onNavigate: (t: TabKey) => void;
}) {
  const online = resources.routers.filter((r) => r.status === "online").length;
  const offline = resources.routers.filter((r) => r.status === "offline").length;
  const days = Math.max(0, Math.floor((new Date(customer.subscription.expiryDate).getTime() - Date.now()) / 86400000));
  const activity = Array.from({ length: 12 }, (_, i) => ({
    label: `${i * 2}:00`,
    guests: 20 + ((i * 17) % 120),
    bandwidth: 40 + ((i * 23) % 180),
  }));
  const methods = [
    { name: "OTP", value: 42 }, { name: "Voucher", value: 26 },
    { name: "Social", value: 18 }, { name: "QR", value: 14 },
  ];
  const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#8b5cf6"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Routers online" value={online} sub={`${resources.routers.length} total`} icon={RouterIcon} tone="positive" />
        <Kpi label="Routers offline" value={offline} icon={RouterIcon} tone={offline ? "danger" : "default"} />
        <Kpi label="Guests today" value={resources.analytics.dailySessions} sub="sessions" icon={Users} />
        <Kpi label="Active sessions" value={resources.analytics.activeGuests} icon={Wifi} tone="positive" />
        <Kpi label="Bandwidth" value={`${resources.analytics.dataConsumedGb} GB`} sub="24h" icon={Gauge} />
        <Kpi label="Staff" value={resources.staff.length} icon={Users} />
        <Kpi label="Revenue (MTD)" value="$4,820" sub="+12% vs last mo" icon={Receipt} tone="positive" />
        <Kpi label="Alerts" value={2} sub="1 warning · 1 info" icon={AlertTriangle} tone="warning" />
        <Kpi label="Subscription" value={customer.subscription.plan} sub={`Renews in ${days}d`} icon={ShieldCheck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Guest activity & bandwidth · 24h</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="guests" stroke="hsl(var(--primary))" fill="url(#gA)" />
                <Line type="monotone" dataKey="bandwidth" stroke="#f59e0b" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Login methods</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={methods} innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name">
                  {methods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <QuickActions onNavigate={onNavigate} />

      <PropertyInfoCard customer={customer} location={location} />
    </div>
  );
}

function QuickActions({ onNavigate }: { onNavigate: (t: TabKey) => void }) {
  const actions: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }[] = [
    { label: "Add router", icon: Plus, onClick: () => onNavigate("routers") },
    { label: "Restart router", icon: RefreshCw, onClick: () => toast.success("Restart queued") },
    { label: "Create voucher", icon: Ticket, onClick: () => onNavigate("wifi") },
    { label: "Generate QR", icon: QrCode, onClick: () => onNavigate("wifi") },
    { label: "Invite staff", icon: UserPlus, onClick: () => onNavigate("staff") },
    { label: "Generate report", icon: FileText, onClick: () => onNavigate("reports") },
    { label: "Backup router", icon: Download, onClick: () => toast.success("Backup started") },
    { label: "Configure portal", icon: SettingsIcon, onClick: () => onNavigate("portal") },
  ];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8">
          {actions.map((a) => (
            <Button key={a.label} variant="outline" size="sm" className="justify-start" onClick={a.onClick}>
              <a.icon className="mr-2 h-4 w-4" />{a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyInfoCard({ customer, location }: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
}) {
  const rows: Array<[string, string]> = [
    ["Property name", location.name],
    ["Property type", location.siteType],
    ["Address", `${location.city}, India`],
    ["Timezone", "Asia/Kolkata (UTC+05:30)"],
    ["Latitude", "28.6139"],
    ["Longitude", "77.2090"],
    ["Owner", `${customer.owner.name} · ${customer.owner.email}`],
    ["Subscription", `${customer.subscription.plan} · ${customer.subscription.billingCycle}`],
    ["Status", customer.status],
  ];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Property information</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate text-sm font-medium capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/* ---------- Routers ---------- */

function statusVariant(s: LocationRouter["status"]): "default" | "secondary" | "destructive" | "outline" {
  return s === "online" ? "default" : s === "degraded" ? "secondary" : "destructive";
}

function RoutersTab({ resources }: { resources: LocationResources }) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [q, setQ] = useState("");
  const filtered = resources.routers.filter((r) =>
    (r.name + r.model + r.publicIp).toLowerCase().includes(q.toLowerCase()),
  );

  if (resources.routers.length === 0) {
    return <EmptyState title="No routers yet" body="Register your first router to get started." action={<Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add router</Button>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input placeholder="Search routers…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
          <Button size="sm" variant={view === "cards" ? "default" : "outline"} onClick={() => setView("cards")}>Cards</Button>
          <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>List</Button>
        </div>
        <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add router</Button>
      </div>

      {view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => <RouterCard key={r.id} r={r} />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identity</TableHead><TableHead>Serial</TableHead>
                    <TableHead>Model</TableHead><TableHead>RouterOS</TableHead>
                    <TableHead>CPU</TableHead><TableHead>RAM</TableHead>
                    <TableHead>Traffic</TableHead><TableHead>Clients</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">SN-{r.id.slice(-6)}</TableCell>
                      <TableCell>{r.model}</TableCell>
                      <TableCell>7.14.{i + 1}</TableCell>
                      <TableCell>{30 + i * 7}%</TableCell>
                      <TableCell>{40 + i * 5}%</TableCell>
                      <TableCell>{120 + i * 40} Mbps</TableCell>
                      <TableCell>{20 + i * 3}</TableCell>
                      <TableCell><Badge variant={statusVariant(r.status)} className="capitalize">{r.status}</Badge></TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => toast.info("Router actions")}>Open</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RouterCard({ r }: { r: LocationRouter }) {
  const cpu = 20 + (r.name.length * 7) % 70;
  const ram = 30 + (r.model.length * 5) % 60;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RouterIcon className="h-4 w-4 text-primary" />
              <p className="truncate text-sm font-semibold">{r.name}</p>
            </div>
            <p className="truncate text-xs text-muted-foreground">{r.model} · {r.publicIp}</p>
          </div>
          <Badge variant={statusVariant(r.status)} className="capitalize">{r.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between text-xs"><span>CPU</span><span className="font-mono">{cpu}%</span></div>
            <Progress value={cpu} className="mt-1 h-1.5" />
          </div>
          <div>
            <div className="flex justify-between text-xs"><span>RAM</span><span className="font-mono">{ram}%</span></div>
            <Progress value={ram} className="mt-1 h-1.5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Traffic</p>
            <p className="text-sm font-medium">{120 + cpu} Mbps</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Uptime</p>
            <p className="text-sm font-medium">{r.uptime}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px]">WireGuard OK</Badge>
          <Badge variant="outline" className="text-[10px]">RouterOS 7.14</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["Open", "Restart", "Backup", "Sync", "Logs", "Terminal"] as const).map((label) => (
            <Button key={label} size="sm" variant="outline" className="h-7 px-2 text-xs"
              onClick={() => toast.success(`${label} · ${r.name}`)}>{label}</Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Guest WiFi ---------- */

function GuestWifiTab({ resources }: { resources: LocationResources }) {
  const methods = [
    { key: "voucher", label: "Voucher login", on: true },
    { key: "qr", label: "QR login", on: true },
    { key: "email", label: "Email login", on: false },
    { key: "otp", label: "Mobile OTP", on: true },
    { key: "social", label: "Social login", on: false },
    { key: "userpass", label: "Username / password", on: false },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Guest sessions" value={resources.analytics.dailySessions} icon={Wifi} />
        <Kpi label="Today's guests" value={resources.analytics.activeGuests} icon={Users} />
        <Kpi label="Monthly guests" value={resources.analytics.dailySessions * 22} icon={Users} />
        <Kpi label="Avg session" value="24m" icon={Activity} />
        <Kpi label="Bandwidth" value={`${resources.analytics.dataConsumedGb} GB`} icon={Gauge} />
        <Kpi label="Devices" value={resources.guests.length} icon={Cpu} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Login methods</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {methods.map((m) => (
              <div key={m.key} className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">{m.label}</p><p className="text-xs text-muted-foreground">{m.on ? "Enabled" : "Disabled"}</p></div>
                <Switch defaultChecked={m.on} onCheckedChange={(v) => toast.success(`${m.label} ${v ? "enabled" : "disabled"}`)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Vouchers</CardTitle>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Generate</Button>
              <Button size="sm" variant="outline">Bulk</Button>
              <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Used</TableHead></TableRow></TableHeader>
              <TableBody>
                {["VCH-8821", "VCH-8822", "VCH-8823", "VCH-8824"].map((c, i) => (
                  <TableRow key={c}>
                    <TableCell className="font-mono">{c}</TableCell>
                    <TableCell>{["1h", "24h", "1h", "3d"][i]}</TableCell>
                    <TableCell><Badge variant={i === 3 ? "secondary" : "default"}>{i === 3 ? "unused" : "active"}</Badge></TableCell>
                    <TableCell className="text-right">{[3, 12, 1, 0][i]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">QR login</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="grid h-40 w-40 place-items-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/30">
              <QrCode className="h-24 w-24 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">portal.cloudguest.io/{resources.routers[0]?.id ?? "loc"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline"><Download className="mr-1 h-3.5 w-3.5" />Download</Button>
              <Button size="sm" variant="outline">Print</Button>
              <Button size="sm" variant="outline">Brand</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Captive Portal ---------- */

function PortalTab({ customer, location }: { customer: ExistingCustomer; location: ExistingCustomer["locations"][number] }) {
  const [primary, setPrimary] = useState("#6366f1");
  const [secondary, setSecondary] = useState("#22c55e");
  const [welcome, setWelcome] = useState(`Welcome to ${location.name}`);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Portal status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Status" value="Live" icon={ShieldCheck} tone="positive" />
            <Kpi label="URL" value="portal.cg.io" icon={Wifi} />
            <Kpi label="Languages" value="5" icon={FileText} />
            <Kpi label="Conversions" value="72%" icon={BarChart3} tone="positive" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Customization</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Welcome message</Label><Textarea rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Redirect URL</Label><Input defaultValue={`https://${customer.name.toLowerCase().replace(/\s+/g, "")}.com`} /></div>
            <div className="space-y-1.5"><Label>Primary color</Label>
              <div className="flex items-center gap-2"><Input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-14 p-1" /><Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="font-mono" /></div>
            </div>
            <div className="space-y-1.5"><Label>Secondary color</Label>
              <div className="flex items-center gap-2"><Input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-9 w-14 p-1" /><Input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="font-mono" /></div>
            </div>
            <div className="space-y-1.5"><Label>Font</Label>
              <Select defaultValue="inter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="inter">Inter</SelectItem><SelectItem value="poppins">Poppins</SelectItem><SelectItem value="system">System</SelectItem>
              </SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Languages</Label>
              <Input defaultValue="EN, HI, AR, FR, ES" />
            </div>
            <div className="sm:col-span-2 space-y-1.5"><Label>Terms & conditions</Label><Textarea rows={3} defaultValue="By connecting you agree to fair-use and privacy terms." /></div>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-4 lg:self-start">
        <CardHeader className="pb-2"><CardTitle className="text-base">Live preview</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border" style={{ background: `linear-gradient(160deg, ${primary}22, ${secondary}22)` }}>
            <div className="space-y-3 p-5 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full" style={{ background: primary, color: "white" }}>
                <Wifi className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">{welcome}</p>
              <p className="text-xs text-muted-foreground">Connect to enjoy free WiFi</p>
              <div className="mx-auto max-w-xs space-y-2">
                <Input placeholder="Mobile number" className="h-9" />
                <Button className="h-9 w-full" style={{ background: primary }}>Continue</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Powered by CloudGuest · {location.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Guests ---------- */

function GuestsTab({ resources }: { resources: LocationResources }) {
  const [tab, setTab] = useState<"active" | "history" | "blocked" | "whitelist" | "devices">("active");
  if (resources.guests.length === 0) return <EmptyState title="No guest sessions" body="No guest sessions found yet." />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["active", "history", "blocked", "whitelist", "devices"] as const).map((k) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} className="capitalize" onClick={() => setTab(k)}>{k}</Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead><TableHead>Device</TableHead><TableHead>MAC</TableHead>
                  <TableHead>IP</TableHead><TableHead>Method</TableHead><TableHead>Voucher</TableHead>
                  <TableHead>Bandwidth</TableHead><TableHead>Session</TableHead><TableHead>Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.guests.map((g, i) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>{g.device}</TableCell>
                    <TableCell className="font-mono text-xs">{g.mac}</TableCell>
                    <TableCell className="font-mono text-xs">10.10.{i + 1}.{20 + i}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{["otp", "voucher", "qr", "social"][i % 4]}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{i % 3 === 1 ? `VCH-88${20 + i}` : "—"}</TableCell>
                    <TableCell>{g.dataMb} MB</TableCell>
                    <TableCell>{20 + i * 3}m</TableCell>
                    <TableCell>{g.connectedAt}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => toast.info(`Details · ${g.name}`)}>Details</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Staff ---------- */

const STAFF_ROLES = ["Location Admin", "Manager", "Reception", "IT", "Billing", "Security", "Housekeeping", "Viewer"];

function StaffTab({ resources }: { resources: LocationResources }) {
  const [q, setQ] = useState("");
  const filtered = resources.staff.filter((s) => (s.name + s.role).toLowerCase().includes(q.toLowerCase()));
  if (resources.staff.length === 0) return <EmptyState title="No staff yet" body="Invite your team to collaborate." action={<Button size="sm"><UserPlus className="mr-1.5 h-4 w-4" />Invite</Button>} />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input placeholder="Search staff…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
        <div className="flex flex-wrap gap-1.5">
          {STAFF_ROLES.map((r) => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}
        </div>
        <Button size="sm"><UserPlus className="mr-1.5 h-4 w-4" />Invite staff</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Mobile</TableHead>
                  <TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Last login</TableHead>
                  <TableHead>Routers</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>+91 98{100 + i} 8800{i}</TableCell>
                    <TableCell><Badge variant="secondary">{s.role}</Badge></TableCell>
                    <TableCell><Badge variant={i % 4 === 3 ? "outline" : "default"}>{i % 4 === 3 ? "invited" : "active"}</Badge></TableCell>
                    <TableCell>{s.lastActive}</TableCell>
                    <TableCell>{(i % 3) + 1}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => toast.info("Edit")}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.warning("Disabled")}>Disable</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Analytics ---------- */

function AnalyticsTab({ resources }: { resources: LocationResources }) {
  const growth = Array.from({ length: 12 }, (_, i) => ({ m: ["J","F","M","A","M","J","J","A","S","O","N","D"][i], guests: 120 + i * 30, revenue: 800 + i * 220 }));
  const devices = [
    { name: "iPhone", value: 42 }, { name: "Android", value: 34 },
    { name: "MacBook", value: 12 }, { name: "Windows", value: 9 }, { name: "iPad", value: 3 },
  ];
  const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Guest count" value={resources.analytics.dailySessions} icon={Users} />
        <Kpi label="Returning" value={`${34}%`} icon={Users} />
        <Kpi label="Revenue" value="$12.4k" icon={Receipt} tone="positive" />
        <Kpi label="Bandwidth" value={`${resources.analytics.dataConsumedGb} GB`} icon={Gauge} />
        <Kpi label="Peak hour" value="19:00" icon={Activity} />
        <Kpi label="Portal views" value="8.2k" icon={BarChart3} />
        <Kpi label="Conversion" value="72%" icon={ShieldCheck} tone="positive" />
        <Kpi label="Voucher use" value="61%" icon={Ticket} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Guest growth</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="m" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} /><Tooltip />
                <Line type="monotone" dataKey="guests" stroke="hsl(var(--primary))" />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top devices</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={devices}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="name" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} /><Tooltip />
                <Bar dataKey="value" radius={[6,6,0,0]}>{devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Monitoring ---------- */

function MonitoringTab({ resources }: { resources: LocationResources }) {
  const alerts = [
    { level: "warning", msg: "High CPU on Router 2 (86%)" },
    { level: "info", msg: "License renewing in 22 days" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="CPU" value="52%" icon={Cpu} />
        <Kpi label="RAM" value="61%" icon={Cpu} />
        <Kpi label="Disk" value="34%" icon={Cpu} />
        <Kpi label="Temp" value="48°C" icon={Gauge} />
        <Kpi label="Latency" value="18ms" icon={Activity} tone="positive" />
        <Kpi label="Packet loss" value="0.2%" icon={Activity} tone="positive" />
        <Kpi label="Internet" value="Up" icon={Wifi} tone="positive" />
        <Kpi label="WireGuard" value="Connected" icon={ShieldCheck} tone="positive" />
        <Kpi label="Routers" value={`${resources.routers.filter(r=>r.status==="online").length}/${resources.routers.length}`} icon={RouterIcon} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Active alerts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${a.level === "warning" ? "text-amber-500" : "text-primary"}`} />
                <span className="text-sm">{a.msg}</span>
              </div>
              <Badge variant={a.level === "warning" ? "secondary" : "outline"} className="capitalize">{a.level}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Reports ---------- */

function ReportsTab() {
  const reports = ["Guest report", "Voucher report", "Bandwidth report", "Revenue report", "Router report", "Portal report", "Audit report"];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Generate reports</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => (
            <div key={r} className="rounded-lg border p-4">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">{r}</p></div>
              <p className="mt-1 text-xs text-muted-foreground">Last generated 3d ago</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["PDF", "Excel", "CSV"] as const).map((f) => (
                  <Button key={f} size="sm" variant="outline" onClick={() => toast.success(`${r} exported (${f})`)}>{f}</Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Billing ---------- */

function BillingTab({ customer, resources }: { customer: ExistingCustomer; resources: LocationResources }) {
  const invoices = Array.from({ length: 5 }, (_, i) => ({
    id: `INV-${2401 + i}`, date: new Date(Date.now() - i * 30 * 86400000).toISOString().slice(0, 10),
    amount: 420 + i * 40, status: i === 0 ? "due" : "paid",
  }));
  const usageGuests = resources.analytics.dailySessions * 30;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Current plan" value={customer.subscription.plan} icon={ShieldCheck} />
        <Kpi label="Guests (mo)" value={usageGuests} sub="of 250k" icon={Users} />
        <Kpi label="Bandwidth" value={`${resources.analytics.dataConsumedGb * 30} GB`} sub="of 2 TB" icon={Gauge} />
        <Kpi label="Storage" value="18 GB" sub="of 100 GB" icon={Cpu} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Invoices & payments</CardTitle>
          <Button size="sm" variant="outline"><Download className="mr-1 h-3.5 w-3.5" />Export</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
            <TableBody>
              {invoices.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">{v.id}</TableCell>
                  <TableCell>{v.date}</TableCell>
                  <TableCell>${v.amount}</TableCell>
                  <TableCell><Badge variant={v.status === "due" ? "destructive" : "default"} className="capitalize">{v.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost">View</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Audit ---------- */

function AuditTab() {
  const events = [
    { icon: Users, when: "2m ago", who: "guest.otp", what: "Guest login via OTP · +91 98•••••23" },
    { icon: Ticket, when: "18m ago", who: "reception@delhi", what: "Voucher VCH-8824 created (24h)" },
    { icon: RouterIcon, when: "1h ago", who: "system", what: "Router 2 restarted after firmware update" },
    { icon: SettingsIcon, when: "3h ago", who: "manager@delhi", what: "Captive portal updated (primary color)" },
    { icon: UserPlus, when: "1d ago", who: "owner@existing.com", what: "Staff added: Anjali Rao (Reception)" },
    { icon: SettingsIcon, when: "2d ago", who: "admin", what: "RADIUS configuration changed" },
  ];
  const [q, setQ] = useState("");
  const filtered = events.filter((e) => (e.who + e.what).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
        <Select defaultValue="all"><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="all">All actions</SelectItem><SelectItem value="login">Logins</SelectItem>
          <SelectItem value="config">Config</SelectItem><SelectItem value="voucher">Vouchers</SelectItem>
        </SelectContent></Select>
        <Select defaultValue="7d"><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="24h">24h</SelectItem><SelectItem value="7d">7 days</SelectItem><SelectItem value="30d">30 days</SelectItem>
        </SelectContent></Select>
      </div>
      <Card>
        <CardContent className="p-4">
          <ol className="relative border-l pl-6">
            {filtered.map((e, i) => (
              <li key={i} className="mb-4 last:mb-0">
                <span className="absolute -left-3 grid h-6 w-6 place-items-center rounded-full border bg-background"><e.icon className="h-3 w-3 text-primary" /></span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm">{e.what}</p>
                  <span className="text-xs text-muted-foreground">· {e.who} · {e.when}</span>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Settings ---------- */

function SettingsTab({ customer, location }: { customer: ExistingCustomer; location: ExistingCustomer["locations"][number] }) {
  const sections = [
    "General", "Guest WiFi", "Captive Portal", "Notifications", "RADIUS",
    "WireGuard", "Security", "Email", "SMS", "Integrations",
  ];
  const [active, setActive] = useState(sections[0]);
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card>
        <CardContent className="p-2">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {sections.map((s) => (
              <button key={s} onClick={() => setActive(s)} className={`rounded-md px-3 py-1.5 text-left text-sm ${active === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{s}</button>
            ))}
          </nav>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{active}</CardTitle>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline">Test connection</Button>
            <Button size="sm">Save</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {active === "General" ? (
            <>
              <div className="space-y-1.5"><Label>Property name</Label><Input defaultValue={location.name} /></div>
              <div className="space-y-1.5"><Label>Property type</Label><Input defaultValue={location.siteType} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Input defaultValue={`${location.city}, India`} /></div>
              <div className="space-y-1.5"><Label>Timezone</Label><Input defaultValue="Asia/Kolkata" /></div>
              <div className="space-y-1.5"><Label>Latitude</Label><Input defaultValue="28.6139" /></div>
              <div className="space-y-1.5"><Label>Longitude</Label><Input defaultValue="77.2090" /></div>
              <div className="space-y-1.5"><Label>Owner</Label><Input defaultValue={customer.owner.email} disabled /></div>
              <div className="flex items-end justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">Location enabled</p><p className="text-xs text-muted-foreground">Guest access & monitoring active</p></div>
                <Switch defaultChecked />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button variant="outline"><Download className="mr-1.5 h-4 w-4" />Upload logo</Button>
                <Button variant="destructive" onClick={() => toast.error("Delete location (mock)")}>Delete location</Button>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <ScrollText className="mx-auto mb-2 h-6 w-6" />
              {active} settings are managed via the workspace defaults. Location-specific overrides can be added here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Helpers ---------- */

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="grid place-items-center gap-2 p-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted"><RouterIcon className="h-5 w-5 text-muted-foreground" /></div>
        <p className="text-base font-semibold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
        {action}
      </CardContent>
    </Card>
  );
}

function LocationWorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function ArrowBack() { return <ArrowLeft className="mr-1.5 h-4 w-4" />; }
// keep import used
void ArrowBack;
