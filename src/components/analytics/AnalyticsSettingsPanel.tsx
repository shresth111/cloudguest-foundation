import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnalyticsSettings, useUpdateAnalyticsSettings } from "@/hooks/useAnalytics";
import type { AnalyticsSettings, DateRangePreset } from "@/types/analytics";

const TIMEZONES = ["UTC", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"];

export function AnalyticsSettingsPanel() {
  const { data, isLoading } = useAnalyticsSettings();
  const update = useUpdateAnalyticsSettings();

  async function set<K extends keyof AnalyticsSettings>(key: K, value: AnalyticsSettings[K]) {
    if (!data) return;
    try {
      await update.mutateAsync({ ...data, [key]: value });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to update settings");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Analytics settings</CardTitle>
        <p className="text-xs text-muted-foreground">Configure defaults for the analytics workspace.</p>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default dashboard</Label>
              <Select value={data.defaultDashboard} onValueChange={(v) => set("defaultDashboard", v as AnalyticsSettings["defaultDashboard"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="guests">Guests</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="routers">Routers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default date range</Label>
              <Select value={data.defaultDateRange} onValueChange={(v) => set("defaultDateRange", v as DateRangePreset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last7">Last 7 days</SelectItem>
                  <SelectItem value="last30">Last 30 days</SelectItem>
                  <SelectItem value="last90">Last 90 days</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="last_month">Last month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Auto refresh</Label>
              <Select value={String(data.autoRefreshSec)} onValueChange={(v) => set("autoRefreshSec", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Off</SelectItem>
                  <SelectItem value="30">Every 30s</SelectItem>
                  <SelectItem value="60">Every 1m</SelectItem>
                  <SelectItem value="300">Every 5m</SelectItem>
                  <SelectItem value="900">Every 15m</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Report timezone</Label>
              <Select value={data.timezone} onValueChange={(v) => set("timezone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chart style</Label>
              <Select value={data.chartStyle} onValueChange={(v) => set("chartStyle", v as AnalyticsSettings["chartStyle"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="smooth">Smooth curves</SelectItem>
                  <SelectItem value="linear">Linear lines</SelectItem>
                  <SelectItem value="bars">Bars</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" disabled={update.isPending} onClick={() => set("defaultDateRange", data.defaultDateRange)}>
                {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save preferences
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
