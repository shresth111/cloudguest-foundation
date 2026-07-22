import { Badge } from "@/components/ui/badge";
import type {
  AlertSeverity,
  AlertStatus,
  HealthStatus,
  IncidentStatus,
  NotificationChannelType,
  NotificationStatus,
  RouterLifecycleStage,
} from "@/types/monitoring";
import { cn } from "@/lib/utils";

const sevMap: Record<AlertSeverity, string> = {
  critical: "bg-red-500/15 text-red-500 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-600 border-amber-500/30",
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
  triggered: "bg-red-500/15 text-red-500 border-red-500/30",
  acknowledged: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusMap[status])}>
      {status}
    </Badge>
  );
}

const healthMap: Record<HealthStatus, string> = {
  healthy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  unhealthy: "bg-red-500/15 text-red-500 border-red-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", healthMap[status])}>
      {status}
    </Badge>
  );
}

const incStatusMap: Record<IncidentStatus, string> = {
  open: "bg-red-500/15 text-red-500 border-red-500/30",
  investigating: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", incStatusMap[status])}>
      {status}
    </Badge>
  );
}

const notificationStatusMap: Record<NotificationStatus, string> = {
  sent: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  return (
    <Badge variant="outline" className={cn("capitalize", notificationStatusMap[status])}>
      {status}
    </Badge>
  );
}

export function ChannelTypeBadge({ type }: { type: NotificationChannelType }) {
  return (
    <Badge variant="outline" className="capitalize">
      {type}
    </Badge>
  );
}

const lifecycleMap: Record<RouterLifecycleStage, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  claimed: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  approved: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  provisioning: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  provisioned: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  online: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  offline: "bg-red-500/15 text-red-500 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  failed: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function LifecycleStageBadge({ stage }: { stage: RouterLifecycleStage }) {
  return (
    <Badge variant="outline" className={cn("capitalize", lifecycleMap[stage])}>
      {stage}
    </Badge>
  );
}
