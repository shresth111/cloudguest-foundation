import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Search, Shield, User, Settings, Globe, MapPin, Router, Key, Activity } from "lucide-react";
import { PageHeader } from "@/components/system/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuditEvent {
  id: string;
  time: Date;
  user: string;
  action: string;
  module: string;
  status: "success" | "failure" | "pending";
  ip: string;
  device: string;
  details: string;
}

const MODULE_ICONS: Record<string, typeof Shield> = {
  auth: Shield, network: Globe, location: MapPin, router: Router, user: User, settings: Settings, system: Activity, security: Shield, billing: Key,
};

const EVENTS: AuditEvent[] = [
  { id: "ae1", time: new Date(Date.now() - 60000), user: "admin@acme.com", action: "User login", module: "auth", status: "success", ip: "203.0.113.42", device: "Chrome / macOS", details: "Successful login from Mumbai office" },
  { id: "ae2", time: new Date(Date.now() - 120000), user: "john@acme.com", action: "Create location", module: "location", status: "success", ip: "198.51.100.15", device: "Firefox / Windows", details: "Created new location: Bangalore DC" },
  { id: "ae3", time: new Date(Date.now() - 300000), user: "system", action: "Router offline", module: "router", status: "failure", ip: "—", device: "System", details: "GW-07 at Bangalore DC went offline" },
  { id: "ae4", time: new Date(Date.now() - 600000), user: "sarah@acme.com", action: "Update VLAN", module: "network", status: "success", ip: "192.0.2.88", device: "Safari / iOS", details: "VLAN 100 extended to Chennai Office" },
  { id: "ae5", time: new Date(Date.now() - 900000), user: "mike@acme.com", action: "Generate voucher batch", module: "system", status: "success", ip: "203.0.113.55", device: "Edge / Windows", details: "500 vouchers generated for Mumbai HQ" },
  { id: "ae6", time: new Date(Date.now() - 1800000), user: "admin@acme.com", action: "Update bandwidth policy", module: "network", status: "success", ip: "203.0.113.42", device: "Chrome / macOS", details: "Bandwidth policy updated for Delhi Office" },
  { id: "ae7", time: new Date(Date.now() - 3600000), user: "system", action: "Backup completed", module: "system", status: "success", ip: "—", device: "System", details: "Automated backup completed successfully" },
  { id: "ae8", time: new Date(Date.now() - 7200000), user: "jane@acme.com", action: "Failed login attempt", module: "auth", status: "failure", ip: "45.33.32.156", device: "Unknown / Linux", details: "Invalid password — 3rd attempt from unknown IP" },
  { id: "ae9", time: new Date(Date.now() - 10800000), user: "admin@acme.com", action: "API key rotated", module: "security", status: "success", ip: "203.0.113.42", device: "Chrome / macOS", details: "API key 'Production-Key' rotated" },
  { id: "ae10", time: new Date(Date.now() - 14400000), user: "billing@acme.com", action: "Invoice generated", module: "billing", status: "success", ip: "198.51.100.20", device: "Chrome / Windows", details: "Invoice INV-2025-0421 for $1,299.00" },
  { id: "ae11", time: new Date(Date.now() - 18000000), user: "admin@acme.com", action: "Role updated", module: "user", status: "success", ip: "203.0.113.42", device: "Chrome / macOS", details: "User 'mike@acme.com' promoted to Location Manager" },
  { id: "ae12", time: new Date(Date.now() - 21600000), user: "system", action: "SSL cert renewed", module: "system", status: "success", ip: "—", device: "System", details: "SSL certificate renewed for portal.acme.com" },
];

export const Route = createFileRoute("/_authenticated/audit-timeline/")({
  component: AuditTimelinePage,
});

function AuditTimelinePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = EVENTS.filter((e) => {
    if (filter !== "all" && e.status !== filter) return false;
    if (search && !e.action.toLowerCase().includes(search.toLowerCase()) && !e.user.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit timeline" description="Complete audit trail of all platform actions and events." />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search actions, users…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8" />
        </div>
        {["all", "success", "failure", "pending"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors", filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="relative space-y-0">
        {filtered.map((event, i) => {
          const Icon = MODULE_ICONS[event.module] ?? Activity;
          return (
            <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < filtered.length - 1 && <div className="absolute left-[15px] top-10 bottom-0 w-px bg-border" />}
              <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                event.status === "success" ? "border-emerald-500/30 bg-emerald-500/10" :
                event.status === "failure" ? "border-rose-500/30 bg-rose-500/10" :
                "border-amber-500/30 bg-amber-500/10")}>
                <Icon className={cn("h-3.5 w-3.5", event.status === "success" ? "text-emerald-600" : event.status === "failure" ? "text-rose-600" : "text-amber-600")} />
              </div>
              <div className="min-w-0 flex-1">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{event.action}</span>
                          <Badge variant="outline" className={cn("h-4 px-1 text-[9px] capitalize",
                            event.status === "success" ? "text-emerald-600 border-emerald-500/30" :
                            event.status === "failure" ? "text-rose-600 border-rose-500/30" :
                            "text-amber-600 border-amber-500/30")}>{event.status}</Badge>
                          <Badge variant="outline" className="h-4 px-1 text-[9px] capitalize">{event.module}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{event.details}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{format(event.time, "MMM d, HH:mm")}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                      <span>User: {event.user}</span>
                      <span>IP: {event.ip}</span>
                      <span>Device: {event.device}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
