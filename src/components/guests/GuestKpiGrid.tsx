import {
  Activity,
  Clock,
  Database,
  KeyRound,
  Mail,
  Ticket,
  UserCheck,
  Users,
  Wifi,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGuestKpis } from "@/hooks/useGuests";

interface KpiDef {
  key: string;
  label: string;
  icon: LucideIcon;
  format: (v: number) => string;
  accent: string;
}

const KPIS: KpiDef[] = [
  { key: "totalGuests", label: "Total Guests", icon: Users, format: (v) => v.toLocaleString(), accent: "text-indigo-500" },
  { key: "activeGuests", label: "Active Guests", icon: UserCheck, format: (v) => v.toLocaleString(), accent: "text-emerald-500" },
  { key: "onlineUsers", label: "Online Users", icon: Wifi, format: (v) => v.toLocaleString(), accent: "text-sky-500" },
  { key: "todaysLogins", label: "Today's Logins", icon: Activity, format: (v) => v.toLocaleString(), accent: "text-amber-500" },
  { key: "otpLogins", label: "OTP Logins", icon: KeyRound, format: (v) => v.toLocaleString(), accent: "text-teal-500" },
  { key: "voucherLogins", label: "Voucher Logins", icon: Ticket, format: (v) => v.toLocaleString(), accent: "text-orange-500" },
  { key: "socialLogins", label: "Social Logins", icon: Mail, format: (v) => v.toLocaleString(), accent: "text-violet-500" },
  { key: "pmsLogins", label: "PMS Logins", icon: Building2, format: (v) => v.toLocaleString(), accent: "text-fuchsia-500" },
  { key: "avgSessionMin", label: "Avg Session", icon: Clock, format: (v) => `${v}m`, accent: "text-cyan-500" },
  { key: "totalBandwidthGb", label: "Total Bandwidth", icon: Database, format: (v) => `${v.toLocaleString()} GB`, accent: "text-rose-500" },
];

export function GuestKpiGrid() {
  const { data, isLoading } = useGuestKpis();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {KPIS.map((k) => {
        const Icon = k.icon;
        const value = (data as Record<string, number> | undefined)?.[k.key];
        return (
          <Card
            key={k.key}
            className="group rounded-2xl border-border/70 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </span>
              <Icon className={cn("h-4 w-4", k.accent)} />
            </div>
            <div className="mt-3 h-8">
              {isLoading || value == null ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {k.format(value)}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
