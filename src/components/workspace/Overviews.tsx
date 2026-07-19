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
  if (s === "degraded") return "secondary" as const;
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
              <TableHead>Uptime</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregated.routers.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.model}</TableCell>
                <TableCell className="font-mono text-xs">{r.publicIp}</TableCell>
                <TableCell>{r.uptime}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)} className="capitalize">
                    {r.status}
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
        <CardTitle className="text-base">Live guests ({aggregated.guests.length})</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>MAC</TableHead>
              <TableHead>Connected</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregated.guests.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>{g.device}</TableCell>
                <TableCell className="font-mono text-xs">{g.mac}</TableCell>
                <TableCell>{g.connectedAt}</TableCell>
                <TableCell className="text-right">{g.dataMb} MB</TableCell>
              </TableRow>
            ))}
            {aggregated.guests.length === 0 && (
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

export function StaffOverview() {
  const { aggregated } = useWorkspaceScope();
  const roles = aggregated.staff.reduce<Record<string, number>>((acc, s) => {
    acc[s.role] = (acc[s.role] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {Object.entries(roles).map(([role, count]) => (
          <Card key={role}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{role}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </CardContent>
          </Card>
        ))}
        {Object.keys(roles).length === 0 && (
          <p className="text-sm text-muted-foreground">No staff in scope.</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff members</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregated.staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.role}</TableCell>
                  <TableCell className="text-xs">{s.email}</TableCell>
                  <TableCell>{s.lastActive}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
