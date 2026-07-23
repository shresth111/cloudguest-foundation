/**
 * Compact, reusable customer feature views (Dashboard, Users, Analytics,
 * Devices, Audit, Help) shared by the agent dynamic dashboard. Token-driven
 * (Aurora Teal). Mock data -- the seam a per-location API call replaces.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Activity, CheckCircle2, Wifi, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui-ext/StatCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
