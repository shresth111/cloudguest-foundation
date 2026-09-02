import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Cpu,
  Download,
  FileText,
  Gauge,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Router as RouterIcon,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
  Wifi,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui-ext";
import type { StatTone } from "@/components/ui-ext";
import { businessTypeIcon } from "@/lib/business-type-icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocationResources } from "@/hooks/useWorkspace";
import { useDeleteLocations, useUpdateLocation } from "@/hooks/useLocations";
import { useRebootRouter } from "@/hooks/useRouters";
import { useQuery } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoring.service";
import { routerService } from "@/services/router.service";
import { locationService } from "@/services/location.service";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { ExistingCustomer } from "@/context/WorkspaceContext";
import type { LocationResources, LocationRouterSummary } from "@/hooks/useWorkspace";
import type { RouterStatus } from "@/types/router";
import { GUEST_AUTH_METHOD_LABEL } from "@/types/guest";
import type { GuestAuthMethod } from "@/types/guest";
import type { AppError } from "@/services/api";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// analytics / reports / billing / audit / staff used to be tabs here. Every
// one of them rendered invented figures -- literal invoice numbers, a
// hardcoded "Revenue (MTD) $4,820", a twelve-month growth curve computed as
// `120 + i * 30`, and an audit log of fabricated entries the owner could
// search. None had a per-location data source. The workspace already has
// real, org-scoped Analytics, Reports and Billing pages, and staff is a
// per-user concern, not a per-location one; RelatedLinks below points there.
const TAB_KEYS = [
  "overview",
  "routers",
  "wifi",
  "portal",
  "guests",
  "monitoring",
  "settings",
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
        <Button size="sm" variant="outline" onClick={() => reset()}>
          Retry
        </Button>
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
  const { customer: workspaceCustomer, locations, isLoading: loadingCustomers } = useWorkspace();
  const {
    data: resources,
    isLoading: loadingResources,
    isError: resourcesFailed,
    error: resourcesError,
    refetch,
  } = useLocationResources(locationId);
  const remove = useDeleteLocations();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const context = useMemo(() => {
    if (!workspaceCustomer) return null;
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return null;
    return { customer: workspaceCustomer, location: loc };
  }, [workspaceCustomer, locations, locationId]);

  const setTab = (t: TabKey) =>
    navigate({
      to: ".",
      params: { locationId },
      search: asTabSearchReducer((prev) => ({ ...prev, tab: t })),
    });

  if (loadingCustomers) return <LocationWorkspaceSkeleton />;
  if (!context) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Location not found</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            The location <code>{locationId}</code> doesn't belong to any customer in this workspace.
          </span>
          <Button asChild size="sm" variant="outline">
            <Link to="/workspace/locations">Back</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { customer, location } = context;

  return (
    <div className="space-y-4">
      <LocationHeader
        customer={customer}
        location={location}
        onEdit={() => setTab("settings")}
        onRefresh={() => refetch()}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${location.name}?`}
        description="This archives the location. Guest access and monitoring for it will stop."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await remove.mutateAsync([location.id]);
            toast.success("Location deleted");
            navigate({ to: "/workspace/locations" });
          } catch (err) {
            toast.error((err as unknown as AppError).message || "Failed to delete location");
          }
        }}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="w-max min-w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="routers">Routers</TabsTrigger>
            <TabsTrigger value="wifi">Guest WiFi</TabsTrigger>
            <TabsTrigger value="portal">Captive portal</TabsTrigger>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4">
          {loadingResources ? (
            <LocationWorkspaceSkeleton />
          ) : resourcesFailed || !resources ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Couldn&apos;t load this location&apos;s data</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span className="truncate">
                  {(resourcesError as AppError | null)?.message ??
                    "The routers and guest sessions for this location could not be fetched."}
                </span>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <TabsContent value="overview">
                <OverviewTab
                  customer={customer}
                  location={location}
                  resources={resources}
                  onNavigate={setTab}
                />
              </TabsContent>
              <TabsContent value="routers">
                <RoutersTab resources={resources} />
              </TabsContent>
              <TabsContent value="wifi">
                <GuestWifiTab resources={resources} />
              </TabsContent>
              <TabsContent value="portal">
                <PortalTab customer={customer} location={location} />
              </TabsContent>
              <TabsContent value="guests">
                <GuestsTab resources={resources} />
              </TabsContent>
              <TabsContent value="monitoring">
                <MonitoringTab resources={resources} locationId={location.id} />
              </TabsContent>
              <TabsContent value="settings">
                <SettingsTab
                  customer={customer}
                  location={location}
                  onDeleteClick={() => setConfirmDelete(true)}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

/* ---------- Header ---------- */

function LocationHeader({
  customer,
  location,
  onEdit,
  onRefresh,
}: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const sibling = customer.locations.filter((l) => l.id !== location.id);
  const navigate = useNavigate();
  // Status and timezone were hardcoded to "Active" and Asia/Kolkata, so a
  // suspended or archived location advertised itself as active and every
  // venue on the platform claimed IST.
  const detailQ = useQuery({
    queryKey: ["workspace", "locationDetail", location.id],
    queryFn: () => locationService.getDetail(location.id),
  });
  const headerStatus = detailQ.data?.status;
  const headerTimezone = detailQ.data?.timezone;
  const HeaderIcon = businessTypeIcon(location.siteType);
  return (
    <Card>
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:p-5 md:flex md:flex-wrap md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <HeaderIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{location.name}</h1>
              <Badge variant="secondary" className="capitalize">
                {location.siteType}
              </Badge>
              <Badge
                variant={
                  headerStatus === "active"
                    ? "default"
                    : headerStatus === "suspended"
                      ? "destructive"
                      : "secondary"
                }
                className="capitalize"
              >
                {headerStatus ?? "…"}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {customer.subscription.plan}
              </Badge>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location.city}
              {headerTimezone ? ` · ${headerTimezone}` : ""} ·{" "}
              <span className="font-mono">{location.id}</span> · {customer.name}
            </p>
          </div>
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 md:col-span-1">
          {sibling.length > 0 && (
            <Select
              value={location.id}
              onValueChange={(id) =>
                navigate({ to: "/workspace/locations/$locationId", params: { locationId: id } })
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customer.locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} · {l.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Overview ---------- */

// Thin wrapper over the app's real premium StatCard (src/components/
// ui-ext/StatCard.tsx) -- keeps every existing call site's `sub`/`tone`
// API unchanged while giving all ~35 KPI usages across this file's tabs
// the same gradient-accent, animated-counter treatment as the workspace
// Dashboard Overview, in one place.
function Kpi({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const statTone: StatTone = tone === "positive" ? "success" : tone;
  return <StatCard label={label} value={value} hint={sub} tone={statTone} icon={icon} />;
}

function OverviewTab({
  customer,
  location,
  resources,
  onNavigate,
}: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
  resources: LocationResources;
  onNavigate: (t: TabKey) => void;
}) {
  const online = resources.routers.filter((r) => r.status === "online").length;
  const offline = resources.routers.filter((r) => r.status === "offline").length;
  // An org with no subscription row has expiryDate "", so new Date("") is
  // NaN and the KPI used to read "Renews in NaNd".
  const expiry = customer.subscription.expiryDate
    ? new Date(customer.subscription.expiryDate).getTime()
    : NaN;
  const days = Number.isNaN(expiry)
    ? null
    : Math.max(0, Math.floor((expiry - Date.now()) / 86400000));

  // A real histogram of the sessions loaded for this location, bucketed by
  // start hour. The previous series was `20 + ((i * 17) % 120)` -- a shape
  // with no data behind it at all.
  const now = new Date();
  const activity = (() => {
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const end = new Date(now.getTime() - (11 - i) * 2 * 3600_000);
      return {
        label: `${String(end.getHours()).padStart(2, "0")}:00`,
        from: end.getTime() - 2 * 3600_000,
        to: end.getTime(),
        guests: 0,
        bandwidth: 0,
      };
    });
    for (const g of resources.guestSessions) {
      const t = new Date(g.startedAt).getTime();
      const b = buckets.find((x) => t > x.from && t <= x.to);
      if (b) {
        b.guests += 1;
        b.bandwidth += g.dataMb;
      }
    }
    return buckets.map(({ label, guests, bandwidth }) => ({
      label,
      guests,
      bandwidth: Number(bandwidth.toFixed(1)),
    }));
  })();
  const activityEmpty = activity.every((b) => b.guests === 0);

  // Real login-method split from the sessions in hand, replacing a fixed
  // 42/26/18/14 pie that was the same for every venue on the platform.
  const methodCounts = resources.guestSessions.reduce<Record<string, number>>((acc, g) => {
    acc[g.authMethod] = (acc[g.authMethod] ?? 0) + 1;
    return acc;
  }, {});
  const methods = Object.entries(methodCounts).map(([name, value]) => ({
    name: GUEST_AUTH_METHOD_LABEL[name as GuestAuthMethod] ?? name,
    value,
  }));
  const COLORS = ["var(--primary)", "#22c55e", "#f59e0b", "#8b5cf6"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi
          label="Routers online"
          value={online}
          sub={`${resources.routers.length} total`}
          icon={RouterIcon}
          tone="positive"
        />
        <Kpi
          label="Routers offline"
          value={offline}
          icon={RouterIcon}
          tone={offline ? "danger" : "default"}
        />
        <Kpi label="Guest sessions" value={resources.analytics.totalSessions} icon={Users} />
        <Kpi
          label="Active sessions"
          value={resources.analytics.activeSessions}
          icon={Wifi}
          tone="positive"
        />
        <Kpi
          label="Bandwidth"
          value={`${resources.analytics.dataConsumedGb.toFixed(1)} GB`}
          sub="recent sessions"
          icon={Gauge}
        />
        <Kpi
          label="Subscription"
          value={customer.subscription.plan}
          sub={days === null ? undefined : `Renews in ${days}d`}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Guest activity &amp; data · last 24h</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {activityEmpty ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                No guest sessions started here in the last 24 hours.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Area type="monotone" dataKey="guests" stroke="var(--primary)" fill="url(#gA)" />
                  <Line type="monotone" dataKey="bandwidth" stroke="#f59e0b" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Login methods</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {methods.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                No logins recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methods}
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {methods.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <QuickActions onNavigate={onNavigate} />

      <PropertyInfoCard customer={customer} location={location} />
    </div>
  );
}

function QuickActions({ onNavigate }: { onNavigate: (t: TabKey) => void }) {
  const actions: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  }[] = [
    { label: "Routers", icon: RouterIcon, onClick: () => onNavigate("routers") },
    { label: "Guest WiFi", icon: Ticket, onClick: () => onNavigate("wifi") },
    { label: "Guests", icon: Users, onClick: () => onNavigate("guests") },
    { label: "Monitoring", icon: Activity, onClick: () => onNavigate("monitoring") },
    { label: "Captive portal", icon: SettingsIcon, onClick: () => onNavigate("portal") },
    { label: "Settings", icon: Pencil, onClick: () => onNavigate("settings") },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={a.onClick}
            >
              <a.icon className="mr-2 h-4 w-4" />
              {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyInfoCard({
  customer,
  location,
}: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
}) {
  // The workspace's location object is narrowed to {id, name, city,
  // siteType}, so address, timezone and coordinates were previously
  // hardcoded to New Delhi for every location on the platform. They are on
  // the real backend row; fetch it.
  const detailQ = useQuery({
    queryKey: ["workspace", "locationDetail", location.id],
    queryFn: () => locationService.getDetail(location.id),
  });
  const d = detailQ.data;
  const address = d
    ? [d.address_line1, d.city, d.state_province, d.postal_code, d.country]
        .filter(Boolean)
        .join(", ")
    : location.city;
  const coord = (v: number | null | undefined) =>
    v === null || v === undefined ? "Not set" : String(v);

  const rows: Array<[string, string]> = [
    ["Property name", d?.name ?? location.name],
    ["Property type", location.siteType],
    ["Address", address],
    ["Timezone", d?.timezone ?? (detailQ.isLoading ? "…" : "Not set")],
    ["Latitude", detailQ.isLoading ? "…" : coord(d?.latitude)],
    ["Longitude", detailQ.isLoading ? "…" : coord(d?.longitude)],
    ["Contact", customer.owner.email],
    ["Subscription", `${customer.subscription.plan} · ${customer.subscription.billingCycle}`],
    ["Status", d?.status ?? customer.status],
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Property information</CardTitle>
      </CardHeader>
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

function statusVariant(s: RouterStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "online") return "default";
  if (s === "provisioning" || s === "pending_provisioning") return "secondary";
  return "destructive";
}

function RoutersTab({ resources }: { resources: LocationResources }) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [q, setQ] = useState("");
  const filtered = resources.routers.filter((r) =>
    (r.name + r.model + (r.publicIpAddress ?? "")).toLowerCase().includes(q.toLowerCase()),
  );

  if (resources.routers.length === 0) {
    return (
      <EmptyState
        title="No routers yet"
        body="Routers are registered and provisioned for you by the Wyfy Guest team. Contact support to add one to this location."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search routers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-56"
          />
          <Button
            size="sm"
            variant={view === "cards" ? "default" : "outline"}
            onClick={() => setView("cards")}
          >
            Cards
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
          >
            List
          </Button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <RouterCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identity</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>RouterOS</TableHead>
                    <TableHead>Public IP</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.serialNumber}</TableCell>
                      <TableCell>{r.model}</TableCell>
                      <TableCell>{r.routerOsVersion ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.publicIpAddress ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)} className="capitalize">
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RouterRowActions r={r} />
                      </TableCell>
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

/** Restart, confirmed, for the table view. Same real mutation the card uses. */
function RouterRowActions({ r }: { r: LocationRouterSummary }) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const restart = useRebootRouter();
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={restart.isPending}
        onClick={() => setConfirmRestart(true)}
      >
        {restart.isPending ? "Restarting…" : "Restart"}
      </Button>
      <ConfirmDialog
        open={confirmRestart}
        onOpenChange={setConfirmRestart}
        title={`Restart ${r.name}?`}
        description="Every guest connected to this router is disconnected, and it stays offline for its normal one-to-two minute boot cycle."
        confirmLabel="Restart"
        destructive
        onConfirm={async () => {
          try {
            await restart.mutateAsync(r.id);
            toast.success(`${r.name} is restarting`);
          } catch (err) {
            toast.error((err as unknown as AppError).message || `Couldn't restart ${r.name}`);
          }
        }}
      />
    </>
  );
}

