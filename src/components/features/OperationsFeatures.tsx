/**
 * Customer-dashboard feature views redesigned from the legacy BhaiFi
 * Cloud App screens (Business Hours, Hotspot Settings, Debugging Tools,
 * RaaS, MAC Auth, Port Forwarding, DHCP, VLANs, VOIP, ISP Routing/Details,
 * Notifications, Top Up, Alerts, Admin Logs). All token-driven so they
 * pick up the Aurora Teal identity automatically. Mock data only -- these
 * are the seam a per-location backend call replaces.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Bug, CheckCircle2, Clock, Download, Gauge, Globe,
  Network, Plus, RadioTower, Router, Shield, ShieldAlert, Signal, Terminal, Ticket, Trash2,
  Wifi, XCircle, Bell, Server, ArrowRightLeft, Pencil, RefreshCw, History,
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
import { useCustomerFeatureData } from "@/hooks/useCustomerDashboard";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { macAuthorizationService } from "@/services/mac-authorization.service";
import { routerService } from "@/services/router.service";
import { ispService } from "@/services/isp.service";
import type { RouterDevice } from "@/types/router";
import type { IspLink, IspLinkRole, IspHealthCheck } from "@/types/isp";
import { api } from "@/services/api";
import type { AppError } from "@/services/api";
import { cn } from "@/lib/utils";
import { getCustomerLoginRole } from "@/lib/customerNav";

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
}

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
interface AlertRow { sev: string; title: string; src: string; t: string; status: string }

const DEMO_ALERTS: AlertRow[] = [
  { sev: "error", title: "Bandwidth threshold exceeded", src: "GW-02 · Marathahalli", t: "4 min ago", status: "open" },
  { sev: "warning", title: "Signal degradation detected", src: "AP-14 · Lobby", t: "22 min ago", status: "open" },
  { sev: "success", title: "ISP failover completed", src: "System", t: "1 hour ago", status: "resolved" },
  { sev: "info", title: "Firmware update available", src: "Router fleet", t: "3 hours ago", status: "open" },
  { sev: "warning", title: "OTP delivery delayed", src: "Telecom gateway", t: "5 hours ago", status: "open" },
];

interface RawAlert { severity: string; message: string; triggered_at: string; status: string; router_id: string | null }

export function AlertsView() {
  const [alerts, setAlerts] = useState<AlertRow[]>(isDemo() ? DEMO_ALERTS : []);
  const [loading, setLoading] = useState(!isDemo());

  useEffect(() => {
    if (isDemo()) return;
    let cancelled = false;
    (async () => {
      try {
        const orgId = await resolveOrgId();
        const { data } = await api.get<{ items: RawAlert[] }>("/alerts", {
          params: { page_size: 50, organization_id: orgId },
          headers: { "X-Organization-Id": orgId },
        });
        if (cancelled) return;
        setAlerts((data?.items ?? []).map((a) => ({
          sev: a.severity === "critical" ? "error" : a.severity === "warning" ? "warning" : a.status === "resolved" ? "success" : "info",
          title: a.message, src: a.router_id ?? "System", t: timeAgo(a.triggered_at), status: a.status,
        })));
      } catch {
        // Leave alerts empty -- the "no alerts" state is accurate.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const icon = (s: string) =>
    s === "error" ? <XCircle className="h-4 w-4 text-rose-500" />
    : s === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-500" />
    : s === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : <Activity className="h-4 w-4 text-sky-500" />;
  const active = alerts.filter((a) => a.status === "open" || a.status === "acknowledged").length;
  const warnings = alerts.filter((a) => a.sev === "warning").length;
  const resolved = alerts.filter((a) => a.status === "resolved").length;
  return (
    <div className="space-y-6">
      <FeatureHeader title="Alerts" description="Live operational alerts across routers, ISPs and the captive portal." action={<Button variant="outline" size="sm">Mark all read</Button>} />
      <KpiRow items={[
        { label: "Active", value: String(active), tone: "danger", icon: AlertTriangle },
        { label: "Warnings", value: String(warnings), tone: "warning", icon: AlertTriangle },
        { label: "Resolved", value: String(resolved), tone: "success", icon: CheckCircle2 },
        { label: "Total", value: String(alerts.length), tone: "primary", icon: Activity },
      ]} />
      <Card>
        <CardHeader><CardTitle className="text-base">Recent alerts</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {loading ? (
            <p className="px-6 py-8 text-center text-xs text-muted-foreground">Loading…</p>
          ) : alerts.length === 0 ? (
            <p className="px-6 py-8 text-center text-xs text-muted-foreground">No alerts yet.</p>
          ) : alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-6 py-3.5">
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

/* ---------- ISP Details ----------
 * Real per-router WAN uplink model (`app.domains.isp`): an ISP link belongs
 * to a real router, not a fake flat "business unit" list. The customer
 * picks a real router (routerService.listForLocation(), scoped to this
 * location + the session's own org via resolveOrgId() -- routerService's
 * master-console list() fans out across every org via GET /organizations,
 * GLOBAL-scope only, which 403s for an ordinary customer session), then
 * sees/manages that router's real ISP link(s): provider, bandwidth, DNS,
 * priority/role/failover config, and real health-check status written by
 * the isp domain's own 60s Celery sweep (isp_health_checks). All CRUD goes
 * through ispService, which threads X-Organization-Id on every call. */

