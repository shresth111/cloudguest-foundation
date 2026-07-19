import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import type { LocationAnalyticsRow } from "@/types/analytics";

interface Props {
  data?: LocationAnalyticsRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function LocationAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const sorted = data ? [...data].sort((a, b) => b.activeGuests - a.activeGuests) : [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Top locations</CardTitle>
        <p className="text-xs text-muted-foreground">Traffic, revenue, guests and session duration</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : sorted.length === 0 ? (
          <EmptyState title="No location activity" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Guests</TableHead>
                  <TableHead className="text-right">Traffic (GB)</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.city}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.activeGuests.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.trafficGb.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{money.format(row.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.avgSessionMin}m</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
