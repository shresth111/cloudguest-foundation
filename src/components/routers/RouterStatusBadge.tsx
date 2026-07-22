import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthStatus, RouterStatus } from "@/types/router";
import { ROUTER_STATUS_LABEL } from "@/types/router";

const STATUS_STYLES: Record<RouterStatus, string> = {
  pending_provisioning: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  provisioning: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  online: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  offline: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  suspended: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400",
  decommissioned: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
};

export function RouterStatusBadge({ status }: { status: RouterStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {ROUTER_STATUS_LABEL[status]}
    </Badge>
  );
}

const HEALTH_STYLES: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  unhealthy: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  unknown: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
};

/** `null` (never health-checked) renders as an honest "Unknown", not a
 * fabricated healthy/unhealthy guess. */
export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const key = status ?? "unknown";
  return (
    <Badge variant="outline" className={cn("rounded-full capitalize", HEALTH_STYLES[key])}>
      {key}
    </Badge>
  );
}
