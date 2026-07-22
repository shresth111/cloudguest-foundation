import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AccessRuleType, GuestAuthMethod, GuestSessionStatus } from "@/types/guest";
import {
  ACCESS_RULE_TYPE_LABEL,
  GUEST_AUTH_METHOD_LABEL,
  GUEST_SESSION_STATUS_LABEL,
} from "@/types/guest";

const STATUS_STYLES: Record<GuestSessionStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  disconnected: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  terminated: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  expired: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
};

export function GuestSessionStatusBadge({ status }: { status: GuestSessionStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {GUEST_SESSION_STATUS_LABEL[status]}
    </Badge>
  );
}

const RULE_TYPE_STYLES: Record<AccessRuleType, string> = {
  vip: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
  temporary: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  blocklist: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-300",
  whitelist: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300",
};

export function AccessRuleTypeBadge({ type }: { type: AccessRuleType }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", RULE_TYPE_STYLES[type])}>
      {ACCESS_RULE_TYPE_LABEL[type]}
    </Badge>
  );
}

const AUTH_METHOD_STYLES: Record<GuestAuthMethod, string> = {
  otp_sms: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  otp_email: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-300",
  voucher: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
  username_password: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
};

export function GuestAuthMethodBadge({ method }: { method: GuestAuthMethod }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", AUTH_METHOD_STYLES[method])}>
      {GUEST_AUTH_METHOD_LABEL[method]}
    </Badge>
  );
}
