/**
 * Customer-dashboard feature views redesigned from the legacy BhaiFi
 * Cloud App screens (Business Hours, Hotspot Settings, Debugging Tools,
 * RaaS, MAC Auth, Port Forwarding, DHCP, VLANs, VOIP, ISP Routing/Details,
 * Notifications, Top Up, Alerts, Admin Logs). All token-driven so they
 * pick up the Aurora Teal identity automatically. Mock data only -- these
 * are the seam a per-location backend call replaces.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Bug, CheckCircle2, Clock, Download, Gauge, Globe,
  Network, Plus, RadioTower, Router, Shield, Signal, Terminal, Ticket, Trash2,
  Wifi, XCircle, Bell, Server, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatCard, type StatTone } from "@/components/ui-ext/StatCard";
import NetworkCrudTable, { validators } from "@/components/features/NetworkCrudTable";
import { cn } from "@/lib/utils";

/* ---------- shared building blocks ---------- */

function FeatureHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  defaultOn = false,
}: {
  label: string;
  hint?: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  online: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  enabled: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  degraded: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  pending: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  disabled: "text-muted-foreground bg-muted",
  offline: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
  blocked: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "text-muted-foreground bg-muted",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function KpiRow({ items }: { items: { label: string; value: string; tone?: StatTone; icon?: React.ComponentType<{ className?: string }> }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((k) => (
        <StatCard key={k.label} label={k.label} value={k.value} tone={k.tone} icon={k.icon} />
      ))}
    </div>
  );
}

