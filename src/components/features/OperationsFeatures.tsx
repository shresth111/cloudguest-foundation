/**
 * Customer-dashboard feature views redesigned from the legacy BhaiFi
 * Cloud App screens (Business Hours, Hotspot Settings, Debugging Tools,
 * RaaS, MAC Auth, Port Forwarding, DHCP, VLANs, VOIP, ISP Routing/Details,
 * Notifications, Top Up, Alerts, Admin Logs). All token-driven so they
 * pick up the Aurora Teal identity automatically. Mock data only -- these
 * are the seam a per-location backend call replaces.
 */
import { useEffect, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatCard, type StatTone } from "@/components/ui-ext/StatCard";
import NetworkCrudTable, { validators } from "@/components/features/NetworkCrudTable";
import { useIspStore, type IspConfig, type IspLine } from "@/stores/ispStore";
import { useCustomerFeatureData } from "@/hooks/useCustomerDashboard";
import { isDemo } from "@/services/customer.service";
import { macAuthorizationService } from "@/services/mac-authorization.service";
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
const PROVIDERS = ["Airtel", "Jio", "Tata Communications", "ACT Fibernet", "BSNL", "Skynet Broadband", "Unknown"];
const CONNECTION_TYPES = ["Broadband", "Leased Line", "Fiber", "4G/5G Backup"];
const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];

function emptyLine(wan: string): IspLine {
  return { wan, provider: "", connectionType: "Broadband", bandwidthMbps: 0, thresholdMbps: 0, status: "up", emailAlert: false, smsAlert: false };
}

/* ---------- Network Health analytics (per-business-unit ISP up/down timeline) ---------- */

function seededRand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

type HealthStatus = "up" | "down" | "reboot" | "none";

const HEALTH_COLOR: Record<HealthStatus, string> = {
  up: "bg-emerald-500", down: "bg-rose-500", reboot: "bg-amber-500", none: "bg-muted",
};
const HEALTH_LABEL: Record<HealthStatus, string> = {
  up: "Network Up", down: "Network Down", reboot: "Reboot", none: "No Data",
};

/** Manually driven by the ISP config saved above -- a line currently marked
 * "down" biases today's most recent hours to down so the chart reflects the
 * configuration instead of drifting independently. */
