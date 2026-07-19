import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import type { UsageRow } from "@/types/billing";

const fmt = new Intl.NumberFormat();

interface Props {
  data?: UsageRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function UsageBillingPanel({ data, isLoading, isError, onRetry }: Props) {
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!data || data.length === 0) return <EmptyState title="No usage data" />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.map((u) => (
        <Card key={u.organizationId}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{u.organizationName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UsageRowItem label="Locations" used={u.locationsUsed} limit={u.locationsLimit} />
            <UsageRowItem label="Routers" used={u.routersUsed} limit={u.routersLimit} />
            <UsageRowItem label="Storage" used={u.storageUsedGb} limit={u.storageLimitGb} suffix=" GB" />
            <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
              <MetricPill label="Guest sessions" value={fmt.format(u.guestSessions)} />
              <MetricPill label="SMS OTP" value={fmt.format(u.smsOtp)} />
              <MetricPill label="Email OTP" value={fmt.format(u.emailOtp)} />
              <MetricPill label="API calls" value={fmt.format(u.apiCalls)} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsageRowItem({ label, used, limit, suffix = "" }: { label: string; used: number; limit: number; suffix?: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{used}{suffix} / {limit}{suffix}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