const LINK_TYPES: { value: string; label: string }[] = [
  { value: "fiber", label: "Fiber" },
  { value: "dsl", label: "DSL" },
  { value: "cable", label: "Cable" },
  { value: "wireless_4g", label: "4G Wireless" },
  { value: "wireless_5g", label: "5G Wireless" },
  { value: "satellite", label: "Satellite" },
  { value: "leased_line", label: "Leased Line" },
  { value: "other", label: "Other" },
];

const HEALTH_BADGE: Record<string, { label: string; dot: string; cls: string }> = {
  healthy: { label: "Online", dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  degraded: { label: "Degraded", dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  unhealthy: { label: "Offline", dot: "bg-rose-500", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
  unknown: { label: "Unknown", dot: "bg-muted-foreground/40", cls: "bg-muted text-muted-foreground" },
};

function HealthBadge({ status }: { status: string }) {
  const b = HEALTH_BADGE[status] ?? HEALTH_BADGE.unknown;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", b.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", b.dot)} />{b.label}
    </span>
  );
}

interface IspLinkFormState {
  providerName: string;
  linkType: string;
  role: IspLinkRole;
  priority: number;
  interfaceName: string;
  gatewayIpAddress: string;
  dnsPrimary: string;
  dnsSecondary: string;
  downloadBandwidthMbps: string;
  uploadBandwidthMbps: string;
  autoFailback: boolean;
}
const emptyLinkForm = (): IspLinkFormState => ({
  providerName: "", linkType: "fiber", role: "primary", priority: 0, interfaceName: "",
  gatewayIpAddress: "", dnsPrimary: "", dnsSecondary: "", downloadBandwidthMbps: "", uploadBandwidthMbps: "", autoFailback: true,
});

