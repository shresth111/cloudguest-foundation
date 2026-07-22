import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CalendarClock, ShieldOff, type LucideIcon } from "lucide-react";
import { useAuditKpis } from "@/hooks/useAudit";

interface Tile {
  key: string;
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  tone: string;
}

export function AuditKpiGrid() {
  const { data, isLoading, isError } = useAuditKpis();

  const tiles: Tile[] = [
    {
      key: "total",
      label: "Total audit entries",
      value: data?.totalEntries,
      icon: Activity,
      tone: "text-sky-600 dark:text-sky-400",
    },
    {
      key: "today",
      label: "Entries today",
      value: data?.entriesToday,
      icon: CalendarClock,
      tone: "text-teal-600 dark:text-teal-400",
    },
    {
      key: "failedLogins",
      label: "Failed logins",
      value: data?.failedLogins,
      icon: ShieldOff,
      tone: "text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.key} className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
              <t.icon className={`h-4 w-4 ${t.tone}`} />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : isError || t.value === undefined ? (
                "—"
              ) : (
                t.value.toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