function NetworkHealthChart({ businessUnit, anyLineDown }: { businessUnit: string; anyLineDown: boolean }) {
  const [hover, setHover] = useState<{ day: string; hour: number; status: HealthStatus } | null>(null);

  const { days, uptimePct } = useMemo(() => {
    const seed = Array.from(businessUnit).reduce((a, c) => a + c.charCodeAt(0), 7);
    const rand = seededRand(seed);
    const today = new Date();
    const nowHour = today.getHours();
    const rows: { label: string; hours: HealthStatus[] }[] = [];
    let upCount = 0, totalCount = 0;

    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      const isToday = d === 0;
      const label = isToday ? "Today" : `${String(date.getDate()).padStart(2, "0")} ${date.toLocaleDateString("en-US", { month: "short" })} '${String(date.getFullYear()).slice(2)}`;
      const hours: HealthStatus[] = [];
      for (let h = 0; h < 24; h++) {
        if (isToday && h > nowHour) { hours.push("none"); continue; }
        let status: HealthStatus = "up";
        const r = rand();
        if (isToday && anyLineDown && h >= nowHour - 1) status = "down";
        else if (r < 0.035) status = "down";
        else if (r < 0.045) status = "reboot";
        hours.push(status);
        totalCount++;
        if (status === "up") upCount++;
      }
      rows.push({ label, hours });
    }
    const uptimePct = totalCount ? ((upCount / totalCount) * 100).toFixed(2) : "0.00";
    return { days: rows, uptimePct };
  }, [businessUnit, anyLineDown]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Network Health</CardTitle>
        <CardDescription>This graph shows the network up/down time for each ISP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {days.map((day) => (
              <div key={day.label} className="flex items-center gap-2 py-0.5">
                <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{day.label}</span>
                <div className="flex flex-1 gap-[2px]">
                  {day.hours.map((status, h) => (
                    <div
                      key={h}
                      onMouseEnter={() => setHover({ day: day.label, hour: h, status })}
                      onMouseLeave={() => setHover(null)}
                      className={cn("h-4 flex-1 cursor-pointer rounded-[2px] transition-transform hover:scale-y-125", HEALTH_COLOR[status])}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="ml-[72px] mt-1 flex justify-between text-[10px] text-muted-foreground">
              {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "23:00"].map((t) => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>

        <div className="flex h-6 items-center">
          {hover ? (
            <div className="rounded-lg border bg-popover px-3 py-1 text-xs shadow-sm">
              <span className="font-medium">{hover.day}, {String(hover.hour).padStart(2, "0")}:00</span>
              <span className="text-muted-foreground"> — {HEALTH_LABEL[hover.status]}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Hover a bar for hourly detail.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t pt-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted" />No Data</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Network Up</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Network Down</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Reboot</span>
          <span className="ml-auto font-semibold text-foreground">All Interfaces | {uptimePct}% uptime</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function IspDetailsView() {
  const { configs, saveConfig } = useIspStore();
  const [businessUnit, setBusinessUnit] = useState(UNITS[0]);
  const draft: IspConfig = configs[businessUnit] ?? { businessUnit, totalInterfaces: 1, emailOnFluctuation: false, lines: [emptyLine("WAN1")] };
  const [form, setForm] = useState<IspConfig>(draft);

  const selectUnit = (u: string) => { setBusinessUnit(u); setForm(configs[u] ?? { businessUnit: u, totalInterfaces: 1, emailOnFluctuation: false, lines: [emptyLine("WAN1")] }); };
  const setTotalInterfaces = (n: number) => {
    const lines = Array.from({ length: n }, (_, i) => form.lines[i] ?? emptyLine(`WAN${i + 1}`));
    setForm({ ...form, totalInterfaces: n, lines });
  };
  const updateLine = (i: number, patch: Partial<IspLine>) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const save = () => { saveConfig({ ...form, businessUnit }); toast.success(`ISP details saved for ${businessUnit}`); };

  return (
    <div className="space-y-6">
      <FeatureHeader title="ISP Details" description="Configure your ISP details, manage ISP alerts and add load balancing/failover details." />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label className="mb-1.5 block text-sm">Business Unit *</Label><Select value={businessUnit} onValueChange={selectUnit}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="mb-1.5 block text-sm">Total Interfaces *</Label><Select value={String(form.totalInterfaces)} onValueChange={(v) => setTotalInterfaces(+v)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><Switch checked={form.emailOnFluctuation} onCheckedChange={(v) => setForm({ ...form, emailOnFluctuation: v })} />Email when ISP speed fluctuates</label></div>
          </div>

          {form.lines.map((line, i) => (
            <div key={line.wan} className="rounded-xl border p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className={`h-2 w-2 rounded-full ${line.status === "up" ? "bg-emerald-500" : "bg-rose-500"}`} />
                ISP{i + 1} Details <span className="text-xs font-normal text-muted-foreground">({line.wan})</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><Label className="mb-1 block text-xs">Internet Provider *</Label><Select value={line.provider} onValueChange={(v) => updateLine(i, { provider: v })}><SelectTrigger className="h-9"><SelectValue placeholder="Choose provider" /></SelectTrigger><SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="mb-1 block text-xs">Connection Type *</Label><Select value={line.connectionType} onValueChange={(v) => updateLine(i, { connectionType: v })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{CONNECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="mb-1 block text-xs">Bandwidth (Mbps) *</Label><Input type="number" min={0} value={line.bandwidthMbps} onChange={(e) => updateLine(i, { bandwidthMbps: +e.target.value || 0 })} className="h-9" /></div>
                <div><Label className="mb-1 block text-xs">Threshold (Mbps) *</Label><Input type="number" min={0} value={line.thresholdMbps} onChange={(e) => updateLine(i, { thresholdMbps: +e.target.value || 0 })} className="h-9" /></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 text-xs"><Switch checked={line.emailAlert} onCheckedChange={(v) => updateLine(i, { emailAlert: v })} />Email notification when down</label>
                <label className="flex items-center gap-2 text-xs"><Switch checked={line.smsAlert} onCheckedChange={(v) => updateLine(i, { smsAlert: v })} />SMS notification when down</label>
                <label className="ml-auto flex items-center gap-2 text-xs"><Switch checked={line.status === "up"} onCheckedChange={(v) => updateLine(i, { status: v ? "up" : "down" })} />{line.status === "up" ? "Up" : "Down"} (demo toggle)</label>
              </div>
            </div>
          ))}

          <div className="flex justify-center"><Button onClick={save}>Save ISP Details</Button></div>
        </CardContent>
      </Card>

      <NetworkHealthChart businessUnit={businessUnit} anyLineDown={form.lines.some((l) => l.status === "down")} />

      <Card>
        <CardHeader><CardTitle className="text-base">Current ISP Routing</CardTitle><CardDescription>This shows the ISP configuration for every business unit.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Business Name</TableHead><TableHead>WANs</TableHead><TableHead>ISPs</TableHead><TableHead>Type</TableHead><TableHead>Bandwidth (Mbps)</TableHead><TableHead>Threshold (Mbps)</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.values(configs).map((cfg) => (
                <TableRow key={cfg.businessUnit}>
                  <TableCell className="font-medium">{cfg.businessUnit}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cfg.lines.map((l) => l.wan).join(", ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cfg.lines.map((l) => l.provider || "N/A").join(", ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cfg.lines.map((l) => l.connectionType).join(", ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cfg.lines.map((l) => l.bandwidthMbps).join(", ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cfg.lines.map((l) => l.thresholdMbps).join(", ")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {cfg.lines.map((l) => (
                        <span key={l.wan} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${l.status === "up" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"}`}>{l.wan} {l.status === "up" ? "UP" : "DOWN"}</span>
                      ))}
                    </div>
                  </TableCell>
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
interface MacAuthEntry { id: string; mac: string; type: string; expiresAt: string | null; comment: string | null; enabled: boolean }

export function MacAuthView({ locationId }: { locationId?: string }) {
  const { data, isLoading } = useCustomerFeatureData("mac-auth", locationId ?? "");
  const [entries, setEntries] = useState<MacAuthEntry[]>([]);
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (data?.macAuth && !synced) { setEntries(data.macAuth); setSynced(true); }
  }, [data, synced]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ mac: "", type: "permanent", comment: "" });
  const macValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(form.mac.trim());

  const addEntry = async () => {
    if (!macValid) { toast.error("Enter a valid MAC address, e.g. AA:BB:CC:DD:EE:FF"); return; }
    const payload = { macAddress: form.mac.trim().toUpperCase(), authorizationType: form.type as "permanent" | "temporary", comment: form.comment || null, isEnabled: true };
    try {
      if (!isDemo() && locationId) {
        const created = await macAuthorizationService.create({ ...payload, locationId });
        setEntries((e) => [{ id: created.id, mac: created.macAddress, type: created.authorizationType, expiresAt: created.expiresAt, comment: created.comment, enabled: created.isEnabled }, ...e]);
      } else {
        setEntries((e) => [{ id: String(Date.now()), mac: payload.macAddress, type: payload.type, expiresAt: null, comment: payload.comment, enabled: true }, ...e]);
      }
      toast.success("MAC address authorized");
      setForm({ mac: "", type: "permanent", comment: "" });
      setOpen(false);
    } catch {
      toast.error("Could not save — check the connection and try again.");
    }
  };

  const toggleEntry = async (entry: MacAuthEntry) => {
    setEntries((es) => es.map((e) => e.id === entry.id ? { ...e, enabled: !e.enabled } : e));
    if (!isDemo()) {
      try { await macAuthorizationService.update(entry.id, { isEnabled: !entry.enabled }); }
      catch { toast.error("Could not update on the server."); setEntries((es) => es.map((e) => e.id === entry.id ? { ...e, enabled: entry.enabled } : e)); }
    }
  };

  const removeEntry = async (entry: MacAuthEntry) => {
    setEntries((es) => es.filter((e) => e.id !== entry.id));
    toast.success("Entry removed");
    if (!isDemo()) {
      try { await macAuthorizationService.remove(entry.id); }
      catch { toast.error("Could not remove on the server."); setEntries((es) => [entry, ...es]); }
    }
  };

  return (
    <div className="space-y-6">
      <FeatureHeader title="MAC Authorization" description="Bypass hotspot authentication on a few devices." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add MAC</Button>} />
      <Card>
        <CardHeader><CardTitle className="text-base">Authorized Devices</CardTitle><CardDescription>Devices allowed onto the network without going through the captive portal.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>MAC Address</TableHead><TableHead>Type</TableHead><TableHead>Expires</TableHead><TableHead>Comment</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No MAC addresses authorized yet.</TableCell></TableRow>
              ) : entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.mac}</TableCell>
                  <TableCell className="text-xs capitalize">{e.type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.expiresAt ? new Date(e.expiresAt).toLocaleDateString() : "Never"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.comment || "—"}</TableCell>
                  <TableCell><Switch checked={e.enabled} onCheckedChange={() => toggleEntry(e)} /></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeEntry(e)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add MAC Address</DialogTitle><DialogDescription>Authorize a device to skip the captive portal.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>MAC Address</Label><Input placeholder="AA:BB:CC:DD:EE:FF" value={form.mac} onChange={(e) => setForm({ ...form, mac: e.target.value })} className="font-mono" /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="permanent">Permanent</SelectItem><SelectItem value="temporary">Temporary</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Comment (optional)</Label><Input placeholder="e.g. Front desk tablet" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={addEntry}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
  const [ipRoutes, setIpRoutes] = useState<{ ip: string; isp: string; enabled: boolean }[]>([]);
  const [vlanRoutes, setVlanRoutes] = useState<{ ip: string; isp: string; enabled: boolean }[]>([]);
  const [err, setErr] = useState("");

  const addRoute = () => {
    if (mode === "ip") {
      if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { setErr("Enter a valid IP Address"); return; }
    } else {
      if (!ip || !/^\d{1,4}$/.test(ip) || +ip < 1 || +ip > 4094) { setErr("Enter a valid VLAN ID (1-4094)"); return; }
    }
    if (!isp) { setErr("Select an ISP"); return; }
    setErr("");
    const setRoutes = mode === "ip" ? setIpRoutes : setVlanRoutes;
    setRoutes((r) => [{ ip, isp, enabled: true }, ...r]);
    setIp(""); setIsp("");
    toast.success("Route added");
  };

  const routes = mode === "ip" ? ipRoutes : vlanRoutes;
  const setRoutes = mode === "ip" ? setIpRoutes : setVlanRoutes;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ISP Routing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Route individual VLAN or user's traffic to a different ISP.</p>
      </div>

      <div className="inline-flex rounded-xl border bg-muted/40 p-1">
        {(["vlan", "ip"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setIp(""); setIsp(""); setErr(""); }} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {m === "vlan" ? "Route VLAN" : "Route IP Address"}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label className="mb-1.5 block text-sm">{mode === "ip" ? "IP Address" : "VLAN ID"} *</Label>
              <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder={mode === "ip" ? "Enter IP Address" : "Enter VLAN ID (1-4094)"} className="h-9" />
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
        <CardHeader><CardTitle className="text-base">{mode === "ip" ? "Current IP Address ISP Routing" : "Current VLAN ISP Routing"}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{mode === "ip" ? "IP Address" : "VLAN ID"}</TableHead><TableHead>ISP Name</TableHead><TableHead>Action</TableHead><TableHead>Enable/Disable Routing</TableHead></TableRow></TableHeader>
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
const DNS_SERVERS: Record<string, string> = { google: "Google 8.8.8.8", cf: "Cloudflare 1.1.1.1" };
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export function DebuggingView() {
  const [logs, setLogs] = useState<string[]>([]);
  const pushLog = (line: string) => setLogs((l) => [...l.slice(-49), `[${new Date().toLocaleTimeString()}] ${line}`]);

  const [domain, setDomain] = useState("");
  const [dnsServer, setDnsServer] = useState("google");
  const [dnsRunning, setDnsRunning] = useState(false);
  const [dnsResult, setDnsResult] = useState<{ domain: string; ip: string; latencyMs: number; ok: boolean } | null>(null);

  const runDnsLookup = () => {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean || !clean.includes(".")) { toast.error("Enter a valid domain, e.g. google.com"); return; }
    setDnsRunning(true);
    setDnsResult(null);
    pushLog(`DNS lookup: ${clean} via ${DNS_SERVERS[dnsServer]}…`);
    setTimeout(() => {
      const octet = () => Math.floor(Math.random() * 254) + 1;
      const ip = `${octet()}.${octet()}.${octet()}.${octet()}`;
      const latencyMs = Math.floor(Math.random() * 80) + 15;
      setDnsResult({ domain: clean, ip, latencyMs, ok: true });
      pushLog(`${clean} resolved to ${ip} (${latencyMs}ms via ${DNS_SERVERS[dnsServer]})`);
      setDnsRunning(false);
      toast.success(`${clean} resolved to ${ip}`);
    }, 900);
  };

  const [sessionIp, setSessionIp] = useState("");
  const resetSession = () => {
    if (!IP_RE.test(sessionIp.trim())) { toast.error("Enter a valid IP address, e.g. 10.0.1.42"); return; }
    pushLog(`Session reset requested for ${sessionIp.trim()} — forcing re-authentication.`);
    toast.success(`Session reset for ${sessionIp.trim()}`);
    setSessionIp("");
  };

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
            <Input placeholder="Domain name" value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runDnsLookup()} className="h-9" />
            <div className="flex gap-2">
              <Select value={dnsServer} onValueChange={setDnsServer}><SelectTrigger className="h-9"><SelectValue placeholder="DNS server" /></SelectTrigger><SelectContent><SelectItem value="google">Google 8.8.8.8</SelectItem><SelectItem value="cf">Cloudflare 1.1.1.1</SelectItem></SelectContent></Select>
              <Button size="sm" disabled={dnsRunning} onClick={runDnsLookup}>{dnsRunning ? "Testing…" : "Test"}</Button>
            </div>
            {dnsResult && (
              <div className="flex items-center justify-between rounded-lg border bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-500/10">
                <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{dnsResult.domain} → {dnsResult.ip}</span>
                <span className="text-muted-foreground">{dnsResult.latencyMs}ms</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><RadioTower className="h-4 w-4 text-primary" /> Reset User Session</CardTitle>
            <CardDescription>Force a guest back to the login page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="User IP address" value={sessionIp} onChange={(e) => setSessionIp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && resetSession()} className="h-9 font-mono" />
            <Button size="sm" variant="outline" onClick={resetSession}>Reset session</Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4 text-primary" /> Controller Logs</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56 overflow-auto rounded-xl border bg-[oklch(0.16_0.02_236)] p-4 font-mono text-xs text-emerald-300/90">
            {logs.length === 0 ? <span className="text-white/40">No logs to display… run a DNS lookup or session reset above.</span> : logs.map((l, i) => <div key={i}>{l}</div>)}
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
