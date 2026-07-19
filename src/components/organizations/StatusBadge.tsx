import type { OrgStatus, SubscriptionPlan } from "@/types/organization";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<OrgStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  suspended: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  trial: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  expired: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  pending_verification: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
};

const STATUS_LABEL: Record<OrgStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  trial: "Trial",
  expired: "Expired",
  pending_verification: "Pending",
};

export function StatusBadge({ status }: { status: OrgStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const PLAN_STYLES: Record<SubscriptionPlan, string> = {
  starter: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
  growth: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-300",
  business: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-300",
  enterprise: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
};

export function PlanBadge({ plan }: { plan: SubscriptionPlan }) {
  return (
    <Badge variant="outline" className={cn("rounded-full capitalize", PLAN_STYLES[plan])}>
      {plan}
    </Badge>
  );
}
