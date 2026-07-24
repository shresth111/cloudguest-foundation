import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Users,
  Sparkles,
  CalendarClock,
  AlertOctagon,
  Wallet,
  Percent,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { cn } from "@/lib/utils";
import type { BillingKpis } from "@/types/billing";

interface Props {
  data?: BillingKpis;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const fmt = new Intl.NumberFormat();

const toneClass = {
  default: "bg-muted/40 text-foreground",
  success: "bg-emerald-500/10 text-emerald-500",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-rose-500/10 text-rose-500",
  info: "bg-sky-500/10 text-sky-500",
} as const;
type Tone = keyof typeof toneClass;

export function BillingKpiGrid({ data, isLoading, isError, onRetry }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={onRetry} />;

  const tiles: { label: string; value: string; icon: typeof Users; tone: Tone; hint?: string }[] = [
    { label: "Monthly recurring revenue", value: money.format(data.mrr), icon: DollarSign, tone: "success", hint: "MRR" },
    { label: "Annual recurring revenue", value: money.format(data.arr), icon: TrendingUp, tone: "success", hint: "ARR" },
    { label: "Active subscriptions", value: fmt.format(data.activeSubscriptions), icon: Users, tone: "info" },
    { label: "Trial organizations", value: fmt.format(data.trialOrganizations), icon: Sparkles, tone: "warning" },
    { label: "Expiring plans", value: fmt.format(data.expiringPlans), icon: CalendarClock, tone: "warning", hint: "Next 14 days" },
    { label: "Overdue payments", value: fmt.format(data.overduePayments), icon: AlertOctagon, tone: "danger" },
    { label: "Total revenue", value: money.format(data.totalRevenue), icon: Wallet, tone: "default" },
    { label: "Collection rate", value: `${data.collectionRate}%`, icon: Percent, tone: data.collectionRate >= 90 ? "success" : "warning" },
    { label: "ARPO", value: money.format(data.arpo), icon: Layers, tone: "info", hint: "Avg revenue / org" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((t, i) => {
        const Icon = t.icon;
        return (
          <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</div>
                  <div className="mt-1 truncate text-2xl font-semibold tracking-tight">{t.value}</div>
                  {t.hint && <div className="text-[11px] text-muted-foreground">{t.hint}</div>}
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneClass[t.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
