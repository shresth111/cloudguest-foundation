import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKpis } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

export function KpiGrid() {
  const { data, isLoading, isError, refetch } = useKpis();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between py-6">
          <p className="text-sm text-muted-foreground">Failed to load KPIs.</p>
          <button className="text-sm font-medium text-primary hover:underline" onClick={() => refetch()}>
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((k) => {
        const Icon = k.trend === "up" ? ArrowUpRight : k.trend === "down" ? ArrowDownRight : Minus;
        const tone =
          k.trend === "up"
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            : k.trend === "down"
              ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
              : "text-muted-foreground bg-muted";
        return (
          <Card
            key={k.key}
            className="group rounded-2xl border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                {k.delta && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
                    <Icon className="h-3 w-3" />
                    {k.delta}
                  </span>
                )}
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {k.value}
              </div>
              {k.hint && <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
