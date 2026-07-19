import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DeviceType, GuestStatus, GuestType, LoginMethod, SignalStrength } from "@/types/guest";
import { DEVICE_TYPE_LABEL, GUEST_TYPE_LABEL, LOGIN_METHOD_LABEL } from "@/types/guest";
import { SignalHigh, SignalLow, SignalMedium, SignalZero } from "lucide-react";

const STATUS_STYLES: Record<GuestStatus, string> = {
  online: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  offline: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  blocked: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  expired: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
};

export function GuestStatusBadge({ status }: { status: GuestStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full capitalize", STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}

const LOGIN_STYLES: Record<LoginMethod, string> = {
  otp_mobile: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  otp_email: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-300",
  voucher: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
  pms: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-300",
  social: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-300",
  click_through: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
};

export function LoginMethodBadge({ method }: { method: LoginMethod }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", LOGIN_STYLES[method])}>
      {LOGIN_METHOD_LABEL[method]}
    </Badge>
  );
}

const GUEST_TYPE_STYLES: Record<GuestType, string> = {
  visitor: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
  customer: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300",
  hotel_guest: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-300",
  employee: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300",
  student: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-300",
  vip: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
  contractor: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-300",
};

export function GuestTypeBadge({ type }: { type: GuestType }) {
  return (
    <Badge variant="outline" className={cn("rounded-full", GUEST_TYPE_STYLES[type])}>
      {GUEST_TYPE_LABEL[type]}
    </Badge>
  );
}

export function DeviceTypeBadge({ type }: { type: DeviceType }) {
  return (
    <Badge variant="outline" className="rounded-full capitalize text-muted-foreground">
      {DEVICE_TYPE_LABEL[type]}
    </Badge>
  );
}

const SIGNAL_MAP: Record<SignalStrength, { icon: typeof SignalHigh; className: string }> = {
  excellent: { icon: SignalHigh, className: "text-emerald-500" },
  good: { icon: SignalHigh, className: "text-emerald-400" },
  fair: { icon: SignalMedium, className: "text-amber-500" },
  poor: { icon: SignalLow, className: "text-rose-500" },
};

export function SignalIcon({ signal }: { signal: SignalStrength }) {
  const cfg = SIGNAL_MAP[signal] ?? { icon: SignalZero, className: "text-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs capitalize", cfg.className)}>
      <Icon className="h-4 w-4" />
      {signal}
    </span>
  );
}
