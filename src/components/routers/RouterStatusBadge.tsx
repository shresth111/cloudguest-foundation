import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RouterStatus, ServiceStatus, TunnelStatus } from "@/types/router";
import { ROUTER_STATUS_LABEL } from "@/types/router";

const STATUS_STYLES: Record<RouterStatus, string> = {
  online: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  offline: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  maintenance: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  provisioning: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  suspended: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:text-fuchsia-400",
  error: "bg-red-600/10 text-red-700 border-red-600/20 dark:text-red-400",
};

export function RouterStatusBadge({ status }: { status: RouterStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {ROUTER_STATUS_LABEL[status]}
    </Badge>
  );
}

const TUNNEL_STYLES: Record<TunnelStatus, string> = {
  up: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  down: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  connecting: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
};

export function TunnelStatusBadge({ status }: { status: TunnelStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full capitalize", TUNNEL_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}

const SERVICE_STYLES: Record<ServiceStatus, string> = {
  running: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  stopped: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  error: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full capitalize", SERVICE_STYLES[status])}>
      {status}
    </Badge>
  );
}
