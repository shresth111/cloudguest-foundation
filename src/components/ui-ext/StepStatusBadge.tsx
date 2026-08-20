import { cn } from "@/lib/utils";

export type StepStatus = "PASS" | "WARNING" | "ERROR" | "BLOCKED" | "PENDING";

const STATUS_STYLES: Record<StepStatus, string> = {
  PASS: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  WARNING: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  ERROR: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  BLOCKED: "bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  PENDING: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<StepStatus, string> = {
  PASS: "Pass",
  WARNING: "Warning",
  ERROR: "Error",
  BLOCKED: "Blocked",
  PENDING: "Pending",
};

export interface StepStatusBadgeProps {
  status: StepStatus;
  label?: string;
  className?: string;
}

export function StepStatusBadge({ status, label, className }: StepStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
