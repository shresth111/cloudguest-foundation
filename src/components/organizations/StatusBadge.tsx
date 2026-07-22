import type { OrgStatus } from "@/types/organization";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<OrgStatus, string> = {
  trial: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  suspended: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  archived: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
};

const STATUS_LABEL: Record<OrgStatus, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
};

export function StatusBadge({ status }: { status: OrgStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
