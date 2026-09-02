import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspaceScope } from "@/hooks/useWorkspace";
import { ScopeErrorBanner } from "@/components/workspace/ScopeErrorBanner";
import { guestLabel } from "@/lib/guest-label";
import { GUEST_AUTH_METHOD_LABEL } from "@/types/guest";

function statusVariant(s: string) {
  if (s === "online") return "default" as const;
  if (s === "provisioning" || s === "pending_provisioning") return "secondary" as const;
  return "destructive" as const;
}

export function RoutersOverview() {
  const { scope, aggregated, isError, refetchFailed } = useWorkspaceScope();
  return (
    <>
      {isError ? <ScopeErrorBanner onRetry={refetchFailed} /> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Routers ({aggregated.routers.length}) — {scope.length} location
            {scope.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Router</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Public IP</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregated.routers.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.model}</TableCell>
                  <TableCell className="font-mono text-xs">{r.publicIpAddress ?? "—"}</TableCell>
                  <TableCell>
                    {r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)} className="capitalize">
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {aggregated.routers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No routers in scope.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export function GuestsOverview() {
  const { aggregated, isError, refetchFailed } = useWorkspaceScope();
  // The card was titled "Live guests (24)" over a table listing every
  // session loaded, including guests who disconnected days ago -- so an
  // owner reading it at 8am believed 24 people were on their WiFi. The
  // count of people connected *now* is a different number, and it is the
  // one they actually want; show both, labelled.
  const onlineNow = aggregated.analytics.activeSessions;
  return (
    <>
      {isError ? <ScopeErrorBanner onRetry={refetchFailed} /> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guest visits</CardTitle>
          <p className="text-sm text-muted-foreground">
            {onlineNow === 1
              ? "1 guest connected right now"
              : `${onlineNow} guests connected right now`}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signed in with</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregated.guestSessions.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{guestLabel(g)}</TableCell>
                  <TableCell>
                    <Badge variant={g.status === "active" ? "default" : "outline"}>
                      {g.status === "active" ? "Online" : "Ended"}
                    </Badge>
                  </TableCell>
                  <TableCell>{GUEST_AUTH_METHOD_LABEL[g.authMethod] ?? g.authMethod}</TableCell>
                  <TableCell>{new Date(g.startedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{g.dataMb.toFixed(1)} MB</TableCell>
                </TableRow>
              ))}
              {aggregated.guestSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No guests have connected here yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
