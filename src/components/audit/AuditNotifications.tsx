import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, ShieldAlert, ShieldOff, Router as RouterIcon, SlidersHorizontal, Server } from "lucide-react";

export interface AuditNotificationRule {
  id: string;
  label: string;
  description: string;
  channel: "email" | "in_app" | "sms" | "webhook";
  enabled: boolean;
  severity: "info" | "medium" | "high" | "critical";
}

const RULES: AuditNotificationRule[] = [
  { id: "crit",      label: "Critical event alert",       description: "Notify on any critical severity event.",       channel: "in_app",  enabled: true,  severity: "critical" },
  { id: "sec",       label: "Security alert",              description: "Suspicious activity or permission changes.",   channel: "email",   enabled: true,  severity: "high" },
  { id: "failed",    label: "Failed login alert",          description: "Alert on multiple failed logins for a user.",  channel: "email",   enabled: true,  severity: "high" },
  { id: "offline",   label: "Router offline alert",        description: "When a router loses network connectivity.",    channel: "in_app",  enabled: true,  severity: "high" },
  { id: "cfg",       label: "Configuration change alert",  description: "Any platform or branding setting changed.",    channel: "webhook", enabled: false, severity: "medium" },
];

const ICONS = { crit: ShieldAlert, sec: ShieldAlert, failed: ShieldOff, offline: RouterIcon, cfg: SlidersHorizontal } as Record<string, React.ComponentType<{ className?: string }>>;

export function AuditNotifications() {
  return (
    <Card className="border-border/60">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {RULES.map((r) => {
          const Icon = ICONS[r.id] ?? Server;
          return (
            <div key={r.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{r.label}</div>
                  <Badge variant={r.enabled ? "default" : "outline"} className="text-[10px]">{r.enabled ? "On" : "Off"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{r.description}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  <Badge variant="secondary" className="capitalize">{r.channel.replace("_", " ")}</Badge>
                  <Badge variant="outline" className="capitalize">{r.severity}</Badge>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
