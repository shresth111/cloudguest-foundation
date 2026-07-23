/**
 * Compact, reusable customer feature views (Dashboard, Users, Analytics,
 * Devices, Audit, Help) shared by the agent dynamic dashboard. Token-driven
 * (Aurora Teal). Mock data -- the seam a per-location API call replaces.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Activity, CheckCircle2, Wifi, XCircle, AlertTriangle, Printer, Router, Camera, HardDrive, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatCard } from "@/components/ui-ext/StatCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDeviceStore, FLOORS, DEVICE_TYPES, formatSince, type DeviceType } from "@/stores/deviceStore";

export function BasicDashboardView({ locationId }: { locationId?: string }) {
  void locationId;
  const kpis = [
    { l: "Online Users", v: "1,247", t: "primary" as const },
    { l: "Active Sessions", v: "892", t: "info" as const },
    { l: "Routers Online", v: "18/20", t: "success" as const },
    { l: "Today's Guests", v: "456", t: "primary" as const },
    { l: "Avg Session", v: "34m", t: "info" as const },
    { l: "SLA Uptime", v: "99.9%", t: "success" as const },
  ];
  const users = [
    { n: "John Doe", e: "john@email.com", t: "2m ago", s: "online" },
    { n: "Jane Smith", e: "jane@email.com", t: "5m ago", s: "online" },
    { n: "Raj Kumar", e: "raj@email.com", t: "12m ago", s: "online" },
    { n: "Alex Chen", e: "alex@email.com", t: "25m ago", s: "offline" },
  ];
  const alerts = [
    { t: "warning", m: "GW-02 signal degradation" },
    { t: "success", m: "ISP failover completed" },
    { t: "error", m: "Bandwidth threshold exceeded" },
    { t: "info", m: "Firmware update available" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => <StatCard key={k.l} label={k.l} value={k.v} tone={k.t} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Recent Users</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Time</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.n}>
                    <TableCell><p className="text-sm font-medium">{u.n}</p><p className="text-xs text-muted-foreground">{u.e}</p></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.t}</TableCell>
                    <TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.s === "online" ? "text-emerald-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", u.s === "online" ? "bg-emerald-500" : "bg-muted-foreground")} />{u.s}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Alerts</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {alerts.map((a) => (
              <div key={a.m} className="flex items-start gap-3 py-3">
                {a.t === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> : a.t === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : a.t === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />}
                <p className="text-sm">{a.m}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BasicUsersView() {
  const [q, setQ] = useState("");
  const all = Array.from({ length: 12 }, (_, i) => ({
    id: `u-${i}`,
    name: ["John Doe", "Jane Smith", "Raj Kumar", "Priya Sharma", "Alex Chen", "Sarah Wilson"][i % 6],
    email: `user${i + 1}@email.com`,
    mac: `00:1A:${10 + i}`,
    duration: `${15 + (i % 6) * 10}m`,
    status: ["online", "online", "online", "idle", "offline", "online"][i % 6],
  }));
  const rows = all.filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <Input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 max-w-xs" />
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead className="hidden sm:table-cell">MAC</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{u.mac}</TableCell>
                  <TableCell className="text-xs">{u.duration}</TableCell>
                  <TableCell><span className={cn("inline-flex items-center gap-1 text-xs font-medium", u.status === "online" ? "text-emerald-500" : u.status === "idle" ? "text-amber-500" : "text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "online" ? "bg-emerald-500" : u.status === "idle" ? "bg-amber-500" : "bg-muted-foreground")} />{u.status}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function BasicAnalyticsView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[{ l: "Total Sessions", v: "1,892" }, { l: "Unique Guests", v: "847" }, { l: "Return Rate", v: "34%" }, { l: "Avg Duration", v: "28 min" }].map((k) => (
        <StatCard key={k.l} label={k.l} value={k.v} tone="primary" />
      ))}
    </div>
  );
}

export function BasicDevicesView() {
  const devices = [
    { m: "00:1A:2B:3C:4D:5E", i: "10.0.1.42", d: "iPhone 15", ls: "Just now" },
    { m: "AA:BB:CC:DD:EE:FF", i: "10.0.1.87", d: "MacBook Pro", ls: "2 min ago" },
    { m: "11:22:33:44:55:66", i: "10.0.2.15", d: "Galaxy S24", ls: "5 min ago" },
  ];
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-base">Connected Devices</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>MAC</TableHead><TableHead>IP</TableHead><TableHead>Device</TableHead><TableHead>Last Seen</TableHead></TableRow></TableHeader>
          <TableBody>
            {devices.map((d) => (
              <TableRow key={d.m}>
                <TableCell className="font-mono text-xs">{d.m}</TableCell>
                <TableCell className="font-mono text-xs">{d.i}</TableCell>
                <TableCell>{d.d}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{d.ls}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const DEVICE_TYPE_ICON: Record<DeviceType, typeof Wifi> = {
  "Access Point": Wifi, Printer, Router, Camera, Other: HardDrive,
};

const emptyHardwareForm = { name: "", mac: "", type: "Access Point" as DeviceType, floor: FLOORS[FLOORS.length - 1] };

/** Manual setup for network hardware (Access Points, Printers, etc), scoped
 * to whichever location's dashboard this is rendered inside -- a device
 * added here only ever shows up in that location's monitoring, never mixed
 * with another location's floors. Up/down status is then derived from the
 * MAC on the monitoring side; this form only records identity, type, and
 * physical floor. */
