import type { AuditSeverity, AuditStatus, AuditCategory } from "@/types/audit";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Info, ShieldAlert, Shield, Zap, Wifi, Server, Users as UsersIcon, Receipt, KeyRound, Settings as SettingsIcon, Activity as ActivityIcon, type LucideIcon } from "lucide-react";
import type { AuditAction } from "@/types/audit";

export const SEVERITY_CLASS: Record<AuditSeverity, string> = {
  info:     "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  low:      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium:   "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high:     "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${SEVERITY_CLASS[severity]}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: AuditStatus }) {
  const map: Record<AuditStatus, { icon: LucideIcon; cls: string; label: string }> = {
    success: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400",  label: "Success" },
    failure: { icon: XCircle,      cls: "text-rose-600 dark:text-rose-400",         label: "Failure" },
    warning: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400",      label: "Warning" },
    pending: { icon: Clock,         cls: "text-muted-foreground",                    label: "Pending" },
  };
  const { icon: Icon, cls, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: AuditCategory }) {
  return (
    <Badge variant="secondary" className="capitalize text-[11px]">
      {category.replace("_", " ")}
    </Badge>
  );
}

export const CATEGORY_ICON: Record<AuditCategory, LucideIcon> = {
  authentication: KeyRound,
  security: ShieldAlert,
  configuration: SettingsIcon,
  network: Wifi,
  system: Server,
  billing: Receipt,
  api: Zap,
  user: UsersIcon,
  guest: UsersIcon,
};

export function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function humanAction(a: AuditAction): string {
  return a.split(".")[1]?.replace(/_/g, " ") ?? a;
}

export const Icons = { Info, Shield, ShieldAlert, Server, Wifi, Zap, ActivityIcon };
