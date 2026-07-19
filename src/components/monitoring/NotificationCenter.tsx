import { useState } from "react";
import { AlertTriangle, Bell, Cpu, Package, Wrench, CreditCard, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useMonitoringNotifications } from "@/hooks/useMonitoring";
import { monitoringService } from "@/services/monitoring.service";
import { useQueryClient } from "@tanstack/react-query";
import type { MonitoringNotification } from "@/types/monitoring";
import { cn } from "@/lib/utils";

const iconMap: Record<MonitoringNotification["category"], typeof Bell> = {
  critical: AlertTriangle,
  warning: Cpu,
  maintenance: Wrench,
  firmware: Package,
  subscription: CreditCard,
};

const tone: Record<MonitoringNotification["category"], string> = {
  critical: "bg-red-500/15 text-red-500",
  warning: "bg-amber-500/15 text-amber-600",
  maintenance: "bg-sky-500/15 text-sky-500",
  firmware: "bg-violet-500/15 text-violet-500",
  subscription: "bg-emerald-500/15 text-emerald-500",
};

export function NotificationCenter() {
  const { data, isLoading, isError, refetch } = useMonitoringNotifications();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("all");

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const items = tab === "all" ? data : data.filter((n) => n.category === tab);

  const markRead = async (id: string) => {
    await monitoringService.markNotificationRead(id);
    qc.invalidateQueries({ queryKey: ["monitoring", "notifications"] });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4" /> Notification center
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-3 w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="critical">Critical</TabsTrigger>
            <TabsTrigger value="warning">Warning</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="firmware">Firmware</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-0">
            {items.length === 0 ? (
              <EmptyState title="You're all caught up" description="No notifications in this category." />
            ) : (
              <ul className="space-y-2">
                {items.map((n) => {
                  const Icon = iconMap[n.category];
                  return (
                    <li key={n.id} className={cn("flex items-start gap-3 rounded-lg border p-3", !n.read && "bg-muted/40")}>
                      <div className={cn("mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg", tone[n.category])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{n.title}</div>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{n.message}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                      {!n.read && (
                        <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Mark read
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