export function NetworkHardwareView({ locationId }: { locationId?: string }) {
  const { devices: allDevices, addDevice, removeDevice } = useDeviceStore();
  const devices = allDevices.filter((d) => d.locationId === locationId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyHardwareForm);

  const macValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(form.mac.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) { toast.error("Select a location first."); return; }
    if (!macValid) { toast.error("Enter a valid MAC address, e.g. AA:BB:CC:DD:EE:FF"); return; }
    if (allDevices.some((d) => d.mac.toUpperCase() === form.mac.trim().toUpperCase())) { toast.error("A device with this MAC is already set up."); return; }
    addDevice(locationId, form.name.trim(), form.mac.trim().toUpperCase(), form.type, form.floor);
    toast.success(`${form.type} added on ${form.floor}`);
    setForm(emptyHardwareForm);
    setOpen(false);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Network Hardware</CardTitle>
          <CardDescription>Set up Access Points, Printers, and other hardware for this location by MAC address and floor so Device Monitoring can track them.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add Device</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>MAC</TableHead><TableHead>Floor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">No hardware set up yet. Add one by MAC address to start monitoring it.</TableCell></TableRow>
            ) : devices.map((d) => {
              const Icon = DEVICE_TYPE_ICON[d.type];
              return (
                <TableRow key={d.id}>
                  <TableCell><span className="inline-flex items-center gap-2 text-sm font-medium"><Icon title={d.type} className="h-4 w-4 text-primary" />{d.name}<span className="font-normal text-xs text-muted-foreground">({d.type})</span></span></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{d.mac}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.floor}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", d.status === "up" ? "text-emerald-600" : "text-rose-600")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", d.status === "up" ? "bg-emerald-500" : "bg-rose-500")} />
                      {d.status === "up" ? "Up" : "Down"} · {formatSince(d.statusChangedAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button onClick={() => { removeDevice(d.id); toast.success(`${d.name} removed`); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                      <Trash2 className="h-3 w-3" />Remove
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Network Hardware</DialogTitle>
            <DialogDescription>Enter the device's MAC address, type, and the floor it's installed on.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="hw-name">Device name</Label><Input id="hw-name" placeholder="e.g. AP Lobby North" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label htmlFor="hw-mac">MAC address</Label>
              <Input id="hw-mac" placeholder="AA:BB:CC:DD:EE:FF" value={form.mac} onChange={(e) => setForm({ ...form, mac: e.target.value })} className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Device type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as DeviceType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEVICE_TYPES.map((t) => { const Icon = DEVICE_TYPE_ICON[t]; return <SelectItem key={t} value={t}><span className="inline-flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-primary" />{t}</span></SelectItem>; })}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Select value={form.floor} onValueChange={(v) => setForm({ ...form, floor: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FLOORS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Add Device</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function BasicAuditView() {
  const items = [
    { a: "Guest login via OTP", w: "guest@email.com", t: "2 min ago" },
    { a: "Voucher batch created", w: "reception", t: "18 min ago" },
    { a: "Router restart completed", w: "system", t: "1 hour ago" },
    { a: "Portal branding updated", w: "manager", t: "3 hours ago" },
  ];
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {items.map((ev, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1"><p className="text-sm">{ev.a}</p><p className="truncate text-xs text-muted-foreground">{ev.w} · {ev.t}</p></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BasicHelpView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[{ n: "Documentation", d: "Guides and API reference" }, { n: "FAQs", d: "Frequently asked questions" }, { n: "Raise Ticket", d: "Contact support" }].map((h) => (
        <Card key={h.n} className="rounded-2xl transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <p className="font-semibold">{h.n}</p>
            <p className="mt-1 text-xs text-muted-foreground">{h.d}</p>
            <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={() => toast.success(`Opening ${h.n}`)}>Open</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
