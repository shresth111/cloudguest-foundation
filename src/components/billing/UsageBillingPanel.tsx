import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { cn } from "@/lib/utils";
import type { UsageRow } from "@/types/billing";

const fmt = new Intl.NumberFormat();

/**
 * Above this, a Locations/Routers/Storage *limit* reads as bad test data
 * (an extra accidental digit or two), not a real customer quota -- see
 * this file's own git history / the PR that added this table for the
 * specific offenders (e.g. a routers limit of 111111, a locations limit
 * of 14445454). We never clamp or hide the number -- an operator needs
 * to see the real value to go fix it at the source -- we just tint the
 * cell and the row so it's obvious at a glance without breaking layout.
 */
const IMPLAUSIBLE_LIMIT_THRESHOLD = 10_000;

interface Props {
  data?: UsageRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function UsageBillingPanel({ data, isLoading, isError, onRetry }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No usage data" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Routers</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="text-right">Guest sessions</TableHead>
                  <TableHead className="text-right">SMS OTP</TableHead>
                  <TableHead className="text-right">Email OTP</TableHead>
                  <TableHead className="text-right">API calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => {
                  const rowFlagged =
                    u.locationsLimit > IMPLAUSIBLE_LIMIT_THRESHOLD ||
                    u.routersLimit > IMPLAUSIBLE_LIMIT_THRESHOLD ||
                    u.storageLimitGb > IMPLAUSIBLE_LIMIT_THRESHOLD;
                  return (
                    <TableRow key={u.organizationId} className={cn(rowFlagged && "bg-amber-500/5")}>
                      <TableCell className="font-medium">{u.organizationName}</TableCell>
                      <TableCell>
                        <QuotaCell used={u.locationsUsed} limit={u.locationsLimit} />
                      </TableCell>
                      <TableCell>
                        <QuotaCell used={u.routersUsed} limit={u.routersLimit} />
                      </TableCell>
                      <TableCell>
                        <QuotaCell used={u.storageUsedGb} limit={u.storageLimitGb} suffix=" GB" />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                        {fmt.format(u.guestSessions)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                        {fmt.format(u.smsOtp)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                        {fmt.format(u.emailOtp)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                        {fmt.format(u.apiCalls)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuotaCell({ used, limit, suffix = "" }: { used: number; limit: number; suffix?: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const implausible = limit > IMPLAUSIBLE_LIMIT_THRESHOLD;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 whitespace-nowrap text-sm tabular-nums">
        <span className="font-medium">
          {fmt.format(used)}
          {suffix}
        </span>
        <span
          className={cn(
            "text-muted-foreground",
            implausible && "text-amber-600 dark:text-amber-400",
          )}
        >
          / {fmt.format(limit)}
          {suffix}
        </span>
        {implausible && (
          <Badge
            variant="outline"
            className="ml-0.5 gap-1 border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
            title="Unusually high limit -- likely bad test data, verify at the source"
          >
            <AlertTriangle className="h-3 w-3" /> check
          </Badge>
        )}
      </div>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
