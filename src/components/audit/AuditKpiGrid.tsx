import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, KeyRound, Settings, Zap, ShieldOff, ShieldAlert, CalendarClock, type LucideIcon } from "lucide-react";
import { useAuditKpis } from "@/hooks/useAudit";

interface Tile {
  key: string;
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: string;
  hint?: string;
}

export function AuditKpiGrid() {
  const { data, isLoading, isError } = useAuditKpis();

  const tiles: Tile[] = [
    { key: "totalLogs",      label: "Total audit logs",     value: fmt(data?.totalLogs),           icon: Activity,     tone: "text-sky-600 dark:text-sky-400" },
    { key: "securityEvents", label: "Security events",      value: fmt(data?.securityEvents),      icon: ShieldAlert,  tone: "text-rose-600 dark:text-rose-400" },
    { key: "loginEvents",    label: "Login events",         value: fmt(data?.loginEvents),         icon: KeyRound,     tone: "text-emerald-600 dark:text-emerald-400" },
    { key: "configChanges",  label: "Configuration changes", value: fmt(data?.configurationChanges), icon: Settings,    tone: "text-violet-600 dark:text-violet-400" },
    { key: "api",            label: "API activities",       value: fmt(data?.apiActivities),       icon: Zap,          tone: "text-amber-600 dark:text-amber-400" },
    { key: "failedLogins",   label: "Failed logins",        value: fmt(data?.failedLogins),        icon: ShieldOff,    tone: "text-orange-600 dark:text-orange-400" },
    { key: "critical",       label: "Critical events",      value: fmt(data?.criticalEvents),      icon: AlertTriangle, tone: "text-red-600 dark:text-red-400" },
    { key: "today",          label: "Today's activities",   value: fmt(data?.todaysActivities),    icon: CalendarClock, tone: "text-teal-600 dark:text-teal-400" },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.key} className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
              <t.icon className={`h-4 w-4 ${t.tone}`} />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {isLoading ? <Skeleton className="h-7 w-16" /> : isError ? "—" : t.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function fmt(n?: number) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString();
}