function RouterCard({ r }: { r: LocationRouterSummary }) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const restart = useRebootRouter();

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RouterIcon className="h-4 w-4 text-primary" />
              <p className="truncate text-sm font-semibold">{r.name}</p>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {r.model} · {r.publicIpAddress ?? "no public IP"}
            </p>
          </div>
          <Badge variant={statusVariant(r.status)} className="capitalize">
            {r.status.replace(/_/g, " ")}
          </Badge>
        </div>
        {/* CPU, RAM and throughput are deliberately absent: the backend records
            a self-reported heartbeat, not live device metrics. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Last seen</p>
            <p className="text-sm font-medium">
              {r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : "Never"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Management IP</p>
            <p className="text-sm font-medium">{r.publicIpAddress ?? "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {r.serialNumber}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            RouterOS {r.routerOsVersion ?? "unknown"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={restart.isPending}
            onClick={() => setConfirmRestart(true)}
          >
            {restart.isPending ? "Restarting…" : "Restart"}
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmRestart}
        onOpenChange={setConfirmRestart}
        title={`Restart ${r.name}?`}
        description="Every guest connected to this router is disconnected, and it stays offline for its normal one-to-two minute boot cycle."
        confirmLabel="Restart"
        destructive
        onConfirm={async () => {
          try {
            await restart.mutateAsync(r.id);
            toast.success(`${r.name} is restarting`);
          } catch (err) {
            toast.error((err as unknown as AppError).message || `Couldn't restart ${r.name}`);
          }
        }}
      />
    </Card>
  );
}

/* ---------- Guest WiFi ---------- */

function GuestWifiTab({ resources }: { resources: LocationResources }) {
  // The login-method list used to be six Switches over hardcoded on/off
  // state, identical for every location, whose only handler was a success
  // toast -- toggling "Mobile OTP" off reported success and changed nothing,
  // anywhere. There is no per-location auth-method endpoint on the customer
  // surface, so this shows what guests actually used instead of pretending
  // to configure it. The voucher table and QR panel that sat below were
  // likewise literal codes (VCH-8821..8824) with no voucher API behind them.
  const methodCounts = resources.guestSessions.reduce<Record<string, number>>((acc, g) => {
    acc[g.authMethod] = (acc[g.authMethod] ?? 0) + 1;
    return acc;
  }, {});
  const methods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);
  const totalWithMethod = methods.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Guest sessions" value={resources.analytics.totalSessions} icon={Wifi} />
        <Kpi label="Active now" value={resources.analytics.activeSessions} icon={Users} />
        <Kpi
          label="Data used"
          value={`${resources.analytics.dataConsumedGb.toFixed(1)} GB`}
          sub="sessions loaded"
          icon={Gauge}
        />
        <Kpi label="Sessions listed" value={resources.guestSessions.length} icon={Cpu} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How guests signed in</CardTitle>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No guest logins recorded for this location yet.
            </p>
          ) : (
            <div className="space-y-3">
              {methods.map(([method, count]) => {
                const pct = totalWithMethod ? Math.round((count / totalWithMethod) * 100) : 0;
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{GUEST_AUTH_METHOD_LABEL[method as GuestAuthMethod] ?? method}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {count} · {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className="mt-1 h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Captive Portal ---------- */

function PortalTab({
  customer,
  location,
}: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
}) {
  const [primary, setPrimary] = useState("#6366f1");
  const [secondary, setSecondary] = useState("#22c55e");
  const [welcome, setWelcome] = useState(`Welcome to ${location.name}`);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Portal status</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Status" value="Live" icon={ShieldCheck} tone="positive" />
            <Kpi label="URL" value="portal.cg.io" icon={Wifi} />
            <Kpi label="Languages" value="5" icon={FileText} />
            <Kpi label="Conversions" value="72%" icon={BarChart3} tone="positive" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Customization</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Welcome message</Label>
              <Textarea rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Redirect URL</Label>
              <Input
                defaultValue={`https://${customer.name.toLowerCase().replace(/\s+/g, "")}.com`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Primary color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="h-9 w-14 p-1"
                />
                <Input
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Secondary color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="h-9 w-14 p-1"
                />
                <Input
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Font</Label>
              <Select defaultValue="inter">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="poppins">Poppins</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Languages</Label>
              <Input defaultValue="EN, HI, AR, FR, ES" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Terms & conditions</Label>
              <Textarea
                rows={3}
                defaultValue="By connecting you agree to fair-use and privacy terms."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-4 lg:self-start">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Live preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-hidden rounded-xl border"
            style={{ background: `linear-gradient(160deg, ${primary}22, ${secondary}22)` }}
          >
            <div className="space-y-3 p-5 text-center">
              <div
                className="mx-auto grid h-10 w-10 place-items-center rounded-full"
                style={{ background: primary, color: "white" }}
              >
                <Wifi className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">{welcome}</p>
              <p className="text-xs text-muted-foreground">Connect to enjoy free WiFi</p>
              <div className="mx-auto max-w-xs space-y-2">
                <Input placeholder="Mobile number" className="h-9" />
                <Button className="h-9 w-full" style={{ background: primary }}>
                  Continue
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Powered by CloudGuest · {location.name}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Guests ---------- */

function GuestsTab({ resources }: { resources: LocationResources }) {
  if (resources.guestSessions.length === 0)
    return <EmptyState title="No guest sessions" body="No guest sessions found yet." />;
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.guestSessions.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.guestIdentifier}</TableCell>
                    <TableCell className="font-mono text-xs">{g.ipAddress ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {g.authMethod.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={g.status === "active" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {g.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{g.dataMb.toFixed(1)} MB</TableCell>
                    <TableCell>{new Date(g.startedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.info(`Details · ${g.guestIdentifier}`)}
                      >
                        Details
                      </Button>
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

/* ---------- Monitoring ---------- */

function MonitoringTab({
  resources,
  locationId,
}: {
  resources: LocationResources;
  locationId: string;
}) {
  const { customer } = useWorkspace();
  const organizationId = customer?.id;

  const alertsQ = useQuery({
    queryKey: ["workspace", "locationAlerts", organizationId, locationId],
    queryFn: () =>
      monitoringService.listAlerts({
        organizationId,
        status: "triggered",
        page: 1,
        pageSize: 100,
      }),
    enabled: !!organizationId,
  });

  const online = resources.routers.filter((r) => r.status === "online").length;
  // AlertListQuery has no location filter, so narrow the org's open alerts here.
  const alerts = (alertsQ.data?.items ?? []).filter((a) => a.locationId === locationId);
  const lastSeen = resources.routers
    .map((r) => r.lastSeenAt)
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Routers online"
          value={`${online}/${resources.routers.length}`}
          icon={RouterIcon}
          tone={
            resources.routers.length > 0 && online === resources.routers.length
              ? "positive"
              : undefined
          }
        />
        <Kpi
          label="Open alerts"
          value={alertsQ.isLoading ? "…" : alerts.length}
          icon={AlertTriangle}
        />
        <Kpi label="Guests online" value={resources.analytics.activeSessions} icon={Wifi} />
        <Kpi
          label="Last heartbeat"
          value={lastSeen ? new Date(lastSeen).toLocaleTimeString() : "Never"}
          icon={Activity}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        CPU, memory, disk, temperature and link latency aren&apos;t shown here yet — the backend
        only records a self-reported heartbeat today, not live device metrics.
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Active alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {alertsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading alerts…</p>
          ) : alertsQ.isError ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm">Alerts couldn&apos;t be loaded.</span>
              <Button size="sm" variant="outline" onClick={() => alertsQ.refetch()}>
                Retry
              </Button>
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active alerts for this location.</p>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 shrink-0 ${a.severity === "critical" ? "text-destructive" : a.severity === "warning" ? "text-amber-500" : "text-primary"}`}
                  />
                  <span className="text-sm">{a.message}</span>
                </div>
                <Badge
                  variant={a.severity === "info" ? "outline" : "secondary"}
                  className="shrink-0 capitalize"
                >
                  {a.severity}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Settings ---------- */

function SettingsTab({
  customer,
  location,
  onDeleteClick,
}: {
  customer: ExistingCustomer;
  location: ExistingCustomer["locations"][number];
  onDeleteClick: () => void;
}) {
  // RADIUS and WireGuard are deliberately absent: tunnel and RADIUS internals are
  // master-console-only and must never be surfaced to a venue owner.
  const sections = [
    "General",
    "Guest WiFi",
    "Captive Portal",
    "Notifications",
    "Security",
    "Email",
    "SMS",
    "Integrations",
  ];
  const [active, setActive] = useState(sections[0]);

  // The workspace's own location object is narrowed to {id, name, city,
  // siteType}; address, timezone and coordinates only exist on the full
  // backend row, so fetch it rather than showing invented defaults.
  const detailQ = useQuery({
    queryKey: ["workspace", "locationDetail", location.id],
    queryFn: () => locationService.getDetail(location.id),
  });
  const update = useUpdateLocation();

  const [form, setForm] = useState<GeneralSettingsForm | null>(null);
  const saved = detailQ.data ? toGeneralSettingsForm(detailQ.data) : null;
  const current = form ?? saved;
  const dirty = !!form && !!saved && !isSameGeneralSettings(form, saved);

  const setField = (key: keyof GeneralSettingsForm, value: string) => {
    if (!current) return;
    setForm({ ...current, [key]: value });
  };

  const onSave = () => {
    if (!form || !saved) return;
    const lat = form.latitude.trim();
    const lon = form.longitude.trim();
    if ((lat && Number.isNaN(Number(lat))) || (lon && Number.isNaN(Number(lon)))) {
      toast.error("Latitude and longitude must be numbers.");
      return;
    }
    if (form.country.trim().length !== 2) {
      toast.error("Country must be a 2-letter code, for example IN.");
      return;
    }
    update.mutate(
      {
        id: location.id,
        organizationId: customer.id,
        patch: {
          name: form.name.trim(),
          addressLine1: form.addressLine1.trim(),
          city: form.city.trim(),
          stateProvince: form.stateProvince.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim().toUpperCase(),
          timezone: form.timezone.trim(),
          latitude: lat ? Number(lat) : undefined,
          longitude: lon ? Number(lon) : undefined,
        },
      },
      {
        onSuccess: () => {
          setForm(null);
          toast.success("Location settings saved");
        },
        onError: (err) =>
          toast.error((err as unknown as AppError)?.message || "Couldn't save location settings"),
      },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card>
        <CardContent className="p-2">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={`rounded-md px-3 py-1.5 text-left text-sm ${active === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {s}
              </button>
            ))}
          </nav>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{active}</CardTitle>
          {active === "General" ? (
            <div className="flex items-center gap-1.5">
              {dirty ? (
                <span className="text-xs text-muted-foreground">Unsaved changes</span>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm(null)}
                disabled={!dirty || update.isPending}
              >
                Discard
              </Button>
              <Button size="sm" onClick={onSave} disabled={!dirty || update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {active === "General" ? (
            detailQ.isLoading ? (
              <div className="sm:col-span-2 space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-2/3" />
              </div>
            ) : detailQ.isError || !current ? (
              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border p-4">
                <p className="text-sm">
                  This location&apos;s settings couldn&apos;t be loaded, so they can&apos;t be
                  edited right now.
                </p>
                <Button size="sm" variant="outline" onClick={() => detailQ.refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-name">Property name</Label>
                  <Input
                    id="loc-name"
                    value={current.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-type">Property type</Label>
                  <Input id="loc-type" value={location.siteType} disabled />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="loc-addr">Address</Label>
                  <Input
                    id="loc-addr"
                    value={current.addressLine1}
                    onChange={(e) => setField("addressLine1", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-city">City</Label>
                  <Input
                    id="loc-city"
                    value={current.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-state">State / province</Label>
                  <Input
                    id="loc-state"
                    value={current.stateProvince}
                    onChange={(e) => setField("stateProvince", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-postal">Postal code</Label>
                  <Input
                    id="loc-postal"
                    value={current.postalCode}
                    onChange={(e) => setField("postalCode", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-country">Country</Label>
                  <Input
                    id="loc-country"
                    value={current.country}
                    maxLength={2}
                    onChange={(e) => setField("country", e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-tz">Timezone</Label>
                  <Input
                    id="loc-tz"
                    value={current.timezone}
                    onChange={(e) => setField("timezone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-lat">Latitude</Label>
                  <Input
                    id="loc-lat"
                    inputMode="decimal"
                    value={current.latitude}
                    onChange={(e) => setField("latitude", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-lon">Longitude</Label>
                  <Input
                    id="loc-lon"
                    inputMode="decimal"
                    value={current.longitude}
                    onChange={(e) => setField("longitude", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-owner">Owner</Label>
                  <Input id="loc-owner" value={customer.owner.email} disabled />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button variant="destructive" onClick={onDeleteClick}>
                    Delete location
                  </Button>
                </div>
              </>
            )
          ) : (
            <div className="sm:col-span-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <ScrollText className="mx-auto mb-2 h-6 w-6" />
              {active} settings are managed via the workspace defaults. Location-specific overrides
              can be added here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Helpers ---------- */

/** Every General-settings field, held as a string so the inputs stay
 *  controlled while a coordinate is mid-edit (a bare "-" or "28." is not a
 *  number yet). Parsed and validated on save, not on keystroke. */
interface GeneralSettingsForm {
  name: string;
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  timezone: string;
  latitude: string;
  longitude: string;
}

function toGeneralSettingsForm(row: {
  name: string;
  address_line1: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
}): GeneralSettingsForm {
  return {
    name: row.name ?? "",
    addressLine1: row.address_line1 ?? "",
    city: row.city ?? "",
    stateProvince: row.state_province ?? "",
    postalCode: row.postal_code ?? "",
    country: row.country ?? "",
    timezone: row.timezone ?? "",
    latitude: row.latitude === null || row.latitude === undefined ? "" : String(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? "" : String(row.longitude),
  };
}

function isSameGeneralSettings(a: GeneralSettingsForm, b: GeneralSettingsForm): boolean {
  return (Object.keys(a) as (keyof GeneralSettingsForm)[]).every((k) => a[k] === b[k]);
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="grid place-items-center gap-2 p-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
          <RouterIcon className="h-5 w-5 text-muted-foreground" />
        </div>
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
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function ArrowBack() {
  return <ArrowLeft className="mr-1.5 h-4 w-4" />;
}
// keep import used
void ArrowBack;
