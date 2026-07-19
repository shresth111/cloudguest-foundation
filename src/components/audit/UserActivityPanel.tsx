import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuditUsers } from "@/hooks/useAudit";
import { StatusBadge, formatTimestamp, relativeTime } from "./audit-utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function UserActivityPanel() {
  const q = useAuditUsers();

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-base">User activity</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <LoadingSkeleton rows={5} /> :
           q.isError ? <ErrorState onRetry={() => q.refetch()} /> :
           !q.data?.length ? <EmptyState title="No user activity" /> : (
            <div className="overflow-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead>Active sessions</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>OS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                      <TableCell className="text-xs">{formatTimestamp(u.lastLoginAt)}<div className="text-muted-foreground">{relativeTime(u.lastLoginAt)}</div></TableCell>
                      <TableCell><Badge>{u.activeSessions}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.devices.join(", ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.browsers.join(", ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.os.join(", ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Login history</CardTitle></CardHeader>
          <CardContent>
            {q.isLoading ? <LoadingSkeleton rows={5} /> : !q.data ? null : (
              <ul className="divide-y divide-border/60">
                {q.data.flatMap((u) => u.loginHistory.slice(0, 2).map((h, i) => (
                  <li key={u.userId + i} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-32 truncate">{u.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{h.ip}</span>
                    <span className="text-xs text-muted-foreground">{h.device}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{relativeTime(h.at)}</span>
                    <StatusBadge status={h.status} />
                  </li>
                )))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Logout history</CardTitle></CardHeader>
          <CardContent>
            {q.isLoading ? <LoadingSkeleton rows={5} /> : !q.data ? null : (
              <ul className="divide-y divide-border/60">
                {q.data.flatMap((u) => u.logoutHistory.slice(0, 2).map((h, i) => (
                  <li key={u.userId + "l" + i} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-32 truncate">{u.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{h.ip}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{relativeTime(h.at)}</span>
                  </li>
                )))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