// Illustrative-only, entirely local demo fixture -- the demo session's
// token never authenticates against the real backend (see
// router.service.ts's own DEMO_ROUTERS comment), so this view never calls
// routerService/ispService while isDemo() is true, mirroring every other
// rebuilt customer view's (MacAuthView, WhiteList, CreateGroup) identical
// demo/real split.
const DEMO_ROUTER: RouterDevice = {
  id: "router-demo-isp", locationId: "demo-location", locationName: "Demo Location", organizationId: "org-demo", organizationName: "Demo Org",
  name: "DEMO-EDGE-01", serialNumber: "SN-DEMO-ISP", macAddress: "AA:BB:CC:DD:EE:FF", model: "RB5009UG+S+", vendor: "MikroTik",
  routerOsVersion: "7.14", managementIpAddress: "10.20.0.1", publicIpAddress: "203.0.113.20", status: "online",
  lastSeenAt: new Date().toISOString(), lastHealthCheckAt: new Date().toISOString(), healthStatus: "healthy",
  hasApiCredentials: true, settings: {}, createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), updatedAt: new Date().toISOString(),
};
const DEMO_LINKS: IspLink[] = [
  { id: "isp-demo-1", routerId: DEMO_ROUTER.id, organizationId: "org-demo", locationId: "demo-location", providerName: "Airtel", linkType: "fiber", role: "primary", isActiveUplink: true, autoFailback: true, isEnabled: true, priority: 0, interface: "ether1", gatewayIpAddress: "203.0.113.1", dnsPrimary: "1.1.1.1", dnsSecondary: "8.8.8.8", downloadBandwidthMbps: 500, uploadBandwidthMbps: 200, healthStatus: "healthy", latencyMs: 12.4, packetLossPercentage: 0, lastCheckedAt: new Date().toISOString(), consecutiveUnhealthyCount: 0, createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
  { id: "isp-demo-2", routerId: DEMO_ROUTER.id, organizationId: "org-demo", locationId: "demo-location", providerName: "Jio", linkType: "wireless_4g", role: "backup", isActiveUplink: false, autoFailback: true, isEnabled: true, priority: 1, interface: "lte1", gatewayIpAddress: "203.0.113.9", dnsPrimary: "1.1.1.1", dnsSecondary: null, downloadBandwidthMbps: 100, uploadBandwidthMbps: 40, healthStatus: "degraded", latencyMs: 89.1, packetLossPercentage: 3.2, lastCheckedAt: new Date().toISOString(), consecutiveUnhealthyCount: 0, createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
];

function IspLinkDialog({
  open, onOpenChange, editing, saving, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: IspLink | null;
  saving: boolean;
  onSave: (form: IspLinkFormState) => void;
}) {
  const [form, setForm] = useState<IspLinkFormState>(emptyLinkForm());
  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      providerName: editing.providerName,
      linkType: editing.linkType,
      role: editing.role,
      priority: editing.priority,
      interfaceName: editing.interface ?? "",
      gatewayIpAddress: editing.gatewayIpAddress ?? "",
      dnsPrimary: editing.dnsPrimary ?? "",
      dnsSecondary: editing.dnsSecondary ?? "",
      downloadBandwidthMbps: editing.downloadBandwidthMbps != null ? String(editing.downloadBandwidthMbps) : "",
      uploadBandwidthMbps: editing.uploadBandwidthMbps != null ? String(editing.uploadBandwidthMbps) : "",
      autoFailback: editing.autoFailback,
    } : emptyLinkForm());
  }, [open, editing]);

  const valid = form.providerName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit ISP Link" : "Add ISP Link"}</DialogTitle>
          <DialogDescription>{editing ? "Update this router's WAN uplink." : "Add a new WAN uplink for the selected router."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="mb-1 block text-xs">Internet Provider *</Label><Input placeholder="e.g. Airtel" value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} className="h-9" /></div>
            <div><Label className="mb-1 block text-xs">Link Type</Label><Select value={form.linkType} onValueChange={(v) => setForm({ ...form, linkType: v })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{LINK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="mb-1 block text-xs">Role</Label><Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as IspLinkRole })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary">Primary</SelectItem><SelectItem value="backup">Backup</SelectItem></SelectContent></Select></div>
            <div><Label className="mb-1 block text-xs">Priority</Label><Input type="number" min={0} value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value || 0 })} className="h-9" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="mb-1 block text-xs">Download (Mbps)</Label><Input type="number" min={0} placeholder="500" value={form.downloadBandwidthMbps} onChange={(e) => setForm({ ...form, downloadBandwidthMbps: e.target.value })} className="h-9" /></div>
            <div><Label className="mb-1 block text-xs">Upload (Mbps)</Label><Input type="number" min={0} placeholder="200" value={form.uploadBandwidthMbps} onChange={(e) => setForm({ ...form, uploadBandwidthMbps: e.target.value })} className="h-9" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="mb-1 block text-xs">Gateway IP</Label><Input placeholder="203.0.113.1" value={form.gatewayIpAddress} onChange={(e) => setForm({ ...form, gatewayIpAddress: e.target.value })} className="h-9 font-mono" /></div>
            <div><Label className="mb-1 block text-xs">Interface</Label><Input placeholder="ether1" value={form.interfaceName} onChange={(e) => setForm({ ...form, interfaceName: e.target.value })} className="h-9 font-mono" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="mb-1 block text-xs">DNS Primary</Label><Input placeholder="1.1.1.1" value={form.dnsPrimary} onChange={(e) => setForm({ ...form, dnsPrimary: e.target.value })} className="h-9 font-mono" /></div>
            <div><Label className="mb-1 block text-xs">DNS Secondary</Label><Input placeholder="8.8.8.8" value={form.dnsSecondary} onChange={(e) => setForm({ ...form, dnsSecondary: e.target.value })} className="h-9 font-mono" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.autoFailback} onCheckedChange={(v) => setForm({ ...form, autoFailback: v })} />Auto failback to this link once healthy again</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form)}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Link"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IspHealthHistoryDialog({ linkId, open, onOpenChange }: { linkId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [checks, setChecks] = useState<IspHealthCheck[]>([]);
  const [availability, setAvailability] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !linkId) return;
    let alive = true;
    setLoading(true);
    ispService.listHealthChecks(linkId, { page: 1, pageSize: 10 })
      .then((r) => { if (alive) { setChecks(r.rows); setAvailability(r.availabilityPercentage); } })
      .catch(() => { if (alive) toast.error("Could not load health-check history."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, linkId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recent Health Checks</DialogTitle>
          <DialogDescription>
            {availability != null ? `${availability.toFixed(1)}% availability over the last ${checks.length} checks.` : "Real /tool/ping results from this link's scheduled health-check sweep."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : checks.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No health checks recorded yet -- the next sweep runs within 60 seconds, or trigger one manually.</p>
          ) : checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
              <div className="flex items-center gap-2"><HealthBadge status={c.status} /><span className="text-muted-foreground">{new Date(c.checkedAt).toLocaleString()}</span></div>
              <div className="text-right text-muted-foreground">
                {c.latencyMs != null ? `${c.latencyMs.toFixed(1)} ms` : "—"} · {c.packetLossPercentage != null ? `${c.packetLossPercentage.toFixed(1)}% loss` : "—"}
                {c.errorMessage && <p className="mt-0.5 text-rose-600 dark:text-rose-400">{c.errorMessage}</p>}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IspDetailsView({ locationId }: { locationId?: string }) {
  const demo = isDemo();
  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [routersLoading, setRoutersLoading] = useState(true);
  const [selectedRouterId, setSelectedRouterId] = useState("");
  const [links, setLinks] = useState<IspLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<IspLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [historyLinkId, setHistoryLinkId] = useState<string | null>(null);
  const [failoverBusy, setFailoverBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRoutersLoading(true);
      try {
        const rows = demo ? [DEMO_ROUTER] : locationId ? await routerService.listForLocation(locationId, await resolveOrgId()) : [];
        if (!alive) return;
        setRouters(rows);
        setSelectedRouterId((prev) => (prev && rows.some((r) => r.id === prev)) ? prev : (rows[0]?.id ?? ""));
      } catch {
        if (alive) toast.error("Could not load routers for this location.");
      } finally {
        if (alive) setRoutersLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [locationId, demo]);

  const loadLinks = async (routerId: string) => {
    if (!routerId) { setLinks([]); return; }
    setLinksLoading(true);
    try {
      if (demo) {
        setLinks(routerId === DEMO_ROUTER.id ? DEMO_LINKS : []);
      } else {
        const result = await ispService.listLinks({ routerId, page: 1, pageSize: 25 });
        setLinks(result.rows);
      }
    } catch {
      toast.error("Could not load ISP links for this router.");
      setLinks([]);
    } finally {
      setLinksLoading(false);
    }
  };

  useEffect(() => { loadLinks(selectedRouterId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedRouterId, demo]);

  const selectedRouter = routers.find((r) => r.id === selectedRouterId) ?? null;

  const openCreate = () => { setEditingLink(null); setDialogOpen(true); };
  const openEdit = (link: IspLink) => { setEditingLink(link); setDialogOpen(true); };

  const saveLink = async (form: IspLinkFormState) => {
    if (demo) { toast.error("Sign in to a real account to manage ISP links."); return; }
    if (!selectedRouterId) return;
    setSaving(true);
    try {
      const payload = {
        routerId: selectedRouterId,
        providerName: form.providerName.trim(),
        linkType: form.linkType,
        role: form.role,
        priority: form.priority,
        interface: form.interfaceName.trim() || null,
        gatewayIpAddress: form.gatewayIpAddress.trim() || null,
        dnsPrimary: form.dnsPrimary.trim() || null,
        dnsSecondary: form.dnsSecondary.trim() || null,
        downloadBandwidthMbps: form.downloadBandwidthMbps ? +form.downloadBandwidthMbps : null,
        uploadBandwidthMbps: form.uploadBandwidthMbps ? +form.uploadBandwidthMbps : null,
        autoFailback: form.autoFailback,
      };
      if (editingLink) {
        const updated = await ispService.updateLink(editingLink.id, payload);
        setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
        toast.success("ISP link updated");
      } else {
        const created = await ispService.createLink(payload);
        setLinks((ls) => [created, ...ls]);
        toast.success("ISP link added");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error((err as AppError).message || "Could not save the ISP link.");
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (link: IspLink) => {
    if (demo) { toast.error("Sign in to a real account to manage ISP links."); return; }
    setLinks((ls) => ls.filter((l) => l.id !== link.id));
    try {
      await ispService.removeLink(link.id);
      toast.success("ISP link removed");
    } catch (err) {
      toast.error((err as AppError).message || "Could not remove the ISP link.");
      setLinks((ls) => [link, ...ls]);
    }
  };

  const checkHealth = async (link: IspLink) => {
    if (demo) { toast.info("Health checks run against real router hardware -- not available in demo mode."); return; }
    setCheckingId(link.id);
    try {
      const updated = await ispService.checkLinkHealth(link.id);
      setLinks((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
      toast.success(`Health check complete — ${HEALTH_BADGE[updated.healthStatus]?.label ?? updated.healthStatus}`);
    } catch (err) {
      toast.error((err as AppError).message || "Health check failed.");
    } finally {
      setCheckingId(null);
    }
  };

  const triggerFailover = async () => {
    if (demo || !selectedRouterId) return;
    setFailoverBusy(true);
    try {
      await ispService.triggerFailover(selectedRouterId);
      toast.success("Failover triggered");
      await loadLinks(selectedRouterId);
    } catch (err) {
      toast.error((err as AppError).message || "Could not trigger failover.");
    } finally {
      setFailoverBusy(false);
    }
  };

  const triggerFailback = async () => {
    if (demo || !selectedRouterId) return;
    setFailoverBusy(true);
    try {
      await ispService.triggerFailback(selectedRouterId);
      toast.success("Failback triggered");
      await loadLinks(selectedRouterId);
    } catch (err) {
      toast.error((err as AppError).message || "Could not trigger failback.");
    } finally {
      setFailoverBusy(false);
    }
  };

  const healthyCount = links.filter((l) => l.healthStatus === "healthy").length;
  const activeLink = links.find((l) => l.isActiveUplink);

  return (
    <div className="space-y-6">
      <FeatureHeader
        title="ISP Details"
        description="Real WAN uplinks per router -- provider, bandwidth, DNS, failover priority, and live health status."
        action={selectedRouterId ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add ISP Link</Button> : undefined}
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-sm">Router *</Label>
              <Select value={selectedRouterId} onValueChange={setSelectedRouterId} disabled={routersLoading || routers.length === 0}>
                <SelectTrigger className="h-9"><SelectValue placeholder={routersLoading ? "Loading routers…" : "Select a router"} /></SelectTrigger>
                <SelectContent>
                  {routers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} <span className="text-muted-foreground">({r.locationName || r.serialNumber})</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedRouter && (
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" disabled={failoverBusy || links.length < 2} onClick={triggerFailover}><ArrowRightLeft className="h-4 w-4" />Trigger Failover</Button>
                <Button variant="outline" size="sm" disabled={failoverBusy || links.length < 2} onClick={triggerFailback}><RefreshCw className="h-4 w-4" />Trigger Failback</Button>
              </div>
            )}
          </div>

          {!routersLoading && routers.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No routers are provisioned at this location yet. Provision a router first, then come back here to configure its ISP link.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedRouter && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Router Status" value={selectedRouter.status === "online" ? "Online" : selectedRouter.status.replace(/_/g, " ")} tone={selectedRouter.status === "online" ? "success" : "warning"} icon={Router} />
            <StatCard label="ISP Links" value={links.length} tone="default" icon={Network} />
            <StatCard label="Healthy Links" value={`${healthyCount}/${links.length}`} tone={healthyCount === links.length && links.length > 0 ? "success" : "warning"} icon={Signal} />
            <StatCard label="Active Uplink" value={activeLink?.providerName ?? "—"} tone="primary" icon={Globe} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">WAN Uplinks — {selectedRouter.name}</CardTitle><CardDescription>Every ISP link configured for this router, with real, sweep-updated health status.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead><TableHead>Type</TableHead><TableHead>Role</TableHead>
                    <TableHead>Bandwidth</TableHead><TableHead>DNS</TableHead><TableHead>Priority</TableHead>
                    <TableHead>Health</TableHead><TableHead>Latency / Loss</TableHead><TableHead>Last Checked</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linksLoading ? (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : links.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">No ISP link configured for this router yet. Click "Add ISP Link" to add one.</TableCell></TableRow>
                  ) : links.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.providerName}{l.isActiveUplink && <Badge variant="outline" className="ml-2 text-[10px]">Active</Badge>}</TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">{l.linkType.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">{l.role}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.downloadBandwidthMbps ?? "—"}↓ / {l.uploadBandwidthMbps ?? "—"}↑ Mbps</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{[l.dnsPrimary, l.dnsSecondary].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.priority}</TableCell>
                      <TableCell><HealthBadge status={l.healthStatus} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.latencyMs != null ? `${l.latencyMs.toFixed(1)} ms` : "—"} / {l.packetLossPercentage != null ? `${l.packetLossPercentage.toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.lastCheckedAt ? timeAgo(l.lastCheckedAt) : "Never"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Check health now" disabled={checkingId === l.id} onClick={() => checkHealth(l)}><RefreshCw className={cn("h-4 w-4", checkingId === l.id && "animate-spin")} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Health history" onClick={() => setHistoryLinkId(l.id)}><History className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Remove" onClick={() => removeLink(l)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <IspLinkDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editingLink} saving={saving} onSave={saveLink} />
      <IspHealthHistoryDialog linkId={historyLinkId} open={historyLinkId != null} onOpenChange={(v) => !v && setHistoryLinkId(null)} />
    </div>
  );
}

/* ---------- Admin Logs ---------- */
export function AdminLogsView({ locationId }: { locationId?: string }) {
  // Owner-only, render-time check -- defense in depth alongside the
  // sidebar/route-nav guard (customerNav.ts / customer.$locationId.$feature
  // .tsx's own NAV_GROUPS) and the backend's own independent enforcement
  // (app.domains.admin_logs.router's RequireRole("organization-owner"),
  // and -- since the "Audit Log" tab's real data was folded into this
  // page's own Account Activity section below -- app.domains.audit
  // .router's matching RequireRole narrowing). A UI guard alone is
  // bypassable (a direct URL hit skips the sidebar filter entirely) --
  // this catches that case; the backend 403 is what actually keeps a
  // non-owner from ever getting the real data either way.
  const role = getCustomerLoginRole();
  // Real data only -- fetched from /admin-logs/dashboard-logins,
  // /admin-logs/router-events, and /audit/entries (all org-scoped,
  // Owner-only) via customerService.getFeatureData("admin-logs", ...). No
  // Math.random(), no fabricated rows; a failed/blocked fetch resolves to
  // an empty section, never fake log entries (see customer.service.ts's
  // own "admin-logs" case docstring).
  const { data, isLoading } = useCustomerFeatureData("admin-logs", locationId ?? "");

  if (role !== "owner") {
    return (
      <div className="space-y-6">
        <FeatureHeader title="Admin Logs" description="Who logged into the dashboard and when, router activity, and account changes across every location." />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Owner access only</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Admin Logs shows a security-sensitive login and change-audit trail for the whole organization. Only the Organization Owner can view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const logins = data?.adminLogs?.dashboardLogins ?? [];
  const routerLogs = data?.adminLogs?.routerLogs ?? [];
  const accountActivity = data?.adminLogs?.accountActivity ?? [];

  return (
    <div className="space-y-8">
      <FeatureHeader title="Admin Logs" description="Real login activity, router events, and account/config changes across every location in your organization." />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Dashboard Logins</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Email</TableHead><TableHead>IP Address</TableHead><TableHead>Result</TableHead><TableHead>When</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
                ) : logins.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">No dashboard logins recorded yet.</TableCell></TableRow>
                ) : logins.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.email}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.ipAddress}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", l.success ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400")}>
                        {l.success ? "Success" : (l.failureReason ?? "Failed")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Router Logs by Location</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Location</TableHead><TableHead>Router</TableHead><TableHead>Event</TableHead><TableHead>Message</TableHead><TableHead>When</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
                ) : routerLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">No router events recorded yet.</TableCell></TableRow>
                ) : routerLogs.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.locationName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.routerName}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", e.isError ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" : "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300")}>
                        {e.eventType.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.message ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {/* Real administrative change-audit trail (role assignments,
            location/member changes, etc.) -- what used to be the
            standalone "Audit Log" tab, now merged in here as its own
            section rather than kept as a second nav entry. Same real
            /audit/entries data (app.domains.audit), same
            useCustomerFeatureData("admin-logs", ...) call as the two
            sections above -- see customer.service.ts's own "admin-logs"
            case docstring. */}
        <h3 className="text-sm font-semibold text-foreground">Account Activity</h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Action</TableHead><TableHead>Description</TableHead><TableHead>Actor</TableHead><TableHead>When</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
                ) : accountActivity.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">No account activity recorded yet.</TableCell></TableRow>
                ) : accountActivity.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-500/10 dark:text-slate-300">
                        {a.action.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.description ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.actorUserId ?? "system"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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
