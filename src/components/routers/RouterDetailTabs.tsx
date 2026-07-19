import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cpu,
  Database,
  Download,
  FileText,
  Gauge,
  HardDrive,
  Loader2,
  MemoryStick,
  Network,
  Power,
  RefreshCw,
  RotateCw,
  Router as RouterIcon,
  ShieldCheck,
  Signal,
  Thermometer,
  Timer,
  Trash2,
  UploadCloud,
  Users,
  Wifi,
} from "lucide-react";
import {
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import type { RouterDevice } from "@/types/router";
import { RouterStatusBadge, ServiceStatusBadge, TunnelStatusBadge } from "./RouterStatusBadge";
import { useConnectedDevices, useRouterAlerts, useUpgradeRouters, useWireGuardPeers } from "@/hooks/useRouters";
import { cn } from "@/lib/utils";

interface Props {
  router: RouterDevice;
  initialTab?: string;
}

const KPIS = (r: RouterDevice) => [
  { label: "Router health", value: r.status === "online" ? "Healthy" : "Attention", icon: ShieldCheck, tone: r.status === "online" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10" },
  { label: "CPU usage", value: `${r.cpuPct}%`, icon: Cpu, tone: "text-sky-500 bg-sky-500/10" },
  { label: "Memory usage", value: `${r.ramPct}%`, icon: MemoryStick, tone: "text-indigo-500 bg-indigo-500/10" },
  { label: "Storage usage", value: `${r.storagePct}%`, icon: HardDrive, tone: "text-violet-500 bg-violet-500/10" },
  { label: "Internet", value: r.internetStatus, icon: Network, tone: "text-teal-500 bg-teal-500/10", capitalize: true },
  { label: "Active guests", value: r.activeGuests.toLocaleString(), icon: Users, tone: "text-emerald-500 bg-emerald-500/10" },
  { label: "Active sessions", value: r.activeSessions.toLocaleString(), icon: Activity, tone: "text-fuchsia-500 bg-fuchsia-500/10" },
  { label: "Uptime", value: r.uptimeHours ? `${Math.floor(r.uptimeHours / 24)}d ${r.uptimeHours % 24}h` : "—", icon: Timer, tone: "text-amber-500 bg-amber-500/10" },
  { label: "Temperature", value: r.temperatureC ? `${r.temperatureC}°C` : "—", icon: Thermometer, tone: "text-orange-500 bg-orange-500/10" },
  { label: "Packet loss", value: `${r.packetLossPct}%`, icon: Signal, tone: "text-rose-500 bg-rose-500/10" },
  { label: "Latency", value: r.latencyMs ? `${r.latencyMs} ms` : "—", icon: Gauge, tone: "text-cyan-500 bg-cyan-500/10" },
];

export function RouterDetailTabs({ router, initialTab = "overview" }: Props) {
  const [tab, setTab] = useState(initialTab);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <div className="overflow-x-auto">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
          {[
            ["overview", "Overview"],
            ["interfaces", "Interfaces"],
            ["wireguard", "WireGuard"],
            ["radius", "FreeRADIUS"],
            ["wifi", "Guest WiFi"],
            ["devices", "Connected Devices"],
            ["monitoring", "Monitoring"],
            ["analytics", "Analytics"],
            ["logs", "Logs"],
            ["config", "Configuration"],
            ["firmware", "Firmware"],
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
          {KPIS(router).map((k) => (
            <Card key={k.label} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl", k.tone)}>
                  <k.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className={cn("text-lg font-semibold", k.capitalize && "capitalize")}>{k.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl border-border/70 lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Device information</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <Field label="Router ID" value={router.id} />
                <Field label="MikroTik identity" value={router.mikrotikIdentity} />
                <Field label="NAS ID" value={router.nasId} />
                <Field label="Serial number" value={router.serialNumber} />
                <Field label="Model" value={router.model} />
                <Field label="RouterOS" value={`${router.routerOsVersion} (latest ${router.latestOsVersion})`} />
                <Field label="Organization" value={router.organizationName} />
                <Field label="Location" value={router.locationName} />
                <Field label="Public IP" value={router.publicIp} />
                <Field label="Private IP" value={router.privateIp} />
                <Field label="Gateway" value={router.gateway} />
                <Field label="DNS" value={router.dns} />
                <Field label="Timezone" value={router.timezone} />
                <Field label="Last seen" value={new Date(router.lastSeen).toLocaleString()} />
              </dl>
            </CardContent>
          </Card>
          <AlertsCard routerId={router.id} />
        </div>
      </TabsContent>

      <TabsContent value="interfaces">
        <InterfacesTab />
      </TabsContent>
      <TabsContent value="wireguard">
        <WireGuardTab router={router} />
      </TabsContent>
      <TabsContent value="radius">
        <RadiusTab router={router} />
      </TabsContent>
      <TabsContent value="wifi">
        <PlaceholderTab icon={Wifi} title="Guest WiFi SSIDs" description="SSIDs, VLANs and captive portal bindings served by this router." />
      </TabsContent>
      <TabsContent value="devices">
        <ConnectedDevicesTab routerId={router.id} />
      </TabsContent>
      <TabsContent value="monitoring">
        <MonitoringTab router={router} />
      </TabsContent>
      <TabsContent value="analytics">
        <PlaceholderTab icon={BarChart3} title="Analytics" description="Session, auth and usage breakdowns for this router." />
      </TabsContent>
      <TabsContent value="logs">
        <LogsTab router={router} />
      </TabsContent>
      <TabsContent value="config">
        <ConfigTab />
      </TabsContent>
      <TabsContent value="firmware">
        <FirmwareTab router={router} />
      </TabsContent>
      <TabsContent value="audit">
        <PlaceholderTab icon={FileText} title="Audit logs" description="Configuration changes, admin actions and API calls." />
      </TabsContent>
    </Tabs>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function PlaceholderTab({ icon: Icon, title, description }: { icon: typeof Wifi; title: string; description: string }) {
  return <EmptyState icon={Icon} title={title} description={description} />;
}

function AlertsCard({ routerId }: { routerId: string }) {
  const { data, isLoading, isError, refetch } = useRouterAlerts(routerId);
  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Active alerts</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No active alerts
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-4 w-4",
                    a.severity === "critical" && "text-rose-500",
                    a.severity === "warning" && "text-amber-500",
                    a.severity === "info" && "text-sky-500",
                  )}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.severity} · {new Date(a.raisedAt).toLocaleString()}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">{a.type}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InterfacesTab() {
  const rows = [
    { name: "ether1 (WAN)", type: "ethernet", mac: "AA:BB:CC:00:00:01", rx: "1.2 Gbps", tx: "420 Mbps", up: true },
    { name: "ether2 (LAN)", type: "ethernet", mac: "AA:BB:CC:00:00:02", rx: "820 Mbps", tx: "310 Mbps", up: true },
    { name: "wlan1 (2.4GHz)", type: "wireless", mac: "AA:BB:CC:00:00:03", rx: "45 Mbps", tx: "22 Mbps", up: true },
    { name: "wlan2 (5GHz)", type: "wireless", mac: "AA:BB:CC:00:00:04", rx: "310 Mbps", tx: "180 Mbps", up: true },
    { name: "wg0 (WireGuard)", type: "tunnel", mac: "—", rx: "6 Mbps", tx: "3 Mbps", up: true },
  ];
  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Interface</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>MAC</TableHead>
              <TableHead>RX</TableHead>
              <TableHead>TX</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                <TableCell className="text-xs tabular-nums">{r.mac}</TableCell>
                <TableCell className="tabular-nums">{r.rx}</TableCell>
                <TableCell className="tabular-nums">{r.tx}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={r.up ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"}>
                    {r.up ? "Up" : "Down"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WireGuardTab({ router }: { router: RouterDevice }) {
  const { data, isLoading, isError, refetch } = useWireGuardPeers(router.id);
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Tunnel status</CardTitle>
            <p className="text-sm text-muted-foreground">Management tunnel connecting this router to the CloudGuest control plane.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.success("Tunnel connect requested")}>Connect</Button>
            <Button variant="outline" size="sm" onClick={() => toast.success("Tunnel disconnected")}>Disconnect</Button>
            <Button size="sm" onClick={() => toast.success("Tunnel restarted")}>
              <RotateCw className="h-4 w-4" /><span className="ml-2">Restart</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <TunnelStatusBadge status={router.wireguardStatus} />
            <div className="text-sm text-muted-foreground">Endpoint <span className="text-foreground">vpn.cloudguest.io:51820</span></div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader><CardTitle className="text-base">Peers</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><LoadingSkeleton rows={3} /></div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !data?.length ? (
            <EmptyState title="No peers configured" description="Add a peer to route traffic through this tunnel." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peer</TableHead>
                  <TableHead>Public key</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Allowed IPs</TableHead>
                  <TableHead>Last handshake</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">{p.publicKey}</TableCell>
                    <TableCell className="text-xs">{p.endpoint}</TableCell>
                    <TableCell className="text-xs">{p.allowedIps}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.lastHandshake).toLocaleTimeString()}</TableCell>
                    <TableCell><TunnelStatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RadiusTab({ router }: { router: RouterDevice }) {
  const cards = [
    { label: "Authentication", value: router.radiusStatus === "running" ? "Healthy" : "Failing" },
    { label: "Accounting", value: router.radiusStatus === "running" ? "Healthy" : "Stopped" },
    { label: "Session count", value: router.activeSessions.toLocaleString() },
    { label: "Last authentication", value: new Date(Date.now() - 60000).toLocaleTimeString() },
    { label: "Last accounting update", value: new Date(Date.now() - 12000).toLocaleTimeString() },
    { label: "NAS ID", value: router.nasId },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label} className="rounded-2xl border-border/70">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-lg font-semibold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
      <Card className="rounded-2xl border-border/70 sm:col-span-2 lg:col-span-3">
        <CardHeader><CardTitle className="text-base">Service status</CardTitle></CardHeader>
        <CardContent><ServiceStatusBadge status={router.radiusStatus} /></CardContent>
      </Card>
    </div>
  );
}

function ConnectedDevicesTab({ routerId }: { routerId: string }) {
  const { data, isLoading, isError, refetch } = useConnectedDevices(routerId);
  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Connected devices</CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /><span className="ml-2">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={5} /></div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data?.length ? (
          <EmptyState icon={Users} title="No devices connected" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>MAC</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Connected since</TableHead>
                <TableHead className="text-right">Download</TableHead>
                <TableHead className="text-right">Upload</TableHead>
                <TableHead className="text-right">RSSI</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm">{d.guestName}</TableCell>
                  <TableCell className="text-xs font-mono">{d.mac}</TableCell>
                  <TableCell className="text-xs font-mono">{d.ip}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(d.connectedSince).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.downloadMb} MB</TableCell>
                  <TableCell className="text-right tabular-nums">{d.uploadMb} MB</TableCell>
                  <TableCell className="text-right tabular-nums">{d.rssi} dBm</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toast.success(`${d.name} disconnected`)}>
                      Disconnect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

interface Point { t: string; cpu: number; ram: number; bw: number; lat: number; loss: number; temp: number; guests: number; }

function useLiveSeries(router: RouterDevice) {
  const [data, setData] = useState<Point[]>(() => {
    const base: Point[] = [];
    for (let i = 30; i >= 0; i--) {
      base.push({
        t: `-${i}s`,
        cpu: Math.max(1, router.cpuPct + Math.round((Math.random() - 0.5) * 20)),
        ram: Math.max(1, router.ramPct + Math.round((Math.random() - 0.5) * 15)),
        bw: 100 + Math.round(Math.random() * 400),
        lat: Math.max(1, router.latencyMs + Math.round((Math.random() - 0.5) * 20)),
        loss: Math.max(0, router.packetLossPct + Math.round((Math.random() - 0.5) * 10) / 10),
        temp: Math.max(20, router.temperatureC + Math.round((Math.random() - 0.5) * 4)),
        guests: Math.max(0, router.activeGuests + Math.round((Math.random() - 0.5) * 10)),
      });
    }
    return base;
  });
  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const next = prev.slice(1);
        next.push({
          t: "now",
          cpu: Math.max(1, Math.min(100, prev[prev.length - 1].cpu + Math.round((Math.random() - 0.5) * 12))),
          ram: Math.max(1, Math.min(100, prev[prev.length - 1].ram + Math.round((Math.random() - 0.5) * 8))),
          bw: Math.max(20, prev[prev.length - 1].bw + Math.round((Math.random() - 0.5) * 60)),
          lat: Math.max(1, prev[prev.length - 1].lat + Math.round((Math.random() - 0.5) * 10)),
          loss: Math.max(0, Math.min(10, prev[prev.length - 1].loss + Math.round((Math.random() - 0.5) * 8) / 10)),
          temp: Math.max(20, prev[prev.length - 1].temp + Math.round((Math.random() - 0.5) * 2)),
          guests: Math.max(0, prev[prev.length - 1].guests + Math.round((Math.random() - 0.5) * 6)),
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return data;
}

function MonitoringTab({ router }: { router: RouterDevice }) {
  const data = useLiveSeries(router);
  const last = data[data.length - 1];
  const widgets = [
    { title: "CPU", value: `${last.cpu}%`, key: "cpu" as const, color: "hsl(217 91% 60%)" },
    { title: "Memory", value: `${last.ram}%`, key: "ram" as const, color: "hsl(262 83% 62%)" },
    { title: "Bandwidth", value: `${last.bw} Mbps`, key: "bw" as const, color: "hsl(160 84% 39%)" },
    { title: "Latency", value: `${last.lat} ms`, key: "lat" as const, color: "hsl(199 89% 48%)" },
    { title: "Packet loss", value: `${last.loss.toFixed(1)}%`, key: "loss" as const, color: "hsl(0 84% 60%)" },
    { title: "Temperature", value: `${last.temp}°C`, key: "temp" as const, color: "hsl(28 96% 55%)" },
    { title: "Connected guests", value: `${last.guests}`, key: "guests" as const, color: "hsl(280 87% 65%)" },
    { title: "Interface traffic", value: `${last.bw} Mbps`, key: "bw" as const, color: "hsl(190 80% 50%)" },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {widgets.map((w) => (
        <Card key={w.title} className="rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{w.title}</span>
              <span className="text-base font-semibold text-foreground">{w.value}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-32 p-2 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`grad-${w.title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={w.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={w.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey={w.key} stroke={w.color} fill={`url(#grad-${w.title})`} strokeWidth={2} isAnimationActive={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LogsTab({ router }: { router: RouterDevice }) {
  const logs = Array.from({ length: 10 }).map((_, i) => ({
    ts: new Date(Date.now() - i * 60000).toISOString(),
    level: (["info", "warn", "error", "info", "info"] as const)[i % 5],
    msg: [
      `DHCP lease granted 10.0.${i}.${100 + i} to AA:BB:${i.toString(16).padStart(2, "0").toUpperCase()}:CC:DD:EE`,
      `RADIUS auth success user=guest-${1000 + i}`,
      `WireGuard peer handshake ok`,
      `WAN link RTT ${20 + i}ms`,
      `Interface ether${(i % 4) + 1} up`,
    ][i % 5],
  }));
  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="p-0">
        <div className="max-h-[520px] overflow-y-auto font-mono text-xs">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-3 border-b border-border/40 px-4 py-2 last:border-b-0">
              <span className="text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span>
              <span className={cn(
                "uppercase",
                l.level === "info" && "text-sky-500",
                l.level === "warn" && "text-amber-500",
                l.level === "error" && "text-rose-500",
              )}>[{l.level}]</span>
              <span className="text-foreground">{router.mikrotikIdentity}: {l.msg}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl border-border/70">
        <CardHeader><CardTitle className="text-base">Backup & restore</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast.success("Backup created")}>
              <Database className="h-4 w-4" /><span className="ml-2">Backup configuration</span>
            </Button>
            <Button variant="outline" onClick={() => toast.success("Backup downloaded")}>
              <Download className="h-4 w-4" /><span className="ml-2">Download backup</span>
            </Button>
            <Button variant="outline" onClick={() => toast.success("Restore started")}>
              <UploadCloud className="h-4 w-4" /><span className="ml-2">Upload backup</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Backups are retained for 90 days.</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/70">
        <CardHeader><CardTitle className="text-base">Danger zone</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={() => toast.success("Reboot command sent")}>
            <RotateCw className="h-4 w-4" /><span className="ml-2">Reboot router</span>
          </Button>
          <Button variant="outline" onClick={() => toast.success("Shutdown command sent")}>
            <Power className="h-4 w-4" /><span className="ml-2">Shutdown</span>
          </Button>
          <Button variant="destructive" onClick={() => toast.success("Factory reset queued")}>
            <Trash2 className="h-4 w-4" /><span className="ml-2">Factory reset</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FirmwareTab({ router }: { router: RouterDevice }) {
  const upgrade = useUpgradeRouters();
  const available = router.routerOsVersion !== router.latestOsVersion;
  const history = [
    { v: router.latestOsVersion, at: "Latest release", notes: "Security patches, WireGuard perf" },
    { v: "7.13.5", at: "2025-01-14", notes: "IPv6 stability" },
    { v: "7.12.1", at: "2024-11-02", notes: "RADIUS accounting fixes" },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl border-border/70">
        <CardHeader><CardTitle className="text-base">Current firmware</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold tabular-nums">{router.routerOsVersion}</div>
            <div className="text-xs text-muted-foreground">RouterOS</div>
          </div>
          <div className="text-sm">
            Latest available: <span className="font-medium">{router.latestOsVersion}</span>
            {available ? (
              <Badge className="ml-2 bg-amber-500/15 text-amber-600 hover:bg-amber-500/20">Update available</Badge>
            ) : (
              <Badge className="ml-2 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Up to date</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!available || upgrade.isPending}
              onClick={() => upgrade.mutate([router.id], { onSuccess: () => toast.success("Firmware upgrade queued") })}
            >
              {upgrade.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <UploadCloud className="h-4 w-4" /><span className="ml-2">Upgrade firmware</span>
            </Button>
            <Button variant="outline" onClick={() => toast.success("Rollback queued")}>Rollback</Button>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/70">
        <CardHeader><CardTitle className="text-base">Version history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {history.map((h) => (
            <div key={h.v} className="rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{h.v}</div>
                <div className="text-xs text-muted-foreground">{h.at}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{h.notes}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