/* ---------- Alerts ---------- */
export function AlertsView() {
  const alerts = [
    { sev: "error", title: "Bandwidth threshold exceeded", src: "GW-02 · Marathahalli", t: "4 min ago" },
    { sev: "warning", title: "Signal degradation detected", src: "AP-14 · Lobby", t: "22 min ago" },
    { sev: "success", title: "ISP failover completed", src: "System", t: "1 hour ago" },
    { sev: "info", title: "Firmware update available", src: "Router fleet", t: "3 hours ago" },
    { sev: "warning", title: "OTP delivery delayed", src: "Telecom gateway", t: "5 hours ago" },
  ];
  const icon = (s: string) =>
    s === "error" ? <XCircle className="h-4 w-4 text-rose-500" />
    : s === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-500" />
    : s === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : <Activity className="h-4 w-4 text-sky-500" />;
  return (
    <div className="space-y-6">
      <FeatureHeader title="Alerts" description="Live operational alerts across routers, ISPs and the captive portal." action={<Button variant="outline" size="sm">Mark all read</Button>} />
      <KpiRow items={[
        { label: "Active", value: "5", tone: "danger", icon: AlertTriangle },
        { label: "Warnings", value: "2", tone: "warning", icon: AlertTriangle },
        { label: "Resolved 24h", value: "18", tone: "success", icon: CheckCircle2 },
        { label: "Uptime", value: "99.97%", tone: "primary", icon: Activity },
      ]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Recent alerts</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {alerts.map((a) => (
            <div key={a.title} className="flex items-start gap-3 px-6 py-3.5">
              <span className="mt-0.5 shrink-0">{icon(a.sev)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.src}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.t}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Business Hours ---------- */
export function BusinessHoursView() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return (
    <div className="space-y-6">
      <FeatureHeader title="Business Hours" description="Set operational timings to minimize unauthorized access outside working hours." action={<Button size="sm" onClick={() => toast.success("Business hours applied")}>Apply</Button>} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly schedule</CardTitle>
          <CardDescription>Toggle a day open/closed and set opening &amp; closing times.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {days.map((d, i) => (
            <div key={d} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <span className="w-24 text-sm font-medium">{d}</span>
              <Switch defaultChecked={i < 6} />
              <span className="text-xs text-muted-foreground">Open</span>
              <div className="ml-auto flex items-center gap-2">
                <Input type="time" defaultValue="00:00" className="h-9 w-32" />
                <span className="text-muted-foreground">—</span>
                <Input type="time" defaultValue="23:59" className="h-9 w-32" />
                <Button variant="outline" size="sm">All day</Button>
              </div>
            </div>
          ))}
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Switch className="scale-90" /> Make these strict business hours (auto-logout users outside the set window)
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Notification ---------- */
export function NotificationView() {
  return (
    <div className="space-y-6">
      <FeatureHeader title="Notifications" description="Choose how and when your team is notified about network events." action={<Button size="sm" onClick={() => toast.success("Preferences saved")}>Save</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Channels</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            <ToggleRow label="Email" hint="admin@company.com" defaultOn />
            <ToggleRow label="SMS" hint="+91 •••• •• 4210" />
            <ToggleRow label="WhatsApp" hint="Business number" defaultOn />
            <ToggleRow label="Webhook" hint="POST to your endpoint" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Events</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            <ToggleRow label="Router offline" defaultOn />
            <ToggleRow label="ISP failover" defaultOn />
            <ToggleRow label="Bandwidth threshold" defaultOn />
            <ToggleRow label="New guest sign-up" />
            <ToggleRow label="Voucher low balance" defaultOn />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Top Up Data ---------- */
export function TopUpView() {
  const packs = [
    { d: "5 GB", p: "₹99", v: "7 days" },
    { d: "20 GB", p: "₹299", v: "30 days" },
    { d: "50 GB", p: "₹599", v: "30 days" },
    { d: "Unlimited", p: "₹999", v: "30 days" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader title="Top Up Data" description="Recharge data balance for a business unit or an individual guest." />
      <KpiRow items={[
        { label: "Balance", value: "128 GB", tone: "primary", icon: Gauge },
        { label: "Used (month)", value: "412 GB", tone: "info", icon: Activity },
        { label: "Active packs", value: "6", tone: "success", icon: Ticket },
      ]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {packs.map((p) => (
          <Card key={p.d} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <p className="text-lg font-semibold">{p.d}</p>
              <p className="text-xs text-muted-foreground">valid {p.v}</p>
              <p className="mt-3 text-2xl font-bold text-primary">{p.p}</p>
              <Button size="sm" className="mt-3 w-full" onClick={() => toast.success(`${p.d} pack added`)}>Top up</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- ISP Details ---------- */
export function IspDetailsView() {
  const isps = [
    { name: "Tata Communications", plan: "1 Gbps Leased", ip: "103.21.44.2", status: "active", role: "Primary" },
    { name: "Airtel", plan: "500 Mbps FTTH", ip: "122.15.8.90", status: "active", role: "Failover" },
    { name: "Jio", plan: "300 Mbps", ip: "49.36.12.7", status: "degraded", role: "Backup" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader title="ISP Details" description="Uplinks configured for this location, with roles and live status." action={<Button size="sm"><Plus className="h-4 w-4" /> Add ISP</Button>} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead><TableHead>Plan</TableHead>
                <TableHead>Public IP</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isps.map((i) => (
                <TableRow key={i.name}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.plan}</TableCell>
                  <TableCell className="font-mono text-xs">{i.ip}</TableCell>
                  <TableCell><Badge variant="outline">{i.role}</Badge></TableCell>
                  <TableCell><StatusPill status={i.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Admin Logs ---------- */
export function AdminLogsView() {
  const logs = [
    { who: "hasnan@company.com", action: "Updated hotspot settings", ip: "10.0.1.4", t: "2 min ago" },
    { who: "reception", action: "Generated 50 vouchers", ip: "10.0.1.22", t: "26 min ago" },
    { who: "manager", action: "Changed bandwidth policy", ip: "10.0.2.9", t: "1 hour ago" },
    { who: "system", action: "ISP failover to Airtel", ip: "—", t: "3 hours ago" },
    { who: "admin", action: "Added agent 'front-desk'", ip: "10.0.1.4", t: "6 hours ago" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader title="Admin Logs" description="Every administrative action taken on this location." action={<Button variant="outline" size="sm"><Download className="h-4 w-4" /> Export</Button>} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Admin</TableHead><TableHead>Action</TableHead><TableHead>IP</TableHead><TableHead>When</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{l.who}</TableCell>
                  <TableCell className="text-sm">{l.action}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.ip}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.t}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- MAC Authorization ---------- */
export function MacAuthView() {
  return (
    <NetworkCrudTable
      title="MAC Authorization"
      description="Bypass hotspot authentication on a few devices."
      tableTitle="Connected Devices"
      tableSubtitle="This lists out all the active devices connected to the Network."
      columns={[
        { key: "mobile", label: "Mobile No." },
        { key: "hostname", label: "Hostname" },
        { key: "mac", label: "MAC" },
        { key: "ip", label: "IP" },
        { key: "status", label: "Status" },
        { key: "bypassed", label: "Bypassed" },
        { key: "comments", label: "Comments" },
      ]}
      seed={[
        { mobile: "XXXXXXX98647", hostname: "TF-260223175821", mac: "7C:70:DB:B5:76:92", ip: "172.16.18.22", status: "Not Static", bypassed: "Not Bypassed", comments: "N/A" },
        { mobile: "XXXXXXX89195", hostname: "M2012K11AI", mac: "9E:CB:12:2C:02:52", ip: "172.16.19.252", status: "Not Static", bypassed: "Not Bypassed", comments: "N/A" },
        { mobile: "XXXXXXX86534", hostname: "CMF-by-Nothing-Phone-1", mac: "C2:7C:20:00:F2:24", ip: "172.16.19.221", status: "Not Static", bypassed: "Not Bypassed", comments: "N/A" },
      ]}
      fields={[
        { key: "ip", label: "Free IP Address", type: "text", placeholder: "10.0.1.50", validate: validators.requiredIp },
        { key: "mac", label: "MAC Address", type: "text", placeholder: "AA:BB:CC:DD:EE:FF", validate: validators.required("MAC address") },
        { key: "deviceType", label: "Device Type", type: "select", options: ["Phone", "Laptop", "Tablet", "IoT", "Printer"], validate: validators.required("device type") },
        { key: "floor", label: "Floor", type: "select", options: ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor"], validate: validators.required("floor") },
        { key: "deviceName", label: "Device Name", type: "text", placeholder: "Reception iPad", validate: validators.required("device name") },
        { key: "monitor", label: "Monitor", type: "switch", helper: "Monitor Device" },
      ]}
      addLabel="Add Static"
    />
  );
}

/* ---------- Port Forwarding ---------- */
export function PortForwardingView() {
  return (
    <NetworkCrudTable
      title="Port Forwarding"
      description="Port forwarding (sometimes called PAT — Port Address Translation)."
      tableTitle="Port Forwarded Devices"
      tableSubtitle="This lists out all the active Port Forwarded devices on the Network."
      columns={[
        { key: "dstAddress", label: "Dst. Address" },
        { key: "toAddress", label: "To Address" },
        { key: "dstPort", label: "Dst. Port" },
        { key: "toPort", label: "To Port" },
        { key: "comment", label: "Comment" },
        { key: "protocol", label: "Protocol" },
        { key: "status", label: "Status" },
      ]}
      seed={[]}
      fields={[
        { key: "dstAddress", label: "Dst. Address", type: "text", placeholder: "10.0.1.1", validate: validators.requiredIp },
        { key: "dstPort", label: "Dst. Port", type: "text", placeholder: "8080", validate: validators.requiredPort },
        { key: "protocol", label: "Protocol Type", type: "select", options: ["TCP", "UDP", "TCP/UDP"], validate: validators.required("protocol") },
        { key: "comment", label: "Comment", type: "text", placeholder: "CCTV NVR", validate: validators.required("comment") },
        { key: "toAddress", label: "To Address", type: "text", placeholder: "10.0.1.50", validate: validators.requiredIp },
        { key: "toPort", label: "To Port", type: "text", placeholder: "80", validate: validators.requiredPort },
        { key: "bypass", label: "Bypass", type: "switch", helper: "Bypass Device" },
      ]}
      addLabel="Add Port Forwarding"
    />
  );
}

/* ---------- DHCP Pool ---------- */
export function DhcpView() {
  return (
    <NetworkCrudTable
      title="DHCP Pool"
      description="Address pools handed out to devices per VLAN, with lease times."
      caution="These are advanced settings — please be sure you know what you're doing here and its impact on the network connectivity of your users."
      tableTitle="Current DHCP Pools"
      columns={[
        { key: "cidr", label: "CIDR" },
        { key: "dhcp", label: "DHCP" },
        { key: "range", label: "Range" },
        { key: "interface", label: "Interface" },
      ]}
      seed={[
        { cidr: "172.16.40.1/24", dhcp: "dhcp_pool2", range: "172.16.40.2-172.16.40.254", interface: "IOT_Devices" },
        { cidr: "172.16.30.1/24", dhcp: "Hosteller_Staff", range: "172.16.30.2-172.16.30.254", interface: "Hosteller_Staff" },
        { cidr: "172.16.20.1/21", dhcp: "default-dhcp", range: "172.16.16.2-172.16.23.249", interface: "ZIPWiFi-LAN" },
      ]}
      fields={[
        { key: "dhcp", label: "Pool Name", type: "text", placeholder: "dhcp_pool2", validate: validators.required("pool name") },
        { key: "interface", label: "Interface Name", type: "text", placeholder: "IOT_Devices", validate: validators.required("interface name") },
        { key: "network", label: "Network", type: "text", placeholder: "172.16.40.1", validate: validators.requiredIp },
        { key: "subnet", label: "Subnet Mask", type: "select", options: ["/21", "/22", "/23", "/24", "/25"], validate: validators.required("subnet mask") },
      ]}
      addLabel="Add DHCP Pool"
    />
  );
}

/* ---------- VLANs ---------- */
export function VlansView() {
  return (
    <NetworkCrudTable
      title="Manage VLANs"
      description="Segment the network to isolate guest, staff and IoT traffic."
      caution="These are advanced settings — please be sure you know what you're doing here and its impact on the network connectivity of your users."
      tableTitle="Current VLANs"
      tableSubtitle="This lists out all the VLANs setup on the Network."
      columns={[
        { key: "addressSubnet", label: "Address/Subnet" },
        { key: "gateway", label: "Gateway" },
        { key: "vlanName", label: "Vlan-Name" },
        { key: "vlanId", label: "VlanId" },
      ]}
      seed={[
        { addressSubnet: "172.16.40.1/24", gateway: "172.16.40.0", vlanName: "IOT_Devices", vlanId: "30" },
        { addressSubnet: "172.16.30.1/24", gateway: "172.16.30.0", vlanName: "Hosteller_Staff", vlanId: "20" },
      ]}
      fields={[
        { key: "gateway", label: "Gateway", type: "text", placeholder: "172.16.40.0", validate: validators.requiredIp },
        { key: "subnet", label: "Subnet Mask", type: "select", options: ["/21", "/22", "/23", "/24", "/25"], validate: validators.required("subnet mask") },
        { key: "vlanId", label: "VLAN ID", type: "text", placeholder: "30", validate: validators.required("VLAN ID") },
        { key: "hotspot", label: "Hotspot", type: "select", options: ["Guest WiFi", "Staff WiFi", "IoT Network"], validate: validators.required("hotspot") },
        { key: "vlanName", label: "VLAN Name", type: "text", placeholder: "IOT_Devices", validate: validators.required("VLAN name") },
        { key: "portType", label: "Port Type", type: "select", options: ["Access", "Trunk"], validate: validators.required("port type") },
      ]}
      addLabel="Add VLAN"
    />
  );
}

/* ---------- VOIP Priority ---------- */
export function VoipView() {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">VOIP Priority</h1>
        <p className="mt-1 text-sm text-muted-foreground">Caution: these are advanced settings — please be sure you know what you're doing here and its impact on the network connectivity of your users.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">VOIP Priority</CardTitle><CardDescription>Traffic shaping rules for voice. Enabling this will apply QoS for voice and will prioritize the voice data packets.</CardDescription></CardHeader>
        <CardContent>
          <label className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); toast.success(v ? "VOIP Priority enabled" : "VOIP Priority disabled"); }} />
            <span className="text-sm font-medium">Enable / Disable VOIP Priority</span>
          </label>
        </CardContent>
      </Card>
      <KpiRow items={[
        { label: "Active calls", value: "12", tone: "primary", icon: Signal },
        { label: "Jitter", value: "8 ms", tone: "success", icon: Activity },
        { label: "Packet loss", value: "0.1%", tone: "success", icon: Gauge },
        { label: "Reserved BW", value: "20%", tone: "info", icon: Gauge },
      ]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Prioritization rules</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          <ToggleRow label="Prioritize SIP (5060/5061)" hint="Mark DSCP EF for signalling" defaultOn />
          <ToggleRow label="Prioritize RTP media" hint="Voice payload fast-lane" defaultOn />
          <ToggleRow label="Throttle bulk downloads during calls" />
          <div className="flex items-center gap-3 pt-1">
            <Label className="text-sm">Reserved bandwidth for voice</Label>
            <Select defaultValue="20">
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{["10", "20", "30", "40"].map((n) => <SelectItem key={n} value={n}>{n}%</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- ISP Routing ---------- */
export function IspRoutingView() {
  const ISPS = ["Airtel", "Tata Communications", "Jio", "ACT Fibernet", "BSNL"];
  const [mode, setMode] = useState<"vlan" | "ip">("ip");
  const [ip, setIp] = useState(""); const [isp, setIsp] = useState("");
  const [routes, setRoutes] = useState<{ ip: string; isp: string; enabled: boolean }[]>([]);
  const [err, setErr] = useState("");

  const addRoute = () => {
    if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { setErr("Enter IP Address"); return; }
    if (!isp) { setErr("Select an ISP"); return; }
    setErr("");
    setRoutes((r) => [{ ip, isp, enabled: true }, ...r]);
    setIp(""); setIsp("");
    toast.success("Route added");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ISP Routing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Route individual VLAN or user's traffic to a different ISP.</p>
      </div>

      <div className="inline-flex rounded-xl border bg-muted/40 p-1">
        {(["vlan", "ip"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {m === "vlan" ? "Route VLAN" : "Route IP Address"}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label className="mb-1.5 block text-sm">{mode === "ip" ? "IP Address" : "VLAN"} *</Label>
              <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder={mode === "ip" ? "Enter IP Address" : "Choose VLAN"} className="h-9" />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">ISPs *</Label>
              <Select value={isp} onValueChange={setIsp}><SelectTrigger className="h-9"><SelectValue placeholder="Choose ISP" /></SelectTrigger><SelectContent>{ISPS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button className="h-9 self-end" onClick={addRoute}><Plus className="h-4 w-4" /> Add Route</Button>
          </div>
          {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Current IP Address ISP Routing</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>IP Address</TableHead><TableHead>ISP Name</TableHead><TableHead>Action</TableHead><TableHead>Enable/Disable Routing</TableHead></TableRow></TableHeader>
            <TableBody>
              {routes.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No data available in table</TableCell></TableRow>
              ) : routes.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.ip}</TableCell>
                  <TableCell className="font-medium"><span className="inline-flex items-center gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5 text-primary" />{r.isp}</span></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setRoutes((rt) => rt.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  <TableCell><Switch checked={r.enabled} onCheckedChange={(v) => setRoutes((rt) => rt.map((x, j) => j === i ? { ...x, enabled: v } : x))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Debugging Tools ---------- */
export function DebuggingView() {
  const [logs] = useState<string[]>([]);
  return (
    <div className="space-y-6">
      <FeatureHeader title="Debugging Tools" description="Trouble connecting or opening a site? Debug it right here." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-primary" /> DNS Lookup</CardTitle>
            <CardDescription>Check if a website resolves on any ISP.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Domain name" className="h-9" />
            <div className="flex gap-2">
              <Select defaultValue="google"><SelectTrigger className="h-9"><SelectValue placeholder="DNS server" /></SelectTrigger><SelectContent><SelectItem value="google">Google 8.8.8.8</SelectItem><SelectItem value="cf">Cloudflare 1.1.1.1</SelectItem></SelectContent></Select>
              <Button size="sm" onClick={() => toast.success("Lookup started")}>Test</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><RadioTower className="h-4 w-4 text-primary" /> Reset User Session</CardTitle>
            <CardDescription>Force a guest back to the login page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="User IP address" className="h-9 font-mono" />
            <Button size="sm" variant="outline" onClick={() => toast.success("Session reset")}>Reset session</Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4 text-primary" /> Controller Logs</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56 overflow-auto rounded-xl border bg-[oklch(0.16_0.02_236)] p-4 font-mono text-xs text-emerald-300/90">
            {logs.length === 0 ? <span className="text-white/40">No logs to display… streaming live.</span> : logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Hotspot Settings ---------- */
export function HotspotView() {
  return (
    <div className="space-y-6">
      <FeatureHeader title="Hotspot Settings" description="Enable or disable per-hotspot capabilities for this location." action={<Button size="sm" onClick={() => toast.success("Settings applied")}>Apply settings</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ToggleRow label="Auto Login" hint="Skip portal for known devices" defaultOn />
        <ToggleRow label="Login via OTP" hint="One-time password over SMS" defaultOn />
        <ToggleRow label="Group Policy" hint="Apply shared team limits" />
        <ToggleRow label="Name Collect" hint="Ask guest for name" defaultOn />
        <ToggleRow label="Email Collect" hint="Ask guest for email" defaultOn />
        <ToggleRow label="Official Email Collect" hint="Require work email" />
        <ToggleRow label="Team Name Collect" hint="Ask for team / company" />
      </div>
    </div>
  );
}

/* ---------- RaaS: Dashboard ---------- */
export function RaasDashboardView() {
  return (
    <div className="space-y-6">
      <FeatureHeader title="RaaS Dashboard" description="Reporting-as-a-Service overview across your managed business units." action={
        <Select defaultValue="all"><SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All spaces</SelectItem><SelectItem value="hostel">The Hosteller</SelectItem></SelectContent></Select>
      } />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-[image:var(--gradient-primary)] p-5 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-2 text-sm/none opacity-90"><Server className="h-4 w-4" /> Total Users</div>
          <p className="mt-2 text-3xl font-bold">3,241</p>
        </div>
        <div className="rounded-2xl bg-[image:var(--gradient-accent)] p-5 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-2 text-sm/none opacity-90"><Wifi className="h-4 w-4" /> Total Active Users</div>
          <p className="mt-2 text-3xl font-bold">1,188</p>
        </div>
      </div>
      <KpiRow items={[
        { label: "Data consumed", value: "4.2 TB", tone: "info", icon: Gauge },
        { label: "Avg session", value: "34 min", tone: "primary", icon: Clock },
        { label: "New users (7d)", value: "612", tone: "success", icon: Activity },
        { label: "Online now", value: "142", tone: "primary", icon: Signal },
      ]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Location overview</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Business unit</TableHead><TableHead>Plan expiry</TableHead><TableHead>Online users</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { n: "The Hosteller Marathahalli", e: "31 Dec 2026", o: "48" },
                { n: "Hosteller Staff · Marathahalli", e: "31 Dec 2026", o: "9" },
                { n: "The Hosteller Indira Nagar", e: "15 Jan 2027", o: "22" },
              ].map((r) => (
                <TableRow key={r.n}><TableCell className="font-medium">{r.n}</TableCell><TableCell className="text-sm text-muted-foreground">{r.e}</TableCell><TableCell><Badge variant="secondary">{r.o}</Badge></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- RaaS: Manage Users ---------- */
export function RaasUsersView() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-6">
      <FeatureHeader title="RaaS · Manage Users" description="Add single or bulk users for a business unit and review current users." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Add single user</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="h-9" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-9" /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input placeholder="+91 •••••" className="h-9" /></div>
            <Button size="sm" onClick={() => { toast.success("User created"); setName(""); setEmail(""); }}>Create user</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add bulk users</CardTitle>
            <CardDescription>Upload a CSV (max ~200 records) using the template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
              <Download className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop CSV here or browse</p>
            </div>
            <div className="flex gap-2"><Button size="sm" variant="outline">Download template</Button><Button size="sm" onClick={() => toast.success("Users uploaded")}>Upload</Button></div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Current users</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { n: "Aarav Mehta", e: "aarav@stay.com", c: "12 Jul 2026", s: "active" },
                { n: "Diya Nair", e: "diya@stay.com", c: "10 Jul 2026", s: "active" },
                { n: "Kabir Rao", e: "kabir@stay.com", c: "02 Jul 2026", s: "disabled" },
              ].map((u) => (
                <TableRow key={u.e}><TableCell className="font-medium">{u.n}</TableCell><TableCell className="text-sm text-muted-foreground">{u.e}</TableCell><TableCell className="text-xs text-muted-foreground">{u.c}</TableCell><TableCell><StatusPill status={u.s} /></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- RaaS: Reports ---------- */
export function RaasReportsView() {
  const reports = [
    { n: "User Report", d: "Sign-ups and activity per business unit" },
    { n: "Voucher Report", d: "Issued, redeemed and expired vouchers" },
    { n: "Campaign Report", d: "Reach and conversions per campaign" },
    { n: "Data Report", d: "Consumption and charges by rate/GB" },
    { n: "OTP SMS Report", d: "Delivery success and latency" },
  ];
  return (
    <div className="space-y-6">
      <FeatureHeader title="RaaS · Reports" description="Generate cross-business-unit reports in different formats." action={
        <Select defaultValue="all"><SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All report types</SelectItem></SelectContent></Select>
      } />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.n} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <p className="font-semibold">{r.n}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.d}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toast.success(`${r.n} · PDF`)}>PDF</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toast.success(`${r.n} · CSV`)}>CSV</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- fallback for any not-yet-built feature ---------- */
export function GenericFeatureView({ feature }: { feature: string }) {
  const label = feature.replace(/-/g, " ");
  return (
    <div className="space-y-6">
      <FeatureHeader title={label.replace(/\b\w/g, (c) => c.toUpperCase())} description="This module is provisioned for your location." />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Network className="h-6 w-6" /></span>
          <p className="text-sm text-muted-foreground">Configuration for <span className="font-medium text-foreground capitalize">{label}</span> will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
