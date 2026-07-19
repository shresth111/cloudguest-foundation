import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Gauge,
  Globe,
  MapPin,
  Router,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import type { Location } from "@/types/location";
import { InternetStatusBadge, LocationStatusBadge, SiteTypeBadge, SubscriptionBadge } from "./LocationStatusBadge";
import { cn } from "@/lib/utils";

interface Props {
  location: Location;
  initialTab?: string;
}

const KPIS = (l: Location) => [
  {
    label: "Online Routers",
    value: Math.max(0, l.routerCount - (l.internetStatus === "offline" ? l.routerCount : Math.floor(l.routerCount * 0.15))),
    icon: Router,
    tone: "text-emerald-500 bg-emerald-500/10",
  },
  {
    label: "Offline Routers",
    value: l.internetStatus === "offline" ? l.routerCount : Math.floor(l.routerCount * 0.15),
    icon: Router,
    tone: "text-rose-500 bg-rose-500/10",
  },
  { label: "Connected Guests", value: l.activeGuests.toLocaleString(), icon: Users, tone: "text-indigo-500 bg-indigo-500/10" },
  { label: "Today's Sessions", value: l.todaysSessions.toLocaleString(), icon: Activity, tone: "text-sky-500 bg-sky-500/10" },
  { label: "Internet Status", value: l.internetStatus, icon: Globe, tone: "text-teal-500 bg-teal-500/10", capitalize: true },
  { label: "Avg Bandwidth", value: `${l.bandwidthUsageMbps} Mbps`, icon: Gauge, tone: "text-amber-500 bg-amber-500/10" },
  { label: "Active Alerts", value: l.activeAlerts, icon: AlertTriangle, tone: "text-rose-500 bg-rose-500/10" },
  { label: "Uptime", value: `${l.uptimePct}%`, icon: ShieldCheck, tone: "text-emerald-500 bg-emerald-500/10" },
];

