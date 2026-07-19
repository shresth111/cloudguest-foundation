import { Badge } from "@/components/ui/badge";
import type { PortalLoginMethod, PortalStatus } from "@/types/portal";
import { LOGIN_METHOD_LABEL } from "@/types/portal";

const STATUS_STYLE: Record<PortalStatus, string> = {
  published: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  draft: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
  scheduled: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  archived: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const STATUS_LABEL: Record<PortalStatus, string> = {
  published: "Published",
  draft: "Draft",
  scheduled: "Scheduled",
  archived: "Archived",
};

export function PortalStatusBadge({ status }: { status: PortalStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function LoginMethodBadge({ method }: { method: PortalLoginMethod }) {
  return (
    <Badge variant="secondary" className="font-medium">
      {LOGIN_METHOD_LABEL[method]}
    </Badge>
  );
}
