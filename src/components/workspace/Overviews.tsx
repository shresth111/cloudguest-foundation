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

function statusVariant(s: string) {
  if (s === "online") return "default" as const;
  if (s === "provisioning" || s === "pending_provisioning") return "secondary" as const;
  return "destructive" as const;
}

export function RoutersOverview() {
  const { scope, aggregated } = useWorkspaceScope();
  return (
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
  );
}

export function GuestsOverview() {
  const { aggregated } = useWorkspaceScope();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Live guests ({aggregated.guestSessions.length})</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregated.guestSessions.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.guestIdentifier}</TableCell>
                <TableCell className="capitalize">{g.authMethod.replace(/_/g, " ")}</TableCell>
                <TableCell className="font-mono text-xs">{g.ipAddress ?? "—"}</TableCell>
                <TableCell>{new Date(g.startedAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">{g.dataMb.toFixed(1)} MB</TableCell>
              </TableRow>
            ))}
            {aggregated.guestSessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No active guests.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
