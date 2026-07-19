import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import type { OrganizationAnalyticsRow } from "@/types/analytics";

interface Props {
  data?: OrganizationAnalyticsRow[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function OrganizationAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const sorted = data ? [...data].sort((a, b) => b.revenue - a.revenue) : [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Organization ranking</CardTitle>
        <p className="text-xs text-muted-foreground">Revenue, users, routers, locations and month-over-month growth</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : sorted.length === 0 ? (
          <EmptyState title="No organizations" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Active users</TableHead>
                  <TableHead className="text-right">Routers</TableHead>
                  <TableHead className="text-right">Locations</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row, i) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.activeUsers.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.activeRouters}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.activeLocations}</TableCell>
                    <TableCell className="text-right tabular-nums">{money.format(row.revenue)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={row.monthlyGrowth >= 10 ? "default" : "secondary"}>
                        {row.monthlyGrowth >= 0 ? "+" : ""}
                        {row.monthlyGrowth.toFixed(1)}%
                      </Badge>
                    </TableCell>
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
