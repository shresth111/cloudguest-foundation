import { Badge } from "@/components/ui/badge";
import type { AlertSeverity, AlertStatus, HealthStatus, IncidentPriority, IncidentStatus } from "@/types/monitoring";
import { cn } from "@/lib/utils";

const sevMap: Record<AlertSeverity, string> = {
  critical: "bg-red-500/15 text-red-500 border-red-500/30",
  high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  info: "bg-muted text-muted-foreground border-border",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", sevMap[severity])}>
      {severity}
    </Badge>
  );
}

const statusMap: Record<AlertStatus, string> = {
  open: "bg-red-500/15 text-red-500 border-red-500/30",
  acknowledged: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <Badge variant="outline" className={cn("capitalize", statusMap[status])}>{status}</Badge>;
}

const healthMap: Record<HealthStatus, string> = {
  healthy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  down: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return <Badge variant="outline" className={cn("capitalize", healthMap[status])}>{status}</Badge>;
}

const priorityMap: Record<IncidentPriority, string> = {
  P1: "bg-red-500/15 text-red-500 border-red-500/30",
  P2: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  P3: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  P4: "bg-blue-500/15 text-blue-500 border-blue-500/30",
};

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  return <Badge variant="outline" className={cn(priorityMap[priority])}>{priority}</Badge>;
}

const incStatusMap: Record<IncidentStatus, string> = {
  open: "bg-red-500/15 text-red-500 border-red-500/30",
  investigating: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant="outline" className={cn("capitalize", incStatusMap[status])}>{status}</Badge>;
}