export function LocationDetailTabs({ location, initialTab = "overview" }: Props) {
  const [tab, setTab] = useState(initialTab);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <div className="overflow-x-auto">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
          {[
            ["overview", "Overview"],
            ["routers", "Routers"],
            ["wifi", "WiFi Networks"],
            ["guests", "Guests"],
            ["portal", "Captive Portal"],
            ["monitoring", "Monitoring"],
            ["analytics", "Analytics"],
            ["bandwidth", "Bandwidth"],
            ["billing", "Billing"],
            ["audit", "Audit Logs"],
          ].map(([k, l]) => (
            <TabsTrigger
              key={k}
              value={k}
              className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS(location).map((k) => (
            <Card key={k.label} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${k.tone}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className={cn("text-2xl font-semibold tabular-nums", k.capitalize && "capitalize")}>
                    {k.value}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border-border/70 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Location profile</CardTitle>
              <div className="flex items-center gap-2">
                <SiteTypeBadge type={location.siteType} />
                <LocationStatusBadge status={location.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Organization" value={location.organizationName} icon={Building2} />
              <Field label="Location ID" value={location.id} />
              <Field
                label="Address"
                value={`${location.address}, ${location.city}, ${location.state}, ${location.country} ${location.zipCode}`}
                full
                icon={MapPin}
              />
              <Field label="Timezone" value={location.timezone} />
              <Field label="Coordinates" value={`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`} />
              <Field label="Created" value={new Date(location.createdAt).toLocaleDateString()} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Network</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="ISP" value={location.isp} />
              <Field label="Primary WAN" value={location.primaryWan} />
              <Field label="Secondary WAN" value={location.secondaryWan ?? "—"} />
              <Field label="Public IP" value={location.publicIp} />
              <Field label="DNS" value={location.dns} />
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Internet</span>
                <InternetStatusBadge status={location.internetStatus} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Guest access features</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Feature label="Guest WiFi" enabled={location.guestWifiEnabled} />
            <Feature label="Captive Portal" enabled={location.captivePortalEnabled} />
            <Feature label="Voucher Login" enabled={location.voucherLogin} />
            <Feature label="OTP Login" enabled={location.otpLogin} />
            <Feature label="PMS Integration" enabled={location.pmsIntegration} />
            <Feature label="Social Login" enabled={location.socialLogin} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="routers">
        <RouterListTab location={location} />
      </TabsContent>
      <TabsContent value="wifi">
        <EmptyState icon={Wifi} title="No WiFi networks configured" description="SSIDs, VLANs and bandwidth policies will show up here." />
      </TabsContent>
      <TabsContent value="guests">
        <EmptyState icon={Users} title="No connected guests" description="Active guest sessions will appear here in real time." />
      </TabsContent>
      <TabsContent value="portal">
        <EmptyState icon={Globe} title="Captive portal" description="Customize splash pages, auth methods and legal notices." />
      </TabsContent>
      <TabsContent value="monitoring">
        <EmptyState icon={ShieldCheck} title="Live monitoring" description="Real-time router and WAN health streams will render here." />
      </TabsContent>
      <TabsContent value="analytics">
        <EmptyState icon={BarChart3} title="Analytics coming soon" description="Guest, session and revenue trends will render here." />
      </TabsContent>
      <TabsContent value="bandwidth">
        <EmptyState icon={Gauge} title="Bandwidth insights" description="Per-SSID and per-guest bandwidth breakdown coming soon." />
      </TabsContent>
      <TabsContent value="billing">
        <BillingTab location={location} />
      </TabsContent>
      <TabsContent value="audit">
        <AuditTab location={location} />
      </TabsContent>
    </Tabs>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  full,
}: {
  label: string;
  value: string;
  icon?: typeof Globe;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-sm text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function Feature({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
      <span>{label}</span>
      <Badge
        variant="outline"
        className={
          enabled
            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
            : "border-zinc-500/30 text-zinc-500"
        }
      >
        {enabled ? "Enabled" : "Disabled"}
      </Badge>
    </div>
  );
}

function RouterListTab({ location }: { location: Location }) {
  if (location.routerCount === 0) return <EmptyState icon={Router} title="No routers deployed yet" />;
  const rows = Array.from({ length: Math.min(location.routerCount, 10) }).map((_, i) => ({
    id: `RTR-${location.id.slice(-4)}-${String(100 + i).padStart(3, "0")}`,
    name: `AP-${location.city.slice(0, 3).toUpperCase()}-${100 + i}`,
    model: ["EAP-670", "MX67", "UAP-AC-Pro", "MR46"][i % 4],
    status: i === 0 && location.internetStatus === "offline" ? "offline" : i % 5 === 0 ? "offline" : "online",
  }));
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.id}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.model}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={r.status === "online" ? "border-emerald-500/30 text-emerald-600" : "border-rose-500/30 text-rose-600"}
                >
                  {r.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function BillingTab({ location }: { location: Location }) {
  const invoices = Array.from({ length: 6 }).map((_, i) => ({
    id: `INV-${location.id.slice(-4)}-${String(2024001 + i).slice(-4)}`,
    date: new Date(Date.now() - i * 30 * 86400000).toLocaleDateString(),
    amount: 200 + location.routerCount * 15,
    status: i === 0 ? "pending" : "paid",
  }));
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" /> Recent invoices
        </CardTitle>
        <SubscriptionBadge status={location.subscriptionStatus} />
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.id}</TableCell>
              <TableCell>{i.date}</TableCell>
              <TableCell className="text-right tabular-nums">${i.amount.toLocaleString()}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={i.status === "paid" ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}
                >
                  {i.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function AuditTab({ location }: { location: Location }) {
  const logs = [
    { at: "10 minutes ago", actor: "system", event: `Router AP-${location.city.slice(0, 3).toUpperCase()}-100 rebooted` },
    { at: "2 hours ago", actor: "location_manager", event: "Updated captive portal splash page" },
    { at: "Yesterday", actor: "system", event: `Bandwidth peaked at ${location.bandwidthUsageMbps} Mbps` },
    { at: "3 days ago", actor: "org_admin", event: "Enabled OTP login" },
    { at: "Last week", actor: "super_admin", event: `Site added to ${location.organizationName}` },
  ];
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" /> Audit log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-sm">{l.event}</div>
              <div className="text-xs text-muted-foreground">
                by {l.actor} · {l.at}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
